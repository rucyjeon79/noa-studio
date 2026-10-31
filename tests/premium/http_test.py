import http.cookiejar,json,re,subprocess,time,urllib.request,urllib.parse,urllib.error
base='http://127.0.0.1:18089'
server=subprocess.Popen(['php','-S','127.0.0.1:18089','-t','/tmp/noa-download-fixture'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def get(path,body=None,user='httpbuyer',extra=None):
 headers={'Cookie':'; '.join(['qa_download_user='+user]+[c.name+'='+c.value for c in jar if c.name!='qa_download_user']),**(extra or {})}
 if body is not None:headers.update({'Origin':base,'Content-Type':'application/x-www-form-urlencoded'});body=urllib.parse.urlencode(body).encode()
 try:r=client.open(urllib.request.Request(base+path,data=body,headers=headers));return r.status,r.read(),dict(r.headers),r.url
 except urllib.error.HTTPError as e:return e.code,e.read(),dict(e.headers),e.url
try:
 for n in range(40):
  try:before=json.loads(get('/proof.php')[1]);break
  except urllib.error.URLError:time.sleep(.1)
 code,html,_,_=get('/noa-app/jukebox/download.php?key=http-song');assert code==200 and b'1,000P' in html
 assert json.loads(get('/proof.php')[1])==before,'GET never charges'
 code,admin_html,_,_=get('/noa-music-download.php?key=http-song',user='qa_admin_dl');assert code==200 and b'music-download-file' in admin_html and b'data-filename=' in admin_html,'admin gets save-location page'
 assert b'name="requestId"' not in admin_html,'admin must not receive purchase form'
 assert get('/noa-music-download.php?key=http-private')[0]==409,'private forbidden'
 assert get('/noa-music-download.php?key=http-song',{'csrf':'bad','requestId':'bad'})[0]==409
 code,html,_,_=get('/noa-music-download.php?key=http-song');html=html.decode();token=re.search(r'name="csrf" value="([^"]+)"',html)[1];rid=re.search(r'name="requestId" value="([^"]+)"',html)[1]
 data={'csrf':token,'requestId':rid};code,html,_,url=get('/noa-music-download.php?key=http-song',data);assert code==200 and 'receipt='+rid in url,(code,html[:100])
 assert b'music-download-file' in html and b'noa-music-save.js' in html,'paid receipt gets save-location UI'
 after=json.loads(get('/proof.php')[1]);assert after=={'buyer':before['buyer']-1000,'owner':before['owner']+500},after
 get('/noa-music-download.php?key=http-song',data);assert json.loads(get('/proof.php')[1])==after,'replayed POST'
 path='/noa-app/jukebox/download.php?key=http-song&receipt='+rid
 code,content,headers,_=get(path);assert code==200 and len(content)>100 and 'attachment' in headers['Content-Disposition']
 code,content,headers,_=get(path,extra={'Range':'bytes=0-31'});assert code==206 and len(content)==32
 assert get(path,user='httpother')[0]>=400,'receipt cross-account forbidden'
 assert json.loads(get('/proof.php')[1])==after,'range/read retries no debit'
 print('PREMIUM_HTTP_CONFIRM_CSRF_PRIVATE_RECEIPT_RANGE_NO_DOUBLE_CHARGE_OK')
finally:server.terminate();server.wait(timeout=5)
