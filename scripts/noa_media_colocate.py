"""Bounded no-backup retention cleanup explicitly authorized on 2026-10-30."""
import hashlib,json,secrets,time,urllib.request,urllib.parse
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
PLAN='AUDIT'
token=secrets.token_hex(32);name='noa-bridge/media-colocate-'+secrets.token_hex(8)+'.php'
raw=Path('scripts/noa_media_colocate.php').read_text().replace('__EXPIRY__',str(int(time.time())+600)).replace('__TOKEN_SHA__',hashlib.sha256(token.encode()).hexdigest()).replace('__PLAN_SHA__',PLAN).encode()
t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30);installed=False
try:
 if s.normalize(ROOT)!=ROOT:raise RuntimeError('wrong_root')
 with s.open(ROOT+'/'+name,'wx')as f:f.write(raw)
 installed=True;s.chmod(ROOT+'/'+name,0o644)
 with s.open(ROOT+'/'+name,'rb')as f:
  if f.read()!=raw:raise RuntimeError('helper_mismatch')
 req=urllib.request.Request('https://noastudio.ai.kr/'+name,data=None if PLAN=='AUDIT' else b'apply=1',headers={'X-NOA-Diagnostic':token,'Content-Type':'application/x-www-form-urlencoded'})
 with urllib.request.urlopen(req,timeout=210)as r:d=json.load(r)
 if not d.get('ok'):raise RuntimeError(json.dumps(d))
 if PLAN!='AUDIT':
  from concurrent.futures import ThreadPoolExecutor
  def check(row):
   with urllib.request.urlopen(row['url'],timeout=45)as response:
    data=response.read();mime=response.headers.get_content_type()
   if len(data)!=row['bytes'] or hashlib.sha256(data).hexdigest()!=row['sha256'] or mime!='image/webp':raise RuntimeError('cover_http_mismatch')
   return True
  with ThreadPoolExecutor(max_workers=4)as pool:d['httpVerified']=sum(pool.map(check,d['httpChecks']))
 print('MEDIA_COLOCATE_RESULT '+json.dumps(d,ensure_ascii=False),flush=True)
finally:
 try:
  if installed:
   with s.open(ROOT+'/'+name,'rb')as f:current=f.read()
   if current!=raw:raise RuntimeError('helper_changed')
   s.remove(ROOT+'/'+name);print('MEDIA_COLOCATE_HELPER_REMOVED',flush=True)
 finally:s.close();t.close()
