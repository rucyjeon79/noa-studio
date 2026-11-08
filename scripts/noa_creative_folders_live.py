"""One-time readable-folder migration through the existing N80 media writer."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
    token=secrets.token_hex(32);name='creative-folders-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
    code=Path('scripts/noa_creative_folders_live.php').read_text()
    for key,value in {'__EXPIRY__':str(int(time.time())+900),'__TOKEN_SHA__':hashlib.sha256(token.encode()).hexdigest()}.items():code=code.replace(key,value)
    code=code.encode();t=connect();installed=False
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30)
            with s.open(remote,'wx') as f:f.write(code)
            installed=True;s.chmod(remote,0o644)
            with s.open(remote,'rb') as f:
                if f.read()!=code:raise RuntimeError('retention_probe_readback')
        receipts=[]
        for attempt in range(50):
            request=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token,'Cache-Control':'no-cache'})
            with urllib.request.build_opener(NoRedirect()).open(request,timeout=60) as response:data=json.load(response)
            if not data.get('ok'):raise RuntimeError('folder_migration_failed:'+str(data.get('error')))
            result=data['result'];receipts.append(result)
            out=Path('ainoa-proof');out.mkdir(exist_ok=True);(out/'creative-folders.json').write_text(json.dumps(receipts,ensure_ascii=False,indent=2))
            print('CREATIVE_FOLDERS_VERIFIED',json.dumps(result,ensure_ascii=False),flush=True)
            if result['remaining']==0:break
            if result['changed']==0:raise RuntimeError('folder_migration_deferred_for_active_upload')
        else:raise RuntimeError('folder_migration_batch_limit')
    finally:
        if installed:
            with paramiko.SFTPClient.from_transport(t) as s:
                with s.open(remote,'rb') as f:
                    if f.read()!=code:raise RuntimeError('concurrent_probe_preserved')
                s.remove(remote)
        t.close()

if __name__=='__main__':main()
