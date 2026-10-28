"""Apply the user's one exact creator price; export only aggregates, never member records."""
import hashlib,json,secrets,time,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
from noa_ainoa_deploy import check_current_candidate
check_current_candidate()
token=secrets.token_hex(32);name='premium-policy-'+secrets.token_hex(8)+'.php'
code=Path('scripts/noa_premium_policy.php').read_text().replace('NOA_CONTROL_EXPIRY',str(int(time.time())+600)).replace('NOA_CONTROL_TOKEN_SHA',hashlib.sha256(token.encode()).hexdigest()).encode()
t=connect()
try:
 with paramiko.SFTPClient.from_transport(t) as s:
  s.get_channel().settimeout(45);path=ROOT+'/noa-bridge/'+name
  with s.open(path,'wx') as f:f.write(code)
  s.chmod(path,0o644)
  try:
   with s.open(path,'rb') as f:assert f.read()==code
   req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps({'approvedPolicy':'NOA-20261028-PREMIUM-1000-50-CREATOR-5000'}).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token})
   with urllib.request.urlopen(req,timeout=120) as r:d=json.load(r)
   assert d['ok'];Path('ainoa-proof/premium-policy.json').write_text(json.dumps(d,indent=2));print('PREMIUM_POLICY_VERIFIED',json.dumps(d))
  finally:
   with s.open(path,'rb') as f:current=f.read()
   if current==code:s.remove(path)
   else:raise RuntimeError('changed_helper_preserved')
finally:t.close()
