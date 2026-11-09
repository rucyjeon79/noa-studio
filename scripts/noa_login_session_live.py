"""Runner-owned real login proves migration, browser restart, logout and replay safety."""
import hashlib,http.cookiejar,json,os,secrets,sys,time,urllib.parse,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
BASE='https://noastudio.ai.kr'
TEMP=Path(os.environ.get('RUNNER_TEMP','/tmp'))
STATE=TEMP/'noa-login-check.json';COOKIES=TEMP/'noa-login-check.cookies'
UA='Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36'
def save(path,data):
 fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
 with os.fdopen(fd,'w') as f:f.write(data)
def client(jar=None):
 o=urllib.request.build_opener(*([urllib.request.HTTPCookieProcessor(jar)] if jar is not None else []));o.addheaders=[('User-Agent',UA),('Cache-Control','no-cache')];return o
def call(o,path,data=None,headers=None):
 with o.open(urllib.request.Request(BASE+path,data=data,headers=headers or {}),timeout=45) as r:return r.read().decode(),r.headers,r.url

def main(phase):
 if phase=='cleanup' and not STATE.exists():return
 if phase=='prepare':
  nonce=secrets.token_hex(6);password=secrets.token_urlsafe(36);token=secrets.token_hex(32)
  state={'helper':'noa-bridge/login-check-'+nonce+'.php','id':'nqa'+nonce+'a','token':token,'installed':False,'created':False}
  source=Path('scripts/noa_member_qa_control.php').read_text()
  for k,v in {'__QA_EXPIRY__':str(int(time.time())+1800),'__QA_TOKEN_HASH__':hashlib.sha256(token.encode()).hexdigest(),'__QA_ID_A__':state['id'],'__QA_ID_B__':'nqa'+nonce+'b','__QA_NONCE__':nonce,'__QA_AUDIO_SHA__':'0'*64}.items():source=source.replace(k,v)
  raw=source.encode();state['sha']=hashlib.sha256(raw).hexdigest();save(STATE,json.dumps(state))
 else:state=json.loads(STATE.read_text())
 def control(action,**values):
  body,_,_=call(client(),'/'+state['helper'],json.dumps({'action':action,'owner':0,**values}).encode(),{'X-NOA-QA':state['token'],'Content-Type':'application/json'})
  if not json.loads(body).get('ok'):raise RuntimeError('login_fixture_'+action+'_failed')
 if phase=='prepare':
  t=connect()
  try:
   with paramiko.SFTPClient.from_transport(t) as s:
    with s.open(ROOT+'/'+state['helper'],'wx') as f:f.write(raw)
    s.chmod(ROOT+'/'+state['helper'],0o644);state['installed']=True;save(STATE,json.dumps(state))
  finally:t.close()
  control('setup',password=password);state['created']=True;save(STATE,json.dumps(state));control('level',level=2)
  jar=http.cookiejar.LWPCookieJar(str(COOKIES));o=client(jar)
  call(o,'/noa-login.php');call(o,'/bbs/login_check.php',urllib.parse.urlencode({'mb_id':state['id'],'mb_password':password,'url':'/'}).encode(),{'Content-Type':'application/x-www-form-urlencoded','Referer':BASE+'/noa-login.php'})
  html,_,url=call(o,'/noa-my.php');assert urllib.parse.urlsplit(url).path=='/noa-my.php','native_login_failed'
  session=next(c for c in jar if c.name=='PHPSESSID');state['sid']=session.value;save(STATE,json.dumps(state));jar.save(ignore_discard=True);os.chmod(COOKIES,0o600)
  print('NATIVE_LOGIN_BEFORE_ACTIVATION_OK')
 elif phase=='verify':
  jar=http.cookiejar.LWPCookieJar(str(COOKIES));jar.load(ignore_discard=True);o=client(jar)
  _,h,url=call(o,'/noa-my.php');assert urllib.parse.urlsplit(url).path=='/noa-my.php','existing_login_lost'
  sessions=[c for c in jar if c.name=='PHPSESSID'];assert len(sessions)==1
  c=sessions[0];assert c.value==state['sid'],'migration_changed_session_identity'
  assert not c.discard and 604600<c.expires-time.time()<=604800 and c.secure and 'HttpOnly' in c._rest
  assert sum(v.startswith('PHPSESSID=') for v in h.get_all('Set-Cookie',[]))==1
  jar.clear_session_cookies();_,_,url=call(o,'/noa-my.php');assert urllib.parse.urlsplit(url).path=='/noa-my.php'
  _,_,url=call(o,'/noa-login.php');assert urllib.parse.urlsplit(url).path=='/','logged_in_login_route_must_return_home'
  call(o,'/bbs/logout.php?url=%2F');assert not any(c.name=='PHPSESSID' and c.value==state['sid'] for c in jar)
  _,_,url=call(client(),'/noa-my.php',headers={'Cookie':'PHPSESSID='+state['sid']});assert urllib.parse.urlsplit(url).path=='/noa-login.php','logout_session_replay'
  html,_,_=call(client(),'/noa-login.php');assert html.count('target="_top"')>=3
  result={'existingLoginMigrated':True,'persistentDays':7,'browserRestartRetained':True,'oneSessionCookie':True,'logoutReplayRejected':True,'loggedInReturnsHome':True,'sameWindowLogin':True,'physicalAndroidVerified':False}
  out=Path('login-proof');out.mkdir(exist_ok=True);(out/'live.json').write_text(json.dumps(result,indent=2));print('LOGIN_CONTINUITY_LIVE_VERIFIED',json.dumps(result))
 elif phase=='cleanup':
  if state['installed']:
   control('cleanup')
   t=connect()
   try:
    with paramiko.SFTPClient.from_transport(t) as s:
     with s.open(ROOT+'/'+state['helper'],'rb') as f:assert hashlib.sha256(f.read()).hexdigest()==state['sha']
     s.remove(ROOT+'/'+state['helper'])
   finally:t.close()
  COOKIES.unlink(missing_ok=True);STATE.unlink();print('LOGIN_QA_ACCOUNT_AND_HELPER_REMOVED')
 else:raise ValueError('invalid phase')
if __name__=='__main__':main(sys.argv[1])
