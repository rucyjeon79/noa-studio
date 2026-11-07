"""Additive recovery-index migration and bounded production checks; no user content is deleted."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main(phase):
    if phase not in ('prepare','verify'):raise ValueError('invalid phase')
    token=secrets.token_hex(32);name='creative-retention-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
    core=Path('bridge/creative-core.php').read_text();schema=core[core.index('function ncd_schema('):core.index('function ncd_id(')]
    code=Path('scripts/noa_creative_retention.php').read_text()
    for key,value in {'__EXPIRY__':str(int(time.time())+600),'__TOKEN_SHA__':hashlib.sha256(token.encode()).hexdigest(),'__DRAFT_ID__':secrets.token_hex(16),'__SCHEMA__':schema}.items():code=code.replace(key,value)
    code=code.encode();t=connect();installed=False
    try:
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(30)
            with s.open(remote,'wx') as f:f.write(code)
            installed=True;s.chmod(remote,0o644)
            with s.open(remote,'rb') as f:
                if f.read()!=code:raise RuntimeError('retention_probe_readback')
        request=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps({'phase':phase}).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token,'Cache-Control':'no-cache'})
        with urllib.request.build_opener(NoRedirect()).open(request,timeout=45) as response:data=json.load(response)
        if not data.get('ok'):raise RuntimeError('retention_probe_failed:'+str(data.get('error')))
        out=Path('ainoa-proof');out.mkdir(exist_ok=True);(out/('creative-retention-'+phase+'.json')).write_text(json.dumps(data['result'],indent=2))
        print('CREATIVE_RETENTION_'+phase.upper(),json.dumps(data['result']),flush=True)
    finally:
        if installed:
            with paramiko.SFTPClient.from_transport(t) as s:
                with s.open(remote,'rb') as f:
                    if f.read()!=code:raise RuntimeError('concurrent_probe_preserved')
                s.remove(remote)
        t.close()
