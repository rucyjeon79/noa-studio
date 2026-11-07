"""Bounded production proof: actual private AI runner + upload worker + canonical publication.
Only the unique, explicitly marked probe draft/song is changed. Its history/assets are retained.
The temporary control is pinned, authenticated, expires, and is removed in finally.
"""
import base64,hashlib,json,secrets,time,urllib.request,urllib.error,subprocess,tempfile
from pathlib import Path
import paramiko
from noa_full_inventory import ROOT,connect
from n80_live_observer import NoRedirect

def main():
 out=Path('ainoa-proof');out.mkdir(exist_ok=True);token=secrets.token_hex(32);draft=secrets.token_hex(16);name='creative-proof-'+secrets.token_hex(12)+'.php';remote=ROOT+'/noa-bridge/'+name
 code=Path('scripts/noa_creative_live.php').read_text();mapping={'__EXPIRY__':str(int(time.time())+2400),'__TOKEN_SHA__':hashlib.sha256(token.encode()).hexdigest(),'__DRAFT_ID__':draft,'__ANALYZE_ID__':secrets.token_hex(16),'__GENERATE_ID__':secrets.token_hex(16),'__REVISE_ID__':secrets.token_hex(16)}
 for k,v in mapping.items():code=code.replace(k,v)
 code=code.encode();t=connect();installed=False;created=False;receipt={'draftId':draft,'checks':[]};opener=urllib.request.build_opener(NoRedirect())
 def call(op,**values):
  request=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/'+name,data=json.dumps({'op':op,**values}).encode(),headers={'Content-Type':'application/json','X-NOA-Control':token,'Cache-Control':'no-cache'})
  try:
   with opener.open(request,timeout=45) as response:data=json.load(response)
  except urllib.error.HTTPError as e:
   try:data=json.load(e)
   except Exception:raise RuntimeError('creative_probe_http_'+str(e.code))
  if not data.get('ok'):raise RuntimeError('creative_probe_'+op+':'+str(data.get('error')))
  return data['result']
 def wait_job(label):
  for attempt in range(90):
   data=call('status');job=data.get('job') or {};state=job.get('state')
   if state=='succeeded':receipt['checks'].append({'step':label,'jobId':job['id'],'state':state});return data
   if state in ['failed','review','canceled']:raise RuntimeError(label+':'+str(job.get('error',state)))
   if attempt%6==0:print('CREATIVE_LIVE_WAIT',label,state,flush=True)
   time.sleep(5)
  raise RuntimeError(label+'_timeout')
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   with s.open(remote,'wx') as f:f.write(code)
   installed=True;s.chmod(remote,0o644)
   with s.open(remote,'rb') as f:
    if f.read()!=code:raise RuntimeError('probe_readback')
  receipt['schema']=call('init');created=True;call('analyze');data=wait_job('intent_analysis');receipt['questionCount']=data['questions'];call('answerAndGenerate');data=wait_job('creative_fields');assert data['completion']['percent']==100
  call('revise');wait_job('individual_revision');receipt['revision']=call('apply')
  with tempfile.TemporaryDirectory() as temp:
   audio=Path(temp)/'proof.mp3';cover=Path(temp)/'proof.webp'
   subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','sine=frequency=440:duration=2','-ac','2','-b:a','192k',str(audio)],check=True)
   subprocess.run(['ffmpeg','-v','error','-f','lavfi','-i','color=c=gray:s=64x64','-frames:v','1',str(cover)],check=True)
   call('cover',bytes=base64.b64encode(cover.read_bytes()).decode());raw=audio.read_bytes();u=call('uploadInit',size=len(raw),sha=hashlib.sha256(raw).hexdigest());size=u['chunkSize']
   for index,start in enumerate(range(0,len(raw),size)):call('chunk',upload=u['id'],index=index,bytes=base64.b64encode(raw[start:start+size]).decode())
   call('finish',upload=u['id'])
  for attempt in range(90):
   data=call('status');a=data['assets']
   if a['audioReady'] and a['coverReady']:break
   if a['status']=='failed':raise RuntimeError('real_audio_processing_failed')
   if attempt%6==0:print('CREATIVE_LIVE_WAIT audio',a['status'],flush=True)
   time.sleep(5)
  else:raise RuntimeError('real_audio_processing_timeout')
  receipt['publication']=call('publishAndVerify');print('CREATIVE_LIVE_PIPELINE_VERIFIED',flush=True)
 finally:
  if created:
   try:receipt['cleanup']=call('cleanup')
   except Exception as error:receipt['cleanupError']=str(error)
  if installed:
   with paramiko.SFTPClient.from_transport(t) as s:
    with s.open(remote,'rb') as f:
     if f.read()!=code:raise RuntimeError('concurrent_probe_preserved')
    s.remove(remote)
  t.close();(out/'creative-live.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2))
if __name__=='__main__':main()
