"""Short-lived fixed read-only collection diagnostic, removed after readback."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
token=secrets.token_hex(32);name='noa-bridge/community-check-'+secrets.token_hex(8)+'.php'
raw=Path('scripts/noa_community_diagnostic.php').read_text().replace('__EXPIRY__',str(int(time.time())+300)).replace('__TOKEN_SHA__',hashlib.sha256(token.encode()).hexdigest()).encode()
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30);installed=False
try:
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('wrong_root')
 with s.open(ROOT+'/'+name,'wx')as f:f.write(raw)
 installed=True;s.chmod(ROOT+'/'+name,0o644)
 with s.open(ROOT+'/'+name,'rb')as f:
  if f.read()!=raw:raise RuntimeError('helper_readback_mismatch')
 req=urllib.request.Request('https://noastudio.ai.kr/'+name,headers={'X-NOA-Diagnostic':token})
 with urllib.request.urlopen(req,timeout=45)as r:data=json.load(r)
 if not data.get('ok')or data.get('databaseWrites')!=0:raise RuntimeError('invalid_diagnostic')
 print('COMMUNITY_DIAGNOSTIC',json.dumps(data,ensure_ascii=False))
finally:
 try:
  if installed:
   with s.open(ROOT+'/'+name,'rb')as f:current=f.read()
   if current!=raw:raise RuntimeError('helper_changed_preserved')
   s.remove(ROOT+'/'+name);print('COMMUNITY_DIAGNOSTIC_HELPER_REMOVED')
 finally:s.close();t.close()
