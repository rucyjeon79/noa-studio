"""Anonymous live HTTP checks. Never fabricate a production identity or private post."""
import json,urllib.request,urllib.error
from pathlib import Path
from n80_live_observer import NoRedirect
base='https://noastudio.ai.kr'
checks=[]
def get(path):
 try:r=urllib.request.build_opener(NoRedirect()).open(urllib.request.Request(base+path,headers={'Cache-Control':'no-cache'}),timeout=40)
 except urllib.error.HTTPError as e:r=e
 with r:return r.status,r.headers,r.read().decode('utf-8')
status,headers,body=get('/');assert status==200 and 'data-home-section="hero"' in body and 'data-home-section="notices"' in body
checks.append({'path':'/','status':status,'homeAndNoticePresent':True})
for path in ['/noa-bridge/community.php?board=song_request','/noa-bridge/community.php?board=free']:
 status,headers,body=get(path)
 try:data=json.loads(body)
 except json.JSONDecodeError:raise RuntimeError('anonymous_api_not_json:'+str(status)+':'+repr(body[:400]))
 assert status==401 and data['error']=='login_required' and 'no-store' in headers.get('Cache-Control','')
 checks.append({'path':path,'status':status,'guestDenied':True})
for path in ['/bbs/board.php?bo_table=song_request','/bbs/download.php?bo_table=song_request&wr_id=1','/bbs/rss.php?bo_table=song_request']:
 status,headers,body=get(path);assert status==403 and 'no-store' in headers.get('Cache-Control','')
 checks.append({'path':path,'status':status,'nativePrivateRouteDenied':True})
Path('community-proof/live-anonymous.json').write_text(json.dumps({'ok':True,'checks':checks,'productionTestPostsCreated':0,'productionAuthImpersonation':False},ensure_ascii=False,indent=2))
print('COMMUNITY_LIVE_ANONYMOUS_PRIVACY_OK',len(checks))
