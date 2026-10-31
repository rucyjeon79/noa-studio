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
 if not data.get('ok'):raise RuntimeError('invalid_diagnostic')
 print('COMMUNITY_DIAGNOSTIC',json.dumps(data,ensure_ascii=False))
finally:
 try:
  if installed:
   with s.open(ROOT+'/'+name,'rb')as f:current=f.read()
   if current!=raw:raise RuntimeError('helper_changed_preserved')
   s.remove(ROOT+'/'+name);print('COMMUNITY_DIAGNOSTIC_HELPER_REMOVED')
 finally:s.close();t.close()

req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/community.php',data=b'{"action":"comment"}',headers={'Content-Type':'application/json','Origin':'https://noastudio.ai.kr'})
with urllib.request.urlopen(req,timeout=30)as response:
 result=json.load(response)
 assert result['ok'] is False and result['error']=='login_required' and result['status']==401
print('LIVE_JSON_AUTH_ERROR_ENVELOPE_OK')

with urllib.request.urlopen('https://noastudio.ai.kr/noa-bridge/support.php?action=quote&type=music&key=invalid',timeout=30)as response:
 result=json.load(response)
 assert result['ok'] is False and result['error']=='login_required' and result['status']==401
print('LIVE_SUPPORT_JSON_ERROR_ENVELOPE_OK')
