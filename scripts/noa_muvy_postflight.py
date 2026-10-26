"""Anonymous live deny checks plus key-presence booleans; no paid generation or identity creation."""
import hashlib,json,urllib.request,urllib.error
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect
checks=[]
for path in ['/noa-ai-lab.php','/noa-bridge/muvy.php','/noa-muvy-panel.php']:
 try:r=urllib.request.build_opener(NoRedirect()).open('https://noastudio.ai.kr'+path,timeout=40)
 except urllib.error.HTTPError as e:r=e
 with r:status=r.status;body=r.read().decode('utf-8')
 assert status in [302,401,403] and 'id="mu-key"'not in body and '"projects"'not in body
 checks.append({'path':path,'status':status,'guestDenied':True})
# Existing private state stays private. Read only nonsecret settings, never export credentials.
t=connect()
try:
 with paramiko.SFTPClient.from_transport(t)as s:
  s.get_channel().settimeout(45)
  with s.open('/hosting/noastudio/noa-ai-lab/state.json','rb')as f:state=json.loads(f.read())
  config=state.get('muvyConfig',{})
  setup={'enabled':config.get('enabled',False),'model':config.get('model','grok-4.5'),'dailyCalls':config.get('dailyCalls',20)}
finally:t.close()
Path('muvy-proof/live-access.json').write_text(json.dumps({'ok':True,'checks':checks,'settings':setup,'paidProviderCalls':0,'memberRowsModified':0,'authenticatedLiveSessionTest':False},indent=2))
print('MUVY_LIVE_PRIVATE_WORKROOM_INSTALLED',json.dumps(setup))
