"""Idempotently activate only the reviewed, new private native board."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect
def main():
 token=secrets.token_hex(32);name='community-setup-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_community_control.php').read_text().replace('NOA_COMMUNITY_EXPIRY',str(int(time.time())+600)).replace('NOA_COMMUNITY_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
 t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t)as s:
   s.get_channel().settimeout(45)
   # Access guards must be deployed before the board can accept any private content.
   for target,source in [('extend/noa.01-community.php','deploy/noa-community.extend.php'),('noa-bridge/community-core.php','bridge/community-core.php'),('noa-bridge/community.php','bridge/community.php'),('noa-bridge/community-install.php','bridge/community-install.php')]:
    with s.open(ROOT+'/'+target,'rb')as f:assert f.read()==Path(source).read_bytes(),'reviewed source required before activation'
   try:
    with s.open(remote,'wx')as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb')as f:assert f.read()==code
    results=[]
    for replay in [False,True]:
     req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
     with urllib.request.build_opener(NoRedirect()).open(req,timeout=60)as r:data=json.load(r)
     assert data['ok']and data['secretRequired']and data['readLevel']==10 and data['commentLevel']==10 and not data['searchEnabled']and not data['rssEnabled']
     if replay:assert not data['created']
     results.append(data)
    out=Path('community-proof');out.mkdir(exist_ok=True);(out/'board-activation.json').write_text(json.dumps(results,ensure_ascii=False,indent=2));print('PRIVATE_NATIVE_BOARD_ACTIVATED',json.dumps(results[-1],ensure_ascii=False))
   finally:
    if installed:
     with s.open(remote,'rb')as f:assert f.read()==code
     s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
