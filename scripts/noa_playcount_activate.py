"""Enable one backed-up setting with authenticated revision/source CAS; no media changes."""
import base64,hashlib,hmac,json,os,secrets,stat,sys,time,urllib.request
from pathlib import Path
import paramiko
from n80_live_observer import NoRedirect

URL='https://noastudio.ai.kr/noa-bridge/playcount-policy.php'
STATE=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-playcount-activation.json'
SOURCES=['noa-app/jukebox/stream.php','noa-app/jukebox/stream-popularity.php','noa-playcount.js','noa-music.php']
def compact(v):return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def digest(v):return hashlib.sha256(compact(dict(sorted(v.items())))).hexdigest()
def call(key,body):
    raw=compact(body);ts=str(int(time.time()));nonce=secrets.token_hex(16)
    sig=hmac.new(key,('N80-PLAYCOUNT-POLICY-1\n'+hashlib.sha256(raw).hexdigest()+'\n'+ts+'\n'+nonce).encode(),hashlib.sha256).hexdigest()
    req=urllib.request.Request(URL,data=raw,headers={'Content-Type':'application/json','X-N80-Timestamp':ts,'X-N80-Nonce':nonce,'X-N80-Signature':sig})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req,timeout=40)as response:
            data=response.read(16385);actual=response.headers.get('X-N80-Signature','')
    except OSError:raise RuntimeError('playcount_policy_request_failed')from None
    expected=hmac.new(key,('N80-PLAYCOUNT-POLICY-RESPONSE-1\n'+nonce+'\n'+hashlib.sha256(data).hexdigest()).encode(),hashlib.sha256).hexdigest()
    if len(data)>16384 or not hmac.compare_digest(actual,expected):raise RuntimeError('policy_response_signature_failed')
    result=json.loads(data)
    if result.get('ok')is not True or result.get('nonce')!=nonce:raise RuntimeError('policy_response_binding_failed')
    out=result['result']
    if out['policySha256']!=digest(out['policy']):raise RuntimeError('policy_response_hash_failed')
    return out
def main():
    rollback=sys.argv[1:]==['rollback']
    if sys.argv[1:]and not rollback:raise RuntimeError('unsupported_action')
    receipt=json.loads(Path('scripts/noa_playcount_policy_drive_receipt.json').read_text())
    if receipt.get('readbackVerified')is not True or receipt.get('backupSha256')!='34fcff78ce9aee66461bd89fe9bcb63ddf75365a26ba3f6169ec897b58cdb73b':raise RuntimeError('policy_recovery_not_verified')
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',);transport.start_client(timeout=25)
        fp='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        with paramiko.SFTPClient.from_transport(transport)as sftp:
            path='/hosting/noastudio/noa-ai-lab/worker.key'
            if sftp.normalize(path)!=path or not stat.S_ISREG(sftp.lstat(path).st_mode):raise RuntimeError('unsafe_service_key')
            with sftp.open(path,'rb')as source:key=source.read(129).strip()
    finally:transport.close()
    before=call(key,{'action':'inspect'})
    sources={p:hashlib.sha256((Path('deploy')/p).read_bytes()).hexdigest()for p in SOURCES}
    if before['sources']!=sources:raise RuntimeError('unverified_playcount_sources')
    if rollback:
        record=json.loads(STATE.read_text())
        if before['revision']!=record['afterRevision']or before['policySha256']!=record['afterPolicySha256']:raise RuntimeError('concurrent_policy_preserved')
        enabled=False
    else:
        if before['revision']!=receipt['revision']or before['policySha256']!=receipt['policySha256']or before['policy']['playbackIntegrationEnabled']is not False:raise RuntimeError('unbacked_policy_change_preserved')
        enabled=True
    expected=before['policy']|{'playbackIntegrationEnabled':enabled}
    record={'beforeRevision':before['revision'],'beforePolicySha256':before['policySha256'],'afterRevision':before['revision']+1,'afterPolicySha256':digest(expected),'backupDriveId':receipt['driveId'],'changedField':'playbackIntegrationEnabled'}
    if not rollback:STATE.write_text(json.dumps(record))
    changed=call(key,{'action':'set','expectedRevision':before['revision'],'expectedPolicySha256':before['policySha256'],'enabled':enabled,'expectedSources':sources})
    after=call(key,{'action':'inspect'})
    if after['policy']!=expected or after['revision']!=before['revision']+1 or after['policySha256']!=digest(expected)or not changed['changed']:raise RuntimeError('policy_activation_readback_failed')
    record.update({'enabled':enabled,'readbackVerified':True,'otherSettingsPreserved':True,'sources':sources})
    if not rollback:STATE.write_text(json.dumps(record))
    print('NOA_PLAYCOUNT_POLICY_VERIFIED '+json.dumps(record))
if __name__=='__main__':main()
