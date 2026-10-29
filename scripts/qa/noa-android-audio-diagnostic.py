"""Diagnose member catalog/audio authorization without changing music policy."""
import sys,json,urllib.request,urllib.error
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import noa_android_member_qa as qa
try:
    qa.main('prepare')
    cookie=qa.COOKIE.read_text()
    state=json.loads(qa.STATE.read_text())
    status,body=qa.request(urllib.request.build_opener(),'/'+state['helper'],json.dumps({'action':'subscription_state','owner':0}).encode(),{'X-NOA-QA':state['token'],'Content-Type':'application/json'})
    print('QA_ENTITLEMENT '+body.decode())
    qa.control(state,'subscription_fixture',active=True)

    def probe(url, agent):
        req=urllib.request.Request(url,headers={'Cookie':cookie,'Range':'bytes=0-0','User-Agent':agent,'Cache-Control':'no-cache'})
        try:
            with urllib.request.urlopen(req,timeout=60) as r:return r.status,dict(r.headers),r.read(512)
        except urllib.error.HTTPError as e:return e.code,dict(e.headers),e.read(512)
    req=urllib.request.Request(qa.BASE+'/noa-bridge/catalog.php',headers={'Cookie':cookie})
    with urllib.request.urlopen(req,timeout=60) as r:items=json.load(r)['items']
    rows=[x for x in items if x.get('audioVerified') and x.get('audioUrl','').startswith(qa.BASE+'/')]
    for row in rows[:2]:
        for agent in ('Python-urllib/3.12','okhttp/4.12.0'):
            status,headers,body=probe(row['audioUrl'],agent)
            print(json.dumps({'key':row['key'],'path':row['audioUrl'].removeprefix(qa.BASE),'agent':agent,'status':status,'access':headers.get('X-NOA-Access'),'contentType':headers.get('Content-Type'),'responseBytes':len(body)}))
finally:qa.main('cleanup')
