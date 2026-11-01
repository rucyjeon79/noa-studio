"""Temporary authenticated read-only owner and media projection receipt; removed in finally."""
import hashlib,json,secrets,time,urllib.request,urllib.parse
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
 token=secrets.token_hex(32);name='cover-master-probe-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_cover_master_probe.php').read_text().replace('NOA_CREATOR_EXPIRY',str(int(time.time())+600)).replace('NOA_CREATOR_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode();t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   try:
    with s.open(remote,'wx') as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb') as f:assert f.read()==code
    req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
    with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as r:data=json.load(r)
    print('COVER_MASTER_RECEIPT',json.dumps(data),flush=True)
   finally:
    if installed:s.remove(remote)
 finally:t.close()

if __name__=='__main__':main()
