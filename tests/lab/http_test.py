"""Isolated PHP HTTP tests. Uses disposable credentials, no production requests."""
import tempfile,pathlib,shutil,subprocess,socket,time,urllib.request,urllib.error,json,hashlib,hmac,secrets,http.cookiejar,base64
REPO=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='noa-lab-http-') as root:
 root=pathlib.Path(root);html=root/'html';html.mkdir();private=root/'noa-ai-lab';private.mkdir();(private/'jobs').mkdir();(private/'master.key').write_bytes(secrets.token_bytes(32));key=secrets.token_hex(32);(private/'worker.key').write_text(key)
 shutil.copytree(REPO/'bridge',html/'noa-bridge')
 shutil.copytree(REPO/'deploy/noa-app/engine',html/'noa-app/engine')
 (html/'noa-app/jukebox').mkdir();shutil.copy(REPO/'deploy/noa-app/jukebox/wake-core.php',html/'noa-app/jukebox/wake-core.php')
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
  assert request('lab-api.php?action=config',{'expectedRevision':state['configRevision']},{'X-Test-Role':'admin'})[0]==403
  assert request('lab-api.php?action=config',{'expectedRevision':state['configRevision']},{**admin,'Origin':'https://evil.example'})[0]==403
  assert worker('health')[0]==200
  assert request('lab-api.php?action=config',{'expectedRevision':state['configRevision']},admin)[0]==200
  assert request('lab-api.php?action=scene_plan',{'durationSeconds':240},{'X-Test-Role':'admin'})[0]==403
  status,planned=request('lab-api.php?action=scene_plan',{'durationSeconds':240},admin);assert status==200 and planned['plan']['cutCount']==35 and planned['plan']['scenes'][-1]['end']==240
  assert request('lab-api.php?action=scene_plan',{'durationSeconds':0},admin)[0]==400
  assert request('lab-api.php',headers={'X-Test-Role':'admin'})[1]['jobs']==[], 'planning creates no paid jobs'
  # Real browser-result multipart upload, protected by the existing admin and CSRF gates.
  # Real 0.5-second H.264 fixture; HTTP contracts do not require an encoder on every runner.
  clip_bytes=base64.b64decode((REPO/'tests/lab/clip_fixture.b64').read_text());fields={'requestId':'c'*32,'sourceUrl':'https://flow.google.com/project/11111111-1111-1111-1111-111111111111/edit/22222222-2222-2222-2222-222222222222','sha256':hashlib.sha256(clip_bytes).hexdigest(),'trackKey':''}
  def import_clip(extra_headers,values=fields):
   boundary='n80-'+secrets.token_hex(12);parts=[]
   for k,v in values.items():parts.append(('--'+boundary+'\r\nContent-Disposition: form-data; name="'+k+'"\r\n\r\n'+v+'\r\n').encode())
   parts.extend([('--'+boundary+'\r\nContent-Disposition: form-data; name="clip"; filename="clip.mp4"\r\nContent-Type: video/mp4\r\n\r\n').encode(),clip_bytes,('\r\n--'+boundary+'--\r\n').encode()])
   req=urllib.request.Request(base+'lab-api.php?action=browser_import',data=b''.join(parts),headers={'Content-Type':'multipart/form-data; boundary='+boundary,**extra_headers})
   try:response=opener.open(req,timeout=10)
   except urllib.error.HTTPError as error:response=error
   return response.status,json.loads(response.read())
  assert import_clip({})[0]==403
  assert import_clip({'X-Test-Role':'admin'})[0]==403
  assert import_clip({**admin,'Origin':'https://evil.example'})[0]==403
  assert import_clip(admin,{**fields,'sha256':'0'*64})[0]==409
  status,received=import_clip(admin);assert status==200 and received['fileVerified'],received
  status,replay=import_clip(admin);assert status==200 and replay['replayed'] and replay['job']['id']==received['job']['id']
  file_url=base+'lab-file.php?id='+received['job']['id']+'&format=landscape'
  response=opener.open(urllib.request.Request(file_url,headers={'X-Test-Role':'admin','Range':'bytes=0-127'}));assert response.status==206 and response.read()==clip_bytes[:128]
  response=opener.open(urllib.request.Request(file_url,headers={'X-Test-Role':'admin'}));assert response.read()==clip_bytes
  assert request('lab-file.php?id='+received['job']['id']+'&format=landscape')[0]==403
  print('Browser clip HTTP: admin, CSRF, checksum, upload replay, private readback and range streaming passed.')
  # Exercise completion transitions to catch malformed branches before deploying.
  state=json.loads((private/'state.json').read_text());state['worker']={'readiness':{'isolated-proof':{'durableAck':True}}};state['jobs']={};jobid='a'*32;state['jobs'][jobid]={'id':jobid,'title':'isolated fixture','state':'queued_analysis','revision':1,'attempts':0,'createdAt':'2026-10-20T00:00:00Z','settings':{'mode':'audio','formats':['landscape'],'posting':'save','autoSelect':True,'subtitles':False},'cast':'female','genre':'test','outputs':[]};(private/'state.json').write_text(json.dumps(state))
  status,claim=worker('claim',{});assert status==200 and claim['stage']=='analysis'
  assert json.loads((private/'state.json').read_text())['worker']['readiness']['isolated-proof']['durableAck'] is True
  auth={'id':jobid,'lease':claim['job']['lease']};assert worker('complete',{**auth,'stage':'analysis','analysis':{'duration':5,'candidates':[{'start':0,'end':5}]}})[0]==200
  status,state=request('lab-api.php',headers={'X-Test-Role':'admin'});job=state['jobs'][0];assert job['state']=='review_highlights','Audio-only mode must never auto-render'
  assert request('lab-api.php?action=optimize',{'id':jobid,'expectedRevision':job['revision'],'preset':'transparent','targetLufs':-14,'truePeakCeiling':-1},admin)[0]==200
  status,claim=worker('claim',{});assert status==200 and claim['stage']=='master';auth['lease']=claim['job']['lease']
  assert worker('complete',{**auth,'stage':'master'})[0]==409,'Missing actual optimized output must fail'
  # Final publication is invisible until bytes and hash match the leased reservation.
  data=b'isolated finished audio';digest=hashlib.sha256(data).hexdigest();manifest={'checks':{'valid':True},'sha256':digest,'extension':'wav'}
  final={**auth,'format':'optimized','bytes':len(data),'sha256':digest,'manifest':manifest}
  assert worker('output',{**auth,'format':'optimized','part':0,'bytes':'eA=='})[0]==409
  status,reservation=worker('prepare_final',final);assert status==200
  assert worker('commit_final',final)[0]==409
  directory=private/'jobs'/jobid;directory.mkdir(exist_ok=True)
  (directory/reservation['file']).write_bytes(data)
  assert worker('commit_final',{**final,'lease':'0'*32})[0]==409
  assert worker('commit_final',final)[0]==200
  assert worker('commit_final',final)[0]==200,'Lost publication replies must allow exact delivery replay'
  completed={**auth,'stage':'master'};assert worker('complete',completed)[0]==200
  assert worker('complete',completed)[1]['replayed'] is True
  # A separate ambiguous attempt remains protected from an automatic retry.
  state=json.loads((private/'state.json').read_text());state['jobs'][jobid]['state']='mastering_audio';state['jobs'][jobid]['lease']='b'*32;state['jobs'][jobid]['leaseUntil']=int(time.time())+100;state['jobs'][jobid].pop('completionReceipts',None);(private/'state.json').write_text(json.dumps(state));auth['lease']='b'*32
  assert worker('failed',{**auth,'stage':'master','error':'test_failure','ambiguous':True})[0]==200
  status,state=request('lab-api.php',headers={'X-Test-Role':'admin'});job=state['jobs'][0];assert request('lab-api.php?action=retry',{'id':jobid,'expectedRevision':job['revision']},admin)[0]==409
  print('PHP HTTP: administrator/CSRF/HMAC/replay, audio-only lifecycle, output validation and ambiguous retry protection passed.')
 finally:process.terminate();process.wait(timeout=5)
