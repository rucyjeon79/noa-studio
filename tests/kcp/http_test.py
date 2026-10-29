"""Exercise native PHP entry guards, CSRF and return without touching provider/DB."""
import http.cookiejar, pathlib, shutil, subprocess, tempfile, time, urllib.request, urllib.error, urllib.parse
root=pathlib.Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory() as temp:
 p=pathlib.Path(temp);(p/'noa-bridge').mkdir()
 for name in ['noa-kcp-test.php','noa-kcp-test.js']:shutil.copy(root/'deploy'/name,p/name)
 shutil.copy(root/'bridge/kcp-test-core.php',p/'noa-bridge/kcp-test-core.php')
 (p/'common.php').write_text("<?php define('_GNUBOARD_',true);session_start();$is_admin=($_SERVER['HTTP_X_TEST_ADMIN']??'')==='1'?'super':'';")
 server=subprocess.Popen(['php','-S','127.0.0.1:18793','-t',temp],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  url='http://127.0.0.1:18793/noa-kcp-test.php'
  for _ in range(40):
   try:urllib.request.urlopen(url);break
   except urllib.error.HTTPError:break
   except urllib.error.URLError:time.sleep(.1)
  def request(data=None,headers=None):
   try:
    with opener.open(urllib.request.Request(url,data=data,headers=headers or {})) as r:return r.status,r.read().decode()
   except urllib.error.HTTPError as e:return e.code,e.read().decode()
  assert request()[0]==403
  code,body=request(headers={'X-Test-Admin':'1'});assert code==200 and 'KCP 결제창 연결' in body
  assert request(b'device=pc',{'X-Test-Admin':'1','Origin':'https://noastudio.ai.kr'})[0]==403
  import re
  csrf=re.search('name="csrf" value="([a-f0-9]+)"',body)[1]
  assert request(urllib.parse.urlencode({'device':'pc','csrf':csrf}).encode(),{'X-Test-Admin':'1','Origin':'https://evil.invalid'})[0]==403
  code,body=request(urllib.parse.urlencode({'device':'pc','csrf':csrf}).encode(),{'X-Test-Admin':'1','Origin':'https://noastudio.ai.kr'})
  assert code==200 and 'value="T0000"' in body and 'value="1000"' in body
  code,body=request(b'res_cd=0000&enc_data=DO_NOT_ECHO',{'X-Test-Admin':'1'})
  assert code==200 and '승인 API를 호출하지' in body and 'DO_NOT_ECHO' not in body
  print('KCP_HTTP_ADMIN_CSRF_NO_CREDIT_RETURN_OK')
 finally:server.terminate();server.wait()
