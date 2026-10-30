import http.cookiejar,json,re,subprocess,time,urllib.request,urllib.parse,urllib.error,pathlib
base='http://127.0.0.1:18090'
server=subprocess.Popen(['php','-S','127.0.0.1:18090','-t','/tmp/noa-toss-http/site'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def request(path,body=None,user='tp_http',extra=None,form=False):
 h={'Cookie':'; '.join(['qa_toss_user='+user]+[c.name+'='+c.value for c in jar if c.name!='qa_toss_user']),**(extra or {})}
 if body is not None:
  h.setdefault('Origin',base);h.setdefault('Content-Type','application/x-www-form-urlencoded' if form else 'application/json')
  body=(urllib.parse.urlencode(body) if form else json.dumps(body)).encode()
 try:r=client.open(urllib.request.Request(base+path,data=body,headers=h));return r.status,r.read(),dict(r.headers)
 except urllib.error.HTTPError as e:return e.code,e.read(),dict(e.headers)
try:
 for _ in range(40):
  try:before=json.loads(request('/proof.php')[1]);break
  except urllib.error.URLError:time.sleep(.1)
 code,body,h=request('/noa-bridge/toss.php',user='');d=json.loads(body);assert code==200 and not d['member'] and d['csrf'] is None and d['balance'] is None and not d['orders'] and not d['payment']['ready'] and 'no-store' in h['Cache-Control']
 assert [p['totalPoints'] for p in d['products']]==[1000,3000,5000,11000,33000,55000]
 assert request('/noa-bridge/toss.php?action=create',{},user='')[0]==401
 d=json.loads(request('/noa-bridge/toss.php')[1]);token=d['csrf'];payload={'requestId':'bc111111-1111-4111-8111-111111111111','productId':'p10000','confirmed':True}
 assert request('/noa-bridge/toss.php?action=create',payload)[0]==403
 assert request('/noa-bridge/toss.php?action=create',payload,extra={'X-Noa-CSRF':token,'Origin':'https://evil.invalid'})[0]==403
 assert request('/noa-bridge/toss.php?action=create',payload,extra={'X-Noa-CSRF':token})[0]==409
 assert request('/noa-payment-settings.php',user='')[0]==403
 assert request('/noa-payment-settings.php')[0]==403
 code,body,h=request('/noa-payment-settings.php',user='tp_admin');assert code==200 and 'no-store' in h['Cache-Control']
 assert '연결 준비 상태'.encode() in body and '확인 필요'.encode() in body
 assert request('/noa-payment-settings.php',{'csrf':'wrong','enabled':'1'},user='tp_admin',form=True)[0]==403
 assert not pathlib.Path('/tmp/noa-toss-http/noa-private/toss.php').exists()
 for f in ['toss-core.php','toss-config.php']:assert request('/noa-bridge/'+f,user='')[0]==403
 assert request('/noa-bridge/toss-webhook.php',{},user='')[0]==503
 assert json.loads(request('/proof.php')[1])==before
 # Synthetic configuration in the disposable test directory; never production credentials.
 config="<?php return ['mode'=>'test','enabled'=>true,'clientKey'=>'test_ck_fixture','secretKey'=>'test_sk_fixture','mid'=>'fixture','webhookSecret'=>'"+'f'*64+"'];"
 pathlib.Path('/tmp/noa-toss-http/noa-private/toss.php').write_text(config)
 code,body,_=request('/noa-bridge/toss.php',user='');assert json.loads(body)['payment']['ready'] and b'test_sk_fixture' not in body and ('f'*64).encode() not in body
 assert request('/noa-bridge/toss-webhook.php',{'eventType':'PAYMENT_STATUS_CHANGED'},user='')[0]==401
 d=json.loads(request('/noa-bridge/toss.php')[1]);code,body,_=request('/noa-bridge/toss.php?action=create',payload,extra={'X-Noa-CSRF':d['csrf']});o=json.loads(body);assert code==200 and o['order']['totalPoints']==11000 and o['order']['state']=='created'
 assert json.loads(request('/proof.php')[1])['balance']==0
 code,body,_=request('/noa-bridge/toss.php?action=confirm',{'id':payload['requestId'],'paymentKey':'fixture','amount':1},extra={'X-Noa-CSRF':d['csrf']});assert code==409 and json.loads(body)['error']=='payment_amount_mismatch'
 cart_payload={'requestId':'bc222222-2222-4222-8222-222222222222','items':[{'productId':'p1000','quantity':2,'priceWon':1},{'productId':'p10000','quantity':1}],'confirmed':True}
 code,body,_=request('/noa-bridge/toss.php?action=create',cart_payload,extra={'X-Noa-CSRF':d['csrf']});cart_order=json.loads(body)['order'];assert code==200 and cart_order['priceWon']==12000 and cart_order['totalPoints']==13000 and len(cart_order['items'])==2
 cart_payload['items'][0]['quantity']=0
 assert request('/noa-bridge/toss.php?action=create',cart_payload,extra={'X-Noa-CSRF':d['csrf']})[0]==400
 assert json.loads(request('/proof.php')[1])['balance']==0
 d=json.loads(request('/noa-bridge/toss.php',user='tp_other')[1]);assert not d['orders'],'cross-account order privacy'
 print('TOSS_HTTP_AUTH_CSRF_PRIVATE_CONFIG_NO_UNVERIFIED_CREDIT_OK')
finally:server.terminate();server.wait(timeout=5)

