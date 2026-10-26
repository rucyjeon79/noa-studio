"""Execute the real endpoint under PHP with a slow disposable DB connection.

The second request shares an authenticated session and must not wait for the
first status read. No production login, database, or music files are used.
"""
import concurrent.futures,json,os,shutil,subprocess,tempfile,time,urllib.request,urllib.error
from pathlib import Path

with tempfile.TemporaryDirectory(prefix='noa-status-session-') as tmp:
 root=Path(tmp);(root/'noa-app').mkdir();(root/'noa-bridge').mkdir()
 shutil.copytree('deploy/noa-app/jukebox',root/'noa-app/jukebox')
 (root/'common.php').write_text("<?php define('_GNUBOARD_',true);session_start();if(($_GET['auth']??'')==='fixture')$_SESSION['admin']=true;$is_member=!empty($_SESSION['admin']);$is_admin=$is_member?'super':'';$_SESSION['noa_jukebox_csrf']='fixture-csrf';")
 (root/'noa-bridge/sound-core.php').write_text('<?php')
 marker=root/'db-started'
 (root/'noa-bridge/storage.php').write_text("<?php function noa_bridge_pdo(){file_put_contents("+json.dumps(str(marker))+",'1');usleep(1800000);return new PDO('sqlite::memory:');}")
 (root/'probe.php').write_text("<?php require __DIR__.'/common.php';header('Content-Type: application/json');echo json_encode(['admin'=>$is_member,'csrf'=>$_SESSION['noa_jukebox_csrf']]);")
 log=open(root/'php.log','w');server=subprocess.Popen(['php','-S','127.0.0.1:8127','-t',tmp],env={**os.environ,'PHP_CLI_SERVER_WORKERS':'4'},stdout=log,stderr=log,start_new_session=True)
 def get(path,cookie='',data=None,token=None):
  headers={'Cookie':cookie}if cookie else {}
  if token:headers['X-NOA-CSRF']=token
  try:r=urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8127'+path,headers=headers,data=data),timeout=6)
  except urllib.error.HTTPError as e:r=e
  return r.status,r.headers,json.load(r)
 try:
  for attempt in range(40):
   try:_,headers,_=get('/probe.php?auth=fixture');break
   except OSError:time.sleep(.1)
  else:raise AssertionError('fixture did not start')
  cookie=headers['Set-Cookie'].split(';')[0]
  with concurrent.futures.ThreadPoolExecutor() as pool:
   pending=pool.submit(get,'/noa-app/jukebox/upload.php?action=queue',cookie)
   deadline=time.monotonic()+3
   while not marker.exists() and time.monotonic()<deadline:time.sleep(.01)
   assert marker.exists()
   start=time.monotonic();status,_,body=get('/probe.php',cookie);elapsed=time.monotonic()-start
   assert status==200 and body['admin'] and body['csrf']=='fixture-csrf'
   assert elapsed<1,'status read held the session lock'
   assert pending.result()[0]==503 # deliberately empty fixture DB
  assert get('/noa-app/jukebox/upload.php?action=queue')[0]==403
  assert get('/noa-app/jukebox/upload.php?action=init',cookie,b'{}','wrong')[0]==403
  print('PASS concurrent session read in %.3fs, admin guard and CSRF guard preserved'%elapsed)
 finally:
  import signal
  os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=5);log.close()
