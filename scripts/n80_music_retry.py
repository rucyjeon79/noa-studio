"""One-shot recovery of observed job 83 after actual availability proof; no general redrive endpoint."""
import hashlib,json,secrets,time,urllib.request,os
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from n80_live_observer import request_observation

def main():
    out=Path('music-retry-proof');out.mkdir(exist_ok=True);t=connect();installed=False;result={}
    try:
        with paramiko.SFTPClient.from_transport(t)as s:
            s.get_channel().settimeout(45)
            with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(129).strip()
            observation=request_observation(key);rows=[r for r in observation['receipts']if r['jobId']==83]
            if len(rows)!=1:raise RuntimeError('reviewed_job_missing')
            event=rows[0]['eventId'];lease='/hosting/noastudio/noa-ai-lab/n80-music-consumer/leases/'+hashlib.sha256((event+'|music').encode()).hexdigest()+'.json'
            with s.open(lease,'rb')as f:raw=f.read(65536)
            state=json.loads(raw)
            if state.get('status')=='succeeded' and state.get('receipt'):
                result={'ok':True,'alreadyAcknowledged':True,'retryPrepared':False,'databaseWrites':0}
            elif state.get('status')=='pending' and state.get('repair',{}).get('generationPreserved')==3:
                result={'ok':True,'alreadyPrepared':True,'retryPrepared':False,'databaseWrites':0}
            else:
                if state.get('status')!='dead_letter' or state.get('attempts')!=3 or state.get('generation')!=3 or state.get('receipt'):raise RuntimeError('unreviewed_state_preserved')
                for target,source in [('noa-app/engine/music-availability.php','deploy/noa-app/engine/music-availability.php'),('noa-bridge/music-proof-auth.php','bridge/music-proof-auth.php')]:
                    with s.open(ROOT+'/'+target,'rb')as f:
                        if f.read()!=Path(source).read_bytes():raise RuntimeError('verified_source_changed')
                token=secrets.token_hex(32);name='music-retry-'+secrets.token_hex(10)+'.php';remote=ROOT+'/noa-bridge/'+name
                core=Path('scripts/n80_music_retry_core.php').read_text().replace('<?php','',1).replace('declare(strict_types=1);','',1)
                code=Path('scripts/n80_music_retry_control.php').read_text().replace('/*NOA_RETRY_CORE*/',core).replace('NOA_RETRY_EXPIRY',str(int(time.time())+300)).replace('NOA_RETRY_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).replace('NOA_RETRY_STATE_SHA',hashlib.sha256(raw).hexdigest()).encode()
                try:
                    with s.open(remote,'wx')as f:f.write(code)
                    installed=True;s.chmod(remote,0o644)
                    with s.open(remote,'rb')as f:
                        if f.read()!=code:raise RuntimeError('helper_readback_failed')
                    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'X-NOA-Control':token,'Content-Type':'application/json'})
                    with urllib.request.urlopen(req,timeout=120)as response:result=json.load(response)
                    if not result.get('ok'):raise RuntimeError('controlled_retry_failed:'+str(result))
                finally:
                    if installed:
                        with s.open(remote,'rb')as f:
                            if f.read()!=code:raise RuntimeError('changed_helper_preserved')
                        s.remove(remote)
    finally:t.close()
    result.update({'jobId':83,'commit':os.environ['GITHUB_SHA'],'temporaryHelperRemoved':True})
    (out/'retry.json').write_text(json.dumps(result,indent=2)+'\n');print('MUSIC_RETRY_REPAIR',json.dumps(result))
if __name__=='__main__':main()
