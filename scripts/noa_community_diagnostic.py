"""Read installed database adapter source; no data or application mutation."""
import paramiko
from noa_full_inventory import connect,ROOT
t=connect()
try:
 with paramiko.SFTPClient.from_transport(t) as s:
  with s.open(ROOT+'/lib/common.lib.php','rb') as f:src=f.read().decode('utf-8',errors='replace')
  for name in ['delete_cache_latest']:
   start=src.index('function '+name+'(');end=src.find('\nfunction ',start+10);print(src[start:end])
  with s.open(ROOT+'/common.php','rb') as f:common=f.read().decode('utf-8',errors='replace')
  lines=common.splitlines()
  for i,line in enumerate(lines):
   if any(x in line for x in ['POST','CONTENT_TYPE','json','die(','exit','alert(']):print('COMMON',i+1,'\n'.join(lines[max(0,i-2):i+3]))
finally:t.close()

import urllib.request,urllib.error,json
for payload in [dict(action='comment',id=1,body='reply',musicKey='catalog:'+'a'*64,requestId='11111111-1111-4111-8111-111111111111')]:
 try:
  r=urllib.request.urlopen(urllib.request.Request('https://noastudio.ai.kr/noa-bridge/community.php',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json','Origin':'https://noastudio.ai.kr'}),timeout=30)
 except urllib.error.HTTPError as e:r=e
 print('ANONYMOUS_POST',r.status,r.read(500).decode(errors='replace'))
