"""Atomically publish a complete public catalog; never alter member/shop DB rows."""
import json,os,stat,hashlib,urllib.request
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime,timezone

def validate(d):
 assert d.get('version')==1 and d.get('complete') is True
 rows=d.get('products');assert isinstance(rows,list) and 0<len(rows)<=10000 and len(rows)==d.get('count')
 ts=datetime.fromisoformat(d['checkedAt'].replace('Z','+00:00'));assert abs((datetime.now(timezone.utc)-ts).total_seconds())<3600,'Expired collection'
 seen=set()
 for p in rows:
  pid=p.get('id','');assert isinstance(pid,str) and pid.isdigit() and pid not in seen;seen.add(pid)
  assert p.get('url')=='https://marpple.shop/kr/jr_lifestyle/products/'+pid
  assert isinstance(p.get('priceWon'),int) and not isinstance(p['priceWon'],bool) and 0<p['priceWon']<100000000
  assert isinstance(p.get('title'),str) and 0<len(p['title'])<=200
  for image in [p['image'],*p['images']]:
   u=urlparse(image);assert u.scheme=='https' and u.hostname in ('common.image.cf.marpple.co','s3.marpple.co') and not u.username and not u.password and not u.port
 return d

def publish():
 import paramiko
 from noa_full_inventory import connect,ROOT
 from noa_ainoa_deploy import check_current_candidate
 d=validate(json.loads(Path('marpple-proof/catalog.json').read_text()));data=json.dumps(d,ensure_ascii=False,separators=(',',':')).encode()
 check_current_candidate()
 t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
 path=ROOT+'/data/noa-marpple-catalog.json';temp=path+'.'+os.environ['GITHUB_RUN_ID']+'.tmp';old=None;activated=False
 try:
  try:
   assert stat.S_ISREG(s.lstat(path).st_mode),'Unexpected catalog target'
   with s.open(path,'rb')as f:old=f.read()
  except FileNotFoundError:pass
  if old:
   previous=json.loads(old)
   assert d['count']>=max(1,previous['count']//2),'Unexpected inventory collapse; previous snapshot retained'
   assert d['checkedAt']>=previous['checkedAt'],'Outdated collection; previous snapshot retained'
  with s.open(temp,'wb')as f:f.write(data)
  s.chmod(temp,0o644)
  s.posix_rename(temp,path);activated=True
  with s.open(path,'rb')as f:assert f.read()==data
  request=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/ecosystem.php?action=shop&sync='+os.environ['GITHUB_RUN_ID'],headers={'Cache-Control':'no-cache'})
  with urllib.request.urlopen(request,timeout=30)as r:live=json.load(r)
  assert live.get('ok') and live.get('sync',{}).get('checkedAt')==d['checkedAt'],'Live catalog projection mismatch'
  assert live['sync']['count']==d['count']
  assert all(p['id'] in {r['id']for r in d['products']} for p in live['products'])
  print('MARPPLE_SYNC_PUBLISHED '+json.dumps({'count':d['count'],'visible':len(live['products']),'checkedAt':d['checkedAt'],'databaseWrites':0,'sha256':hashlib.sha256(data).hexdigest()}))
 except Exception:
  if activated:
   with s.open(path,'rb')as f:current=f.read()
   if current==data:
    if old is None:s.remove(path)
    else:
     with s.open(temp,'wb')as f:f.write(old)
     s.chmod(temp,0o644);s.posix_rename(temp,path)
  raise
 finally:
  try:s.remove(temp)
  except FileNotFoundError:pass
  t.close()
if __name__=='__main__':publish()
