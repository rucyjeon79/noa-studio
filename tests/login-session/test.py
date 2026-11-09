"""Exercise actual PHP cookies/storage, browser restart, expiration, migration and logout."""
import http.cookiejar,json,os,secrets,socket,subprocess,tempfile,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as td:
 root=Path(td);(root/'legacy').mkdir();(root/'private').mkdir()
 with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
 env=os.environ|{'N80_SESSION_TEST_ROOT':td,'N80_SESSION_MODULE':str(ROOT/'deploy/noa-app/engine/session-policy.php')}
 server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}',str(ROOT/'tests/login-session/http.php')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 base=f'http://127.0.0.1:{port}/'
 jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
 def call(op='',opener=client,headers=None):
  with opener.open(urllib.request.Request(base+'?op='+op,headers=headers or {}),timeout=10) as r:return json.load(r),r.headers
 try:
  for i in range(100):
   try:guest,h=call();break
   except OSError:time.sleep(.05)
  else:raise AssertionError('fixture server unavailable')
  assert not guest['member'] and guest['private'] and guest['ttl']==604800
  assert sum(c.startswith('PHPSESSID=') for c in h.get_all('Set-Cookie'))==1
  assert next(c for c in jar if c.name=='PHPSESSID').discard
  logged,h=call('login');assert logged['member']
  cookie=next(c for c in jar if c.name=='PHPSESSID');sid=cookie.value
  assert not cookie.discard and 604700<cookie.expires-time.time()<=604800
  assert 'HttpOnly' in cookie._rest and cookie._rest.get('SameSite')=='Lax'
  assert any(c.name=='unrelated' for c in jar)
  jar.clear_session_cookies();assert call()[0]['member'],'browser restart must retain authenticated cookie'
  recent=root/'private'/('sess_'+sid);os.utime(recent,(time.time()-14400,)*2)
  stale=root/'private'/('sess_'+secrets.token_hex(16));stale.write_text('');os.utime(stale,(time.time()-8*86400,)*2)
  assert call('gc')[0]['member'] and recent.exists() and not stale.exists()
  assert not call('logout')[0]['member'];assert not any(c.name=='PHPSESSID' for c in jar)
  assert not call(headers={'Cookie':'PHPSESSID='+sid})[0]['member'],'logged-out cookie cannot authenticate'
  oldid=secrets.token_hex(16);old=root/'legacy'/('sess_'+oldid);old.write_text('ss_mb_id|s:7:"fixture";')
  assert call(headers={'Cookie':'PHPSESSID='+oldid})[0]['member'],'live legacy session imports once'
  assert call('logout',headers={'Cookie':'PHPSESSID='+oldid})[0]['member'] is False
  assert not call(headers={'Cookie':'PHPSESSID='+oldid})[0]['member'],'old source cannot resurrect logout'
  expiredid=secrets.token_hex(16);expired=root/'legacy'/('sess_'+expiredid);expired.write_text('ss_mb_id|s:7:"fixture";');os.utime(expired,(time.time()-14400,)*2)
  assert not call(headers={'Cookie':'PHPSESSID='+expiredid})[0]['member'],'expired old session is not revived'
  print('SESSION_COOKIE_RESTART_7_DAY_GC_MIGRATION_LOGOUT_REPLAY_OK')
 finally:server.terminate();server.wait(timeout=10)
