"""Read-only signed diagnosis of the current MUSIC verifier; never emit a business ACK."""
import hashlib,json,os
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from n80_live_observer import request_observation,request_music_diagnostic

def main():
    proof={'ok':False,'productionDatabaseWrites':0,'sourceWrites':0,'businessAck':False,'automaticDispatch':False,'commit':os.environ['GITHUB_SHA']}
    out=Path('music-diagnostic-proof');out.mkdir(exist_ok=True)
    try:
        t=connect()
        try:
            with paramiko.SFTPClient.from_transport(t)as s:
                s.get_channel().settimeout(30)
                with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(129).strip()
                if len(key)!=64:raise RuntimeError('invalid_service_key')
                sources=[]
                for name in ['consume-music.php','music-availability.php','music-consumer.php']:
                    with s.open(ROOT+'/noa-app/engine/'+name,'rb')as f:raw=f.read(131073)
                    if len(raw)>131072:raise RuntimeError('source_size_limit')
                    candidate=Path('deploy/noa-app/engine/'+name).read_bytes()
                    sources.append({'path':'noa-app/engine/'+name,'sha256':hashlib.sha256(raw).hexdigest(),'matchesCandidate':raw==candidate})
                proof['sources']=sources
        finally:t.close()
        observed=request_observation(key);proof['observed']=observed['observed']
        if not observed.get('receipts'):raise RuntimeError('no_observed_job')
        proof['diagnostic']=request_music_diagnostic(key,observed['receipts'][0]);proof['ok']=True
    finally:
        (out/'diagnostic.json').write_text(json.dumps(proof,ensure_ascii=False,indent=2)+'\n')
    print('N80_MUSIC_READ_ONLY_DIAGNOSTIC',json.dumps(proof,ensure_ascii=False))
if __name__=='__main__':main()
