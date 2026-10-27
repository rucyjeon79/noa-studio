"""Additive schema with baseline cursors, never backfill old activity into new alerts."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect
def main():
 token=secrets.token_hex(32);name='notifications-setup-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_notifications_control.php').read_text().replace('NOA_NOTIFICATION_EXPIRY',str(int(time.time())+600)).replace('NOA_NOTIFICATION_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
 t=connect();installed=False
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   with s.open(ROOT+'/noa-bridge/notifications-core.php','rb') as f:assert f.read()==Path('bridge/notifications-core.php').read_bytes()
   try:
    with s.open(remote,'wx') as f:f.write(code)
    installed=True;s.chmod(remote,0o644)
    with s.open(remote,'rb') as f:assert f.read()==code
    results=[]
    for replay in [False,True]:
     req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=b'{}',headers={'Content-Type':'application/json','X-NOA-Control':token})
     with urllib.request.build_opener(NoRedirect()).open(req,timeout=45) as r:data=json.load(r)
     assert data['ok'] and data['ready'] and data['nativeTablesWritten']==0
     if replay:assert not data['created']
     results.append(data)
    Path('notifications-proof').mkdir(exist_ok=True);Path('notifications-proof/activation.json').write_text(json.dumps(results,indent=2));print('NOTIFICATION_ADDITIVE_SCHEMA_READY',json.dumps(results[-1]))
   finally:
    if installed:
     with s.open(remote,'rb') as f:assert f.read()==code
     s.remove(remote)
 finally:t.close()
if __name__=='__main__':main()
