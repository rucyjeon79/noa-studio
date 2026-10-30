"""Real endpoint/CSRF/ownership/upload checks on disposable loopback PHP + MySQL only."""
import tempfile,subprocess,pathlib,shutil,urllib.request,urllib.error,http.cookiejar,json,time,base64
repo=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix='noa-ecosystem-http-') as temp:
 root=pathlib.Path(temp);shutil.copytree(repo/'bridge',root/'noa-bridge');shutil.copy(repo/'deploy/noa-products.json',root/'noa-products.json');(root/'data').mkdir()
 fixture=(repo/'tests/subscription/native_fixture.php').read_text().replace("__DIR__.'/../../bridge/subscription-core.php'",repr(str(root/'noa-bridge/subscription-core.php')))
 (root/'fixture.php').write_text(fixture)
 common="<?php\nrequire "+repr(str(root/'fixture.php'))+";session_start();define('G5_DATA_PATH',"+repr(str(root/'data'))+");$who=$_SERVER['HTTP_X_FIXTURE_USER']??'';$member=$who===''?[]:['mb_id'=>$who,'mb_level'=>5,'mb_nick'=>$who];$is_admin='';"
 (root/'common.php').write_text(common)
 proc=subprocess.Popen(['php','-S','127.0.0.1:8117','-t',str(root)],stdout=subprocess.DEVNULL,stderr=None)
 def client(who):
  opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  def call(action,body=None,origin='https://noastudio.ai.kr',csrf='',raw=None,ctype='application/json'):
   headers={'X-Fixture-User':who}
   if body is not None or raw is not None:headers.update({'Origin':origin,'X-Noa-CSRF':csrf,'Content-Type':ctype})
   data=raw if raw is not None else (json.dumps(body).encode()if body is not None else None)
   request=urllib.request.Request('http://127.0.0.1:8117/noa-bridge/ecosystem.php?action='+action,data=data,headers=headers)
   try:
    with opener.open(request,timeout=10)as response:return response.status,response.read()
   except urllib.error.HTTPError as e:return e.code,e.read()
  return call
 try:
  a,b,guest=client('http_creator'),client('http_other'),client('')
  for attempt in range(30):
   try:status,raw=a('session');break
   except OSError:time.sleep(.1)
  assert status==200,raw
  csrf=json.loads(raw)['csrf'];other=json.loads(b('session')[1])['csrf']
  post={'id':'f'*32,'revision':0,'space':'lounge','category':'chat','title':'HTTP isolated fixture','body':'private','visibility':'private'}
  assert a('save',post,origin='https://untrusted.invalid',csrf=csrf)[0]==403
  assert a('save',post,csrf='wrong')[0]==403
  result=a('save',post,csrf=csrf);assert result[0]==200,result
  assert guest('detail&id='+'f'*32)[0]==401
  assert b('detail&id='+'f'*32)[0]==409
  assert a('detail&id='+'f'*32)[0]==200
  post['revision']=1;assert b('save',post,csrf=other)[0]==409
  assert a('shop-save',{'revision':0,'wishlist':['24300555'],'cart':[{'id':'24300555','quantity':2}]},csrf=csrf)[0]==200
  assert len(json.loads(b('shop')[1])['state']['cart'])==0
  # Valid tiny PNG, re-encoded by GD; private image controller rejects the other account.
  png=subprocess.check_output(['php','-r', '$i=imagecreatetruecolor(2,2);imagepng($i);'])
  boundary='NOAFixtureBoundary';raw=(f'--{boundary}\r\nContent-Disposition: form-data; name="image"; filename="test.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+(f'\r\n--{boundary}--\r\n').encode()
  status,upload=a('upload',csrf=csrf,raw=raw,ctype='multipart/form-data; boundary='+boundary)
  assert status==200,(status,upload)
  asset=json.loads(upload)['id'];assert a('asset&id='+asset)[0]==200;assert b('asset&id='+asset)[0]==409
  assert (root/'data/noa-ecosystem/.htaccess').read_text()=='Require all denied\n'
  collab={'id':'9'*32,'revision':0,'space':'lab','category':'collaboration','title':'HTTP collaboration','body':'work','visibility':'public','rightsConfirmed':True,'roles':'vocals','schedule':'November','compensation':'contract','rights':'shared credit'}
  result=a('save',collab,csrf=csrf);assert result[0]==200,result
  detail=json.loads(b('detail&id='+'9'*32)[1])
  request={'id':'9'*32,'message':'participate','consent':True,'termsHash':detail['post']['termsHash']}
  assert b('apply',request,csrf='bad')[0]==403
  result=b('apply',request,csrf=other);assert result[0]==200,result
  own=json.loads(b('detail&id='+'9'*32)[1])['ownApplication'];assert own['status']=='requested'
  assert a('application-withdraw',{'id':'9'*32,'revision':own['revision']},csrf=csrf)[0]==409
  result=b('application-withdraw',{'id':'9'*32,'revision':own['revision']},csrf=other);assert result[0]==200,result
  request['applicationRevision']=json.loads(result[1])['revision']
  assert b('apply',request,csrf=other)[0]==200
  assert json.loads(b('activity')[1])['applications'][0]['space']=='lab'
  print('ECOSYSTEM_REAL_HTTP_CSRF_OWNERSHIP_PRIVATE_IMAGE_CART_WITHDRAW_REAPPLY_OK')
 finally:proc.terminate();proc.wait(timeout=10)
