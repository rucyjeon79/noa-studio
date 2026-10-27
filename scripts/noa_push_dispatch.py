"""Deliver encrypted, consented Web Push only from the server-owned queue.

No audience, notification text, credentials or endpoints are accepted from CLI/CI input.
Private key material lives outside the production document root and is never logged.
"""
import base64,hashlib,hmac,json,os,secrets,stat,sys,tempfile,time,urllib.parse,urllib.request
from pathlib import Path
import paramiko
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
from pywebpush import webpush,WebPushException
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

PRIVATE=ROOT.rsplit('/',1)[0]+'/noa-notifications-private'
ORIGIN='https://noastudio.ai.kr'

def validate_config(config):
    assert isinstance(config,dict) and config.get('version')==1
    assert len(config['workerToken'])==64 and all(c in '0123456789abcdef' for c in config['workerToken'])
    key=serialization.load_pem_private_key(config['privateKey'].encode(),password=None)
    assert isinstance(key,ec.EllipticCurvePrivateKey) and isinstance(key.curve,ec.SECP256R1)
    raw=key.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)
    assert config['publicKey']==base64.urlsafe_b64encode(raw).rstrip(b'=').decode()
    return config

def private_config(create=False):
    transport=connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as s:
            s.get_channel().settimeout(30)
            assert s.normalize(ROOT)==ROOT
            try:
                info=s.lstat(PRIVATE)
                assert stat.S_ISDIR(info.st_mode),'private config directory must not be a symlink'
            except FileNotFoundError:
                if not create:raise RuntimeError('notification_private_config_not_installed') from None
                s.mkdir(PRIVATE,mode=0o700)
            try:
                info=s.lstat(PRIVATE+'/config.json')
                assert stat.S_ISREG(info.st_mode) and info.st_size<10000
                with s.open(PRIVATE+'/config.json','r') as f:config=json.load(f)
            except FileNotFoundError:
                if not create:raise RuntimeError('notification_private_config_not_installed') from None
                key=ec.generate_private_key(ec.SECP256R1())
                config={'version':1,'workerToken':secrets.token_hex(32),'privateKey':key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode(),'publicKey':base64.urlsafe_b64encode(key.public_key().public_bytes(serialization.Encoding.X962,serialization.PublicFormat.UncompressedPoint)).rstrip(b'=').decode()}
                # Exclusive creation; a restart/redeployment must never rotate live subscriptions.
                with s.open(PRIVATE+'/config.json','wx') as f:f.write(json.dumps(config))
                s.chmod(PRIVATE+'/config.json',0o600)
                with s.open(PRIVATE+'/config.json','r') as f:assert json.load(f)==config
            assert s.stat(PRIVATE+'/config.json').st_mode & 0o077==0,'private config permissions'
            return validate_config(config)
    finally:transport.close()

def worker(config,action,**fields):
    raw=json.dumps({'action':action,**fields},separators=(',',':')).encode()
    ts=str(int(time.time()));nonce=secrets.token_hex(16)
    signature=hmac.new(config['workerToken'].encode(),ts.encode()+b'\n'+nonce.encode()+b'\n'+raw,hashlib.sha256).hexdigest()
    req=urllib.request.Request(ORIGIN+'/noa-bridge/notification-worker.php',data=raw,headers={'Content-Type':'application/json','X-NOA-Time':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':signature,'User-Agent':'NOA-personal-notification-worker/1'})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=60) as response:data=json.load(response)
    if data.get('ok') is not True:raise RuntimeError('notification_worker_rejected')
    return data

def safe_endpoint(endpoint):
    if not isinstance(endpoint,str) or len(endpoint)>4096 or any(ord(c)<=32 or ord(c)==127 for c in endpoint):return False
    try:
        url=urllib.parse.urlsplit(endpoint);host=url.hostname or ''
        allowed=host in ['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'] or (host.endswith('.push.apple.com') and len(host.split('.'))==4) or (host.endswith('.notify.windows.com') and len(host.split('.'))==4)
        return url.scheme=='https' and not url.username and not url.password and not url.fragment and url.port in [None,443] and allowed
    except ValueError:return False

class NoRedirectSession:
    """Do not forward encrypted device messages or VAPID authorization on redirects."""
    def post(self,*args,**kwargs):
        import requests
        kwargs['allow_redirects']=False
        return requests.post(*args,**kwargs)

def deliver(job,keyfile):
    subscription=job['subscription']
    if not safe_endpoint(subscription.get('endpoint')):return 410
    try:
        response=webpush(subscription_info=subscription,data=json.dumps(job['payload'],ensure_ascii=False,separators=(',',':')),vapid_private_key=keyfile,vapid_claims={'sub':ORIGIN},ttl=86400,timeout=8,headers={'Urgency':'normal'},requests_session=NoRedirectSession())
        return response.status_code
    except WebPushException as error:
        # Exceptions can contain endpoint/body details; record only the numeric status.
        return error.response.status_code if error.response is not None else 0
    except Exception:return 0

def main():
    config=private_config(create='init' in sys.argv)
    if 'init' in sys.argv:
        print('NOA_NOTIFICATION_PRIVATE_CONFIG_READY');return
    if 'health' in sys.argv:
        print('NOA_NOTIFICATION_HEALTH',json.dumps(worker(config,'health')));return
    summary={'batches':0,'claimed':0,'accepted':0,'expired':0,'retryOrFailed':0,'acknowledged':0}
    started=time.monotonic()
    with tempfile.TemporaryDirectory(prefix='noa-push-') as temp:
        keyfile=Path(temp)/'vapid.pem';keyfile.write_text(config['privateKey']);keyfile.chmod(0o600)
        for _ in range(5):
            if time.monotonic()-started>240:break
            batch=worker(config,'claim');jobs=batch['jobs'];summary['batches']+=1;summary['claimed']+=len(jobs)
            for job in jobs:
                code=deliver(job,str(keyfile));summary['accepted' if 200<=code<300 else 'expired' if code in [404,410] else 'retryOrFailed']+=1
                # Acknowledge immediately: a later crash cannot replay already accepted jobs.
                ack=worker(config,'ack',results=[{'id':job['id'],'device':job['device'],'lease':job['lease'],'http':code}]);summary['acknowledged']+=ack['acknowledged']
            if not jobs and not any(count>=100 for count in batch['scanned'].values()):break
    print('NOA_PERSONAL_PUSH_DISPATCH',json.dumps(summary))
    out=Path('notifications-proof');out.mkdir(exist_ok=True);(out/'dispatch.json').write_text(json.dumps(summary,indent=2))
if __name__=='__main__':main()
