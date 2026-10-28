"""Additive schema with baseline cursors, never backfill old activity into new alerts."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect
def main():
 token=secrets.token_hex(32);name='channel-bind-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_channel_control.php').read_text().replace('NOA_NOTIFICATION_EXPIRY',str(int(time.time())+600)).replace('NOA_NOTIFICATION_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
 t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   with s.open(ROOT+'/noa-bridge/channel-ownership.php','rb') as f:assert f.read()==Path('bridge/channel-ownership.php').read_bytes()
   try:
    with s.open(remote,'wx') as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb') as f:assert f.read()==code
    results=[]
    for mode in [False,True,True]:
     req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps({'apply':mode}).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token})
     with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as r:data=json.load(r)
     assert data['ok'] and data['nativeTablesWritten']==0
     if mode:assert data['contentPreserved'] and data['listed']>=data['linked']
     if len(results)==2:assert data['updated']==0 and not data['channelCreated']
     results.append(data)
    Path('channel-proof').mkdir(exist_ok=True);Path('channel-proof/activation.json').write_text(json.dumps(results,indent=2));print('CHANNEL_OWNERSHIP_VERIFIED',json.dumps(results[-1]))
   finally:
    if installed:
     with s.open(remote,'rb') as f:assert f.read()==code
     s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
