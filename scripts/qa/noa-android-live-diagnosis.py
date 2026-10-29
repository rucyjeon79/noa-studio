import sys,time,json,urllib.request,urllib.error,hashlib
from pathlib import Path
sys.path.insert(0,'scripts')
import noa_android_member_qa as qa
qa.main('prepare')
try:
 cookie=qa.COOKIE.read_text().strip()
 def get(path,media=False):
  url=path if path.startswith('https://noastudio.ai.kr/') else qa.BASE+path if path.startswith('/') else ''
  if not url: return {'error':'unexpected URL'}
  headers={'Cookie':cookie,'Cache-Control':'no-cache'}
  if media:headers['Range']='bytes=0-65535'
  start=time.monotonic()
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=45) as r:
    data=r.read(65536 if media else 4000000)
    return {'status':r.status,'type':r.headers.get('Content-Type'),'bytes':len(data),'seconds':round(time.monotonic()-start,2),'data':data}
  except urllib.error.HTTPError as e:return {'status':e.code,'seconds':round(time.monotonic()-start,2)}
  except Exception as e:return {'error':type(e).__name__,'seconds':round(time.monotonic()-start,2)}
 cat=get('/noa-bridge/catalog.php')
 print('CATALOG',json.dumps({k:v for k,v in cat.items() if k!='data'}))
 rows=json.loads(cat['data'])['items']
 chosen=[r for r in rows if r.get('genre')=='kpop-original' and str(r.get('ep')).lstrip('0') in ['1','2','3','4','5','6']]
 for row in chosen:
  for field in ['audioUrl','coverImageUrl']:
   url=row.get(field)
   if not url:print('MEDIA',json.dumps({'key':row['key'],'field':field,'missing':True}));continue
   result=get(url,True);result.pop('data',None)
   print('MEDIA',json.dumps({'key':row['key'],'field':field,**result}))
 for path in ['/noa-music.php','/noa-ainoa.php?action=status','/noa-category-order.php']:
  result=get(path);result.pop('data',None);print('PAGE',path,json.dumps(result))
finally:
 for attempt in range(3):
  try:qa.main('cleanup');break
  except (TimeoutError,urllib.error.URLError):
   if attempt==2:raise
