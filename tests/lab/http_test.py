"""Isolated PHP HTTP tests. Uses disposable credentials, no production requests."""
import tempfile,pathlib,shutil,subprocess,socket,time,urllib.request,urllib.error,json,hashlib,hmac,secrets,http.cookiejar
REPO=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='noa-lab-http-') as root:
 root=pathlib.Path(root);html=root/'html';html.mkdir();private=root/'noa-ai-lab';private.mkdir();(private/'jobs').mkdir();(private/'master.key').write_bytes(secrets.token_bytes(32));key=secrets.token_hex(32);(private/'worker.key').write_text(key)
 shutil.copytree(REPO/'bridge',html/'noa-bridge')
 (html/'common.php').write_text("<?php session_start();define('_GNUBOARD_',true);define('G5_PATH',__DIR__);$is_member=($_SERVER['HTTP_X_TEST_ROLE']??'')==='admin';$is_admin=$is_member?'super':'';$member=['mb_id'=>'test-admin'];")
 with socket.socket() as sock:sock.bind(('127.0.0.1',0));port=sock.getsockname()[1]
 process=subprocess.Popen(['php','-S',f'127.0.0.1:{port}','-t',str(html)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 base=f'http://127.0.0.1:{port}/noa-bridge/';opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def request(path,body=None,headers=None):
  data=None if body is None else json.dumps(body,separators=(',',':')).encode();req=urllib.request.Request(base+path,data=data,headers={'Content-Type':'application/json',**(headers or {})})
  try:r=opener.open(req,timeout=10)
  except urllib.error.HTTPError as error:r=error
  return r.status,json.loads(r.read())
 def worker(action,body=None,nonce=None):
  raw='' if body is None else json.dumps(body,separators=(',',':'));query='action='+action;ts=str(int(time.time()));nonce=nonce or secrets.token_hex(16);signed='\n'.join(['GET' if body is None else 'POST',query,hashlib.sha256(raw.encode()).hexdigest(),ts,nonce]);return request('lab-worker.php?'+query,body,{'X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key.encode(),signed.encode(),hashlib.sha256).hexdigest()})
 try:
  for _ in range(100):
   try:status,_=request('lab-api.php');break
   except (ConnectionError,urllib.error.URLError):time.sleep(.05)
  assert status==403
  for path in ['lab-creator.php','lab-file.php','lab-oauth.php']:assert request(path)[0]==403,path
  assert request('lab-worker.php?action=health')[0]==401
  nonce=secrets.token_hex(16);assert worker('health',nonce=nonce)[0]==200;assert worker('health',nonce=nonce)[0]==409
  status,state=request('lab-api.php',headers={'X-Test-Role':'admin'});assert status==200;csrf=state['csrf'];admin={'X-Test-Role':'admin','X-NOA-CSRF':csrf,'Origin':'https://noastudio.ai.kr'}
  assert request('lab-api.php?action=config',{'expectedRevision':state['revision']},{'X-Test-Role':'admin'})[0]==403
  assert request('lab-api.php?action=config',{'expectedRevision':state['revision']},{**admin,'Origin':'https://evil.example'})[0]==403
  assert request('lab-api.php?action=config',{'expectedRevision':state['revision']},admin)[0]==200
  # Exercise completion transitions to catch malformed branches before deploying.
  state=json.loads((private/'state.json').read_text());state['jobs']={};jobid='a'*32;state['jobs'][jobid]={'id':jobid,'title':'isolated fixture','state':'queued_analysis','revision':1,'attempts':0,'createdAt':'2026-10-20T00:00:00Z','settings':{'mode':'audio','formats':['landscape'],'posting':'save','autoSelect':True,'subtitles':False},'cast':'female','genre':'test','outputs':[]};(private/'state.json').write_text(json.dumps(state))
  status,claim=worker('claim',{});assert status==200 and claim['stage']=='analysis'
  auth={'id':jobid,'lease':claim['job']['lease']};assert worker('complete',{**auth,'stage':'analysis','analysis':{'duration':5,'candidates':[{'start':0,'end':5}]}})[0]==200
  status,state=request('lab-api.php',headers={'X-Test-Role':'admin'});job=state['jobs'][0];assert job['state']=='review_highlights','Audio-only mode must never auto-render'
  assert request('lab-api.php?action=optimize',{'id':jobid,'expectedRevision':job['revision'],'preset':'transparent','targetLufs':-14,'truePeakCeiling':-1},admin)[0]==200
  status,claim=worker('claim',{});assert status==200 and claim['stage']=='master';auth['lease']=claim['job']['lease']
  assert worker('complete',{**auth,'stage':'master'})[0]==409,'Missing actual optimized output must fail'
  assert worker('failed',{**auth,'stage':'master','error':'test_failure','ambiguous':True})[0]==200
  status,state=request('lab-api.php',headers={'X-Test-Role':'admin'});job=state['jobs'][0];assert request('lab-api.php?action=retry',{'id':jobid,'expectedRevision':job['revision']},admin)[0]==409
  print('PHP HTTP: administrator/CSRF/HMAC/replay, audio-only lifecycle, output validation and ambiguous retry protection passed.')
 finally:process.terminate();process.wait(timeout=5)
