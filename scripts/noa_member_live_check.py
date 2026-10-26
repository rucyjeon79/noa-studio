"""Actual GnuBoard login/creator smoke using two isolated, expiring QA accounts.
No existing accounts, songs, channel or audio files are edited. Cleanup is bounded to the generated owners.
"""
import hashlib,http.cookiejar,json,os,re,secrets,stat,subprocess,time,urllib.error,urllib.parse,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
BASE='https://noastudio.ai.kr';AGENT='NOA-release-check/1.0'
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 out=Path('member-proof/authenticated');out.mkdir(parents=True,exist_ok=True);nonce=secrets.token_hex(6);token=secrets.token_hex(32);ids=['nqa'+nonce+'a','nqa'+nonce+'b'];password=secrets.token_urlsafe(36);print('::add-mask::'+password);print('::add-mask::'+token)
 audio=Path(os.environ['RUNNER_TEMP'])/'noa-qa-audio.mp3';subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-ar','44100','-ac','2','-b:a','192k',str(audio)],check=True);audio_bytes=audio.read_bytes();audio_sha=sha(audio_bytes)
 code=Path('scripts/noa_member_qa_control.php').read_text();replacements={'__QA_EXPIRY__':str(int(time.time())+1800),'__QA_TOKEN_HASH__':sha(token.encode()),'__QA_ID_A__':ids[0],'__QA_ID_B__':ids[1],'__QA_NONCE__':nonce,'__QA_AUDIO_SHA__':audio_sha}
 for k,v in replacements.items():code=code.replace(k,v)
 helper_code=code.encode();helper='noa-bridge/member-qa-'+nonce+'.php';helper_url=BASE+'/'+helper;private='/hosting/noastudio/noa-jukebox-private/media/qa-member-'+nonce;created=[];uploaded=[];t=connect();s=paramiko.SFTPClient.from_transport(t,window_size=8388608);s.get_channel().settimeout(45);uploads=[];report=[];cleanup=[]
 def request(opener,path,data=None,headers=None):
  req=urllib.request.Request(path if path.startswith('https:')else BASE+path,data=data,headers={'User-Agent':AGENT,'Cache-Control':'no-cache',**(headers or {})})
  try:
   with opener.open(req,timeout=45)as r:return r.status,r.read(),dict(r.headers)
  except urllib.error.HTTPError as e:return e.code,e.read(),dict(e.headers)
 def control(action,owner=0,**values):
  code,body,_=request(urllib.request.build_opener(),helper_url,json.dumps({'action':action,'owner':owner,**values}).encode(),{'Content-Type':'application/json','X-NOA-QA':token})
  try:j=json.loads(body)
  except json.JSONDecodeError:
   sample=body.decode('utf-8','replace').replace(token,'[redacted]').replace(password,'[redacted]')
   for account in ids:sample=sample.replace(account,'[QA account]')
   raise RuntimeError('qa_control_non_json:'+str(code)+':bytes='+str(len(body))+':sample='+repr(sample[:800]))
  if code!=200 or not j.get('ok'):raise RuntimeError('qa_control_'+action+':'+str(j.get('error'))+':'+str(j.get('file',''))+':'+str(j.get('line','')))
  return j
 def write(path,data):
  try:s.lstat(path)
  except FileNotFoundError:pass
  else:raise RuntimeError('existing_qa_path_preserved')
  with s.open(path,'wx')as f:f.set_pipelined(True);f.write(data)
  s.chmod(path,0o600 if '/media/'in path else 0o644)
  with s.open(path,'rb')as f:
   if sha(f.read())!=sha(data):raise RuntimeError('qa_upload_mismatch')
  uploaded.append((path,sha(data)))
 try:
  # Wait for the independently gated source release; never interfere with an active upload.
  for attempt in range(30):
   status,body,ready_headers=request(urllib.request.build_opener(),'/')
   if status==200 and b'id="noa-access"'in body and any(k.lower()=='x-noa-access-revision'and v=='native-subscription-read-1'for k,v in ready_headers.items()):
    sub_status,_,_=request(urllib.request.build_opener(),'/noa-bridge/subscription.php')
    if sub_status==401:break
   print('Waiting for gated NOA access release',attempt+1,flush=True);time.sleep(20)
  else:raise RuntimeError('operating_access_release_not_ready')
  s.mkdir(private,0o700);write(private+'/audio.mp3',audio_bytes);write(ROOT+'/'+helper,helper_code)
  def login(owner):
   jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
   request(client,'/bbs/login.php')
   status,body,_=request(client,'/bbs/login_check.php',urllib.parse.urlencode({'mb_id':ids[owner],'mb_password':password,'url':'/noa-my.php'}).encode(),{'Content-Type':'application/x-www-form-urlencoded','Referer':BASE+'/bbs/login.php'})
   status,body,_=request(client,'/noa-my.php')
   if status!=200 or b'id="noa-access"'not in body:raise RuntimeError('actual_GnuBoard_login_failed')
   return client,jar
  for owner in [0,1]:control('setup',owner,password=password);created.append(owner)
  client,jar=login(0)
  for level in [2,3,4,5,6]:
   control('level',level=level)
   status,body,_=request(client,'/noa-my.php');assert status==200
   match=re.search(rb'<script[^>]*id="noa-access"[^>]*>(.*?)</script>',body,re.S);caps=json.loads(match.group(1));assert caps['level']==level and not caps['admin']
   for path in ['/noa-youtube.php','/noa-world.php']:
    status,_,_=request(client,path);assert status==200,(level,path,status)
   status,_,_=request(client,'/noa-music.php');assert status==(200 if level in [4,6]else 403),('music',level,status)
   status,_,_=request(client,'/adm/member_list.php');assert status==403,('admin',level,status)
   status,write_body,_=request(client,'/bbs/write.php?bo_table=free');assert status==(403 if level==2 else 200),('write',level,status)
   if level>=3:assert b'fwrite'in write_body,'native_write_form_required'
   status,_,_=request(client,'/noa-creator.php');assert status==(200 if level in [5,6]else 403),('creator',level,status)
   report.append({'level':level,'actualGnuBoardLogin':True,'menusAndDirectRoutes':True,'highestAdminDenied':True})
  control('level',level=5)
  status,html,_=request(client,'/noa-creator.php');assert status==200
  csrf=re.search(rb'<meta name="noa-creator-csrf" content="([a-f0-9]+)"',html).group(1).decode()
  def api(action,data=None,params='',raw=False,opener=None,token_value=None):
   return request(opener or client,'/noa-bridge/creator.php?action='+action+params,None if data is None else data if raw else json.dumps(data).encode(),{'Content-Type':'application/octet-stream'if raw else 'application/json','Origin':BASE,'X-NOA-CSRF':token_value or csrf})
  status,body,_=api('channel',{'title':'NOA release QA','description':'Private release verification','revision':0});assert status==200
  status,body,_=api('save',{'fields':{'title':'NOA release QA','lyrics':'Private QA lyrics'},'genre':'your-story','visibility':'private','revision':0});assert status==200;track=json.loads(body);key=track['key']
  status,body,_=api('init',{'key':key,'filename':'noa-release-qa.mp3','bytes':len(audio_bytes),'fingerprint':audio_sha});assert status==200;upload=json.loads(body);uploads.append(upload['id']);assert upload['chunkSize']>=len(audio_bytes)
  status,body,_=api('chunk',audio_bytes,'&id='+upload['id']+'&index=0',True);assert status==200 and json.loads(body)['sha256']==audio_sha
  status,body,_=api('init',{'key':key,'filename':'noa-release-qa.mp3','bytes':len(audio_bytes),'fingerprint':audio_sha});assert status==200 and json.loads(body)['chunks']==[0]
  status,body,_=api('cancel',{'id':upload['id']});assert status==200
  # Ready fixture is a runner-generated MP3 in a QA-only private path. No worker job is fabricated.
  control('asset',key=key)
  status,body,_=api('status',params='&key='+urllib.parse.quote(key));assert status==200;state=json.loads(body);assert state['ready']and not state['download']
  audio_url=state['audio'];download_url='/noa-app/jukebox/download.php?key='+urllib.parse.quote(key)
  status,body,headers=request(client,audio_url,headers={'Range':'bytes=0-31','X-N80-Availability-Check':'1'});assert status==206 and body==audio_bytes[:32],('private_stream',status,len(body),sha(body),headers.get('Content-Type',''))
  status,_,_=request(client,download_url);assert status==403
  control('level',level=6);status,body,_=request(client,download_url);assert status==200 and sha(body)==audio_sha
  other,other_jar=login(1);control('level',owner=1,level=6)
  for path in [audio_url,download_url]:status,_,_=request(other,path);assert status==403,('cross_owner_media',status)
  status,body,_=request(other,'/noa-bridge/creator.php?action=status&key='+urllib.parse.quote(key));assert status==409 and key.encode()not in body and b'Private QA lyrics'not in body
  control('level',level=4)
  status,_,_=request(client,audio_url);assert status==403
  status,body,_=request(client,'/noa-music.php');assert status==200 and key.encode()not in body,'private_creator_song_not_in_public_music'
  music=json.JSONDecoder().raw_decode(body.decode().split('const records=',1)[1])[0];status,yt_body,_=request(client,'/noa-youtube.php');assert status==200;youtube=json.JSONDecoder().raw_decode(yt_body.decode().split('const rows=',1)[1])[0];music_keys={r.get('orderKey')or r['key']for r in music if r['kind']!='playlist'};youtube_keys={r.get('orderKey')or r['key']for r in youtube};assert music_keys<=youtube_keys,'music_youtube_parity'
  # New module: prove disabled sales, managed upgrades and exact expiry on native GnuBoard.
  control('level',level=3);before_sub=control('subscription_state');ainoa_state=control('ainoa_state');print('AINOA_TEXT_READINESS',json.dumps({k:v for k,v in ainoa_state.items()if k!='ok'}));status,body,_=request(client,'/noa-bridge/subscription.php');assert status==200;sub=json.loads(body);assert not sub['policy']['values']['enabled'],'unconfigured_policy_expected'
  status,_,_=request(client,'/noa-subscription-admin.php');assert status==403
  status,_,_=request(client,'/noa-bridge/subscription.php?action=admin_status');assert status==403
  status,_,_=request(client,'/noa-bridge/subscription.php?action=points',json.dumps({'plan':'vip','requestId':'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','policyRevision':sub['policy']['revision']}).encode(),{'Content-Type':'application/json','Origin':BASE,'X-NOA-CSRF':sub['csrf']});assert status==409
  after_sub=control('subscription_state');assert before_sub['balance']==after_sub['balance']and before_sub['revision']==after_sub['revision']and not after_sub['grantExists'],'unconfigured_purchase_must_not_mutate_points_or_grant'
  control('subscription_fixture',active=True);status,body,_=request(client,'/noa-my.php');assert status==200;caps=json.loads(re.search(rb'<script[^>]*id="noa-access"[^>]*>(.*?)</script>',body,re.S).group(1));assert caps['level']==4
  control('subscription_fixture',active=False);status,_,_=request(client,'/noa-music.php');assert status==403
  control('level',level=5);control('subscription_fixture',active=True);status,body,_=request(client,download_url);assert status==200 and sha(body)==audio_sha
  control('subscription_fixture',active=False);status,_,_=request(client,download_url);assert status==403
  status,body,_=request(client,audio_url,headers={'Range':'bytes=0-31','X-N80-Availability-Check':'1'});assert status==206 and body==audio_bytes[:32]
  control('subscription_fixture',active=True)
  # Produce browser contexts only for the generated account; private cookies stay in RUNNER_TEMP.
  control('level',level=6)
  cookie_path=Path(os.environ['RUNNER_TEMP'])/'noa-member-qa-cookies.json';cookie_path.write_text(json.dumps([{'name':c.name,'value':c.value,'domain':c.domain,'path':c.path,'secure':c.secure,'httpOnly':True,'sameSite':'Lax'}for c in jar]));cookie_path.chmod(0o600)
  env={**os.environ,'NOA_QA_COOKIES':str(cookie_path),'NOA_QA_USER_AGENT':AGENT};subprocess.run(['node',os.environ['NOA_MEMBER_AUTH_BROWSER']],env=env,check=True)
  receipt={'ok':True,'roles':report,'actualPrivateUpload':True,'sameFileResume':True,'ownPrivatePlaybackRange206':True,'level5DownloadDenied':True,'level6OwnDownloadSHA256':True,'crossOwnerMediaDenied':True,'privateSongHiddenFromMusic':True,'paidTransactions':0,'subscriptionDisabledPurchaseNoDebit':True,'managedRegularAndCreatorExpiry':True,'musicSongs':len(music_keys),'youtubeRows':len(youtube),'musicYoutubeParity':True,'normalization':'existing pipeline enqueue tested in isolated MySQL; production ready fixture generated by ffmpeg'}
  (out/'report.json').write_text(json.dumps(receipt,indent=2));print('ACTUAL_GNUBOARD_CREATOR_VERIFIED',json.dumps(receipt))
 finally:
  for owner in reversed(created):
   try:cleanup.append(control('cleanup',owner))
   except Exception as e:cleanup.append({'ok':False,'reason':str(e)})
  for upload_id in uploads:
   directory='/hosting/noastudio/noa-jukebox-private/incoming/'+upload_id
   try:
    for entry in s.listdir_attr(directory):
     if stat.S_ISREG(entry.st_mode)and re.fullmatch(r'(?:[.]lock|chunk-[0-9]+|input[.](?:part|audio))',entry.filename):s.remove(directory+'/'+entry.filename)
    s.rmdir(directory)
   except FileNotFoundError:pass
  for path,digest in reversed(uploaded):
   try:
    with s.open(path,'rb')as f:current=sha(f.read())
    if current!=digest:raise RuntimeError('changed_qa_file_preserved')
    s.remove(path)
   except FileNotFoundError:pass
  try:s.rmdir(private)
  except FileNotFoundError:pass
  s.close();t.close();(out/'cleanup.json').write_text(json.dumps(cleanup,indent=2))
  if any(not v.get('ok')for v in cleanup):raise RuntimeError('QA_cleanup_requires_recovery')
  print('QA_ACCOUNTS_AND_OWN_TEST_RECORDS_REMOVED',len(cleanup))
if __name__=='__main__':main()
