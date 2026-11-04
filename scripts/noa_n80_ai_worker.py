"""Run at most three N80 text tasks. No provider credentials or conversation bodies leave the host."""
import hashlib,hmac,json,os,secrets,stat,subprocess,sys,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect
ORIGIN='https://noastudio.ai.kr'
def worker_key():
    t=connect()
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30)
            path='/hosting/noastudio/noa-ai-lab/worker.key';a=s.lstat(path)
            if not stat.S_ISREG(a.st_mode) or a.st_size!=64:raise RuntimeError('invalid_worker_key_file')
            with s.open(path,'rb') as f:key=f.read().strip()
    finally:t.close()
    if len(key)!=64:raise RuntimeError('invalid_worker_key')
    return key

def signed_tick(key,action,body=b'{}'):
    query='action='+action
    ts=str(int(time.time()));nonce=secrets.token_hex(16)
    signed='\n'.join(['POST',query,hashlib.sha256(body).hexdigest(),ts,nonce]).encode()
    signature=hmac.new(key,signed,hashlib.sha256).hexdigest()
    request=urllib.request.Request(ORIGIN+'/noa-bridge/lab-worker.php?'+query,data=body,headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':signature})
    with urllib.request.urlopen(request,timeout=60) as r:result=json.load(r)
    if not result.get('ok'):raise RuntimeError('n80_tick_unavailable')
    return result

def refresh_index(verify):
    key=worker_key()
    audit=verify and os.getenv('NOA_MOOD_COLLECTIONS')=='true'
    options={'verifyCatalog':verify,'verifyMoods':audit}
    result=signed_tick(key,'n80_listening_index',json.dumps(options).encode())
    print('N80_LISTENING_INDEX',json.dumps({k:result[k] for k in ('indexed','analyzed','reused','written','removed','publicVideos') if k in result}))
    if verify and (result['indexed']<1 or result['publicVideos']<1):raise RuntimeError('no_playable_listening_catalog')

    if audit:
        subprocess.run(['node','scripts/qa/noa-mood-queue-audit.cjs'],input=json.dumps(result['moodCatalog']),text=True,check=True)

def main():
    with urllib.request.urlopen(ORIGIN+'/noa-ainoa.php?action=status',timeout=20) as r:
        status=json.load(r)
    if status.get('n80AutomationVersion')!=1:
        if os.getenv('NOA_N80_AI_PROOF'):raise RuntimeError('n80_text_release_missing')
        print('N80_AI_TEXT_WAITING_FOR_RELEASE');return
    key=worker_key()
    output=[]
    for _ in range(3):
        result=signed_tick(key,'n80_tick')
        output.append({k:result[k]for k in ['processed','state','taskId']if k in result})
        if not result.get('processed'):break
    if os.getenv('NOA_N80_AI_PROOF'):
        target=Path(os.environ['NOA_N80_AI_PROOF']);target.parent.mkdir(parents=True,exist_ok=True)
        target.write_text(json.dumps({'ok':True,'releaseVersion':1,'signedHttpReadback':True,'checkedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'results':output},indent=2))
    print('N80_AI_TEXT_TICK',json.dumps(output))
if __name__=='__main__':
    if '--listening-index' in sys.argv:refresh_index('--verify-catalog' in sys.argv)
    else:main()
