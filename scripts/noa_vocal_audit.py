"""Run the bounded record audit with a short-lived authenticated helper."""
import hashlib,json,secrets,time,urllib.request,urllib.parse
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
token=secrets.token_hex(32);name='noa-bridge/vocal-audit-'+secrets.token_hex(8)+'.php'
raw=Path('scripts/noa_vocal_audit.php').read_text().replace('__EXPIRY__',str(int(time.time())+600)).replace('__TOKEN_SHA__',hashlib.sha256(token.encode()).hexdigest()).encode()
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30);installed=False
try:
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('wrong_root')
 with s.open(ROOT+'/'+name,'wx')as f:f.write(raw)
 installed=True;s.chmod(ROOT+'/'+name,0o644)
 with s.open(ROOT+'/'+name,'rb')as f:
  if f.read()!=raw:raise RuntimeError('helper_mismatch')
 req=urllib.request.Request('https://noastudio.ai.kr/'+name,data=b'audit=1',headers={'X-NOA-Diagnostic':token,'Content-Type':'application/x-www-form-urlencoded'})
 with urllib.request.urlopen(req,timeout=210)as r:d=json.load(r)
 if not d.get('ok'):raise RuntimeError(json.dumps(d))
 print('SONG_RECORD_AUDIT '+json.dumps(d,ensure_ascii=False),flush=True)
finally:
 try:
  if installed:
   with s.open(ROOT+'/'+name,'rb')as f:current=f.read()
   if current!=raw:raise RuntimeError('helper_changed')
   s.remove(ROOT+'/'+name);print('AUDIT_HELPER_REMOVED',flush=True)
 finally:s.close();t.close()
