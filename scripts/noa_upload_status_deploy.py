"""Scoped upload status release. Audio, members and the mastering worker remain untouched."""
import base64,hashlib,json,os,stat,subprocess,sys,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
FILES={p:'deploy/'+p for p in ['noa-app/jukebox/upload.php','noa-app/jukebox/upload.js','noa-app/jukebox/index.php','noa-music.php']}
NEW=set()
PROTECTED=['common.php','data/dbconfig.php','bbs/login.php','bbs/login_check.php','noa-app/jukebox/core.php','noa-app/jukebox/upload-core.php','noa-app/jukebox/queue-core.php','noa-app/jukebox/recovery-core.php','noa-app/jukebox/stream.php','noa-app/jukebox/download.php','noa-ainoa.js']
BACKUP=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-upload-status-before.json'
def sha(v):return hashlib.sha256(v).hexdigest()
def main():
 out=Path('upload-status-proof');out.mkdir(exist_ok=True);desired={p:Path(v).read_bytes()for p,v in FILES.items()};rollback='rollback'in sys.argv
 if not rollback:
  headers={'User-Agent':'NOA-scoped-release','Accept':'application/vnd.github+json'}
  if os.getenv('GH_TOKEN'):headers['Authorization']='Bearer '+os.environ['GH_TOKEN']
  with urllib.request.urlopen(urllib.request.Request('https://api.github.com/repos/rucyjeon79/noa-studio/git/ref/heads/main',headers=headers),timeout=20)as response:head=json.load(response)['object']['sha']
  if head!=os.environ['GITHUB_SHA']:raise RuntimeError('obsolete_candidate_no_operating_files_changed')
 known={p:{sha(subprocess.check_output(['git','show',c+':'+v]))for c in subprocess.check_output(['git','log','--format=%H','--',v],text=True).splitlines()}for p,v in FILES.items()};t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t,window_size=8388608)as s:
   s.get_channel().settimeout(45)
   if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_NOA_root')
   def read(path):
    try:info=s.lstat(ROOT+'/'+path)
    except FileNotFoundError:return None
    if not stat.S_ISREG(info.st_mode):raise RuntimeError('nonregular_target:'+path)
    with s.open(ROOT+'/'+path,'rb')as f:
     if info.st_size>32768:f.prefetch(file_size=info.st_size,max_concurrent_requests=16)
     return f.read()
   def put(path,data):
    if read(path)is not None:raise RuntimeError('temporary_exists')
    with s.open(ROOT+'/'+path,'wx')as f:f.set_pipelined(True);f.write(data)
    s.chmod(ROOT+'/'+path,0o644)
    if read(path)!=data:raise RuntimeError('temporary_readback_mismatch')
   if rollback:
    for p,v in reversed(list(json.loads(BACKUP.read_text()).items())):
     old=base64.b64decode(v)if v is not None else None;current=read(p)
     if current==old:continue
     if current!=desired[p]:raise RuntimeError('concurrent_version_preserved:'+p)
     if old is None:s.remove(ROOT+'/'+p)
     else:
      folder,name=p.rsplit('/',1)if '/'in p else ('',p);temp=(folder+'/'if folder else '')+'.'+name+'.rollback-'+os.environ['GITHUB_SHA'][:12];put(temp,old);s.posix_rename(ROOT+'/'+temp,ROOT+'/'+p)
    print('UPLOAD_STATUS_OWNED_SOURCE_RESTORED');return
   before={p:read(p)for p in FILES};protected={p:sha(read(p))for p in PROTECTED}
   for p,v in before.items():
    if v is None and p not in NEW:raise RuntimeError('missing_existing_target:'+p)
    if v is not None and sha(v)not in known[p]:raise RuntimeError('unknown_operating_version_preserved:'+p)
   BACKUP.write_text(json.dumps({p:base64.b64encode(v).decode()if v is not None else None for p,v in before.items()}));BACKUP.chmod(0o600);temps={}
   for p,data in desired.items():
    if before[p]==data:continue
    folder,name=p.rsplit('/',1)if '/'in p else ('',p);temp=(folder+'/'if folder else '')+'.'+name+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp';put(temp,data);temps[p]=temp
   if any(read(p)!=v for p,v in before.items()):raise RuntimeError('concurrent_operating_change')
   for p in FILES:
    if p in temps:s.posix_rename(ROOT+'/'+temps[p],ROOT+'/'+p)
    if read(p)!=desired[p]:raise RuntimeError('activation_hash_mismatch:'+p)
   if any(sha(read(p))!=digest for p,digest in protected.items()):raise RuntimeError('protected_source_changed')
   receipt={'commit':os.environ['GITHUB_SHA'],'changed':list(temps),'sha256':{p:sha(desired[p])for p in FILES},'protectedUnchanged':len(PROTECTED),'databaseWrites':0,'memberRowsChanged':0,'pointDebits':0,'pricesSeeded':False};(out/'deployment.json').write_text(json.dumps(receipt,indent=2));print('NOA_UPLOAD_STATUS_DEPLOYED',json.dumps(receipt))
 finally:t.close()
 for p in FILES:
  if p.endswith(('.js','.css','.png','.json')):
   with urllib.request.urlopen(urllib.request.Request('https://noastudio.ai.kr/'+p+'?audit='+os.environ['GITHUB_SHA'][:12],headers={'Cache-Control':'no-cache'}),timeout=30)as r:
    if sha(r.read())!=sha(desired[p]):raise RuntimeError('public_asset_hash_mismatch:'+p)
def verify_live():
 from noa_jukebox_recovery import signed_service
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t)as s:
   s.get_channel().settimeout(30)
   with s.open('/hosting/noastudio/noa-ai-lab/worker.key','r')as f:key=f.read().decode().strip()
 finally:t.close()
 call=signed_service(key);refresh=call('runtime_refresh');queue=call('queue_snapshot');health=call('runtime_health')
 target='single:kpop-original:05';rows=[r for r in queue['rows']if r['song_key']==target]
 if not rows:raise RuntimeError('target_upload_not_found')
 latest=max(rows,key=lambda r:int(r['id']));state=call('upload_reconcile',{'id':latest['upload_id']})
 if state['status']!='ready' or not state['final_verified'] or not state['source_matches_final']:raise RuntimeError('target_completion_not_verified')
 result={'checked_at':health['checked_at'],'target':{'key':target,'title':latest['title'],'upload_id':latest['upload_id'],'job_id':latest['id'],'status':state['status'],'final_verified':state['final_verified'],'source_matches_final':state['source_matches_final'],'sha256':state['public']['audio_sha256'],'bytes':state['public']['audio_bytes'],'uploaded_at':latest['uploaded_at'],'started_at':latest['started_at'],'finished_at':latest['finished_at']},'queued':health['queued'],'active':health['active'],'worker':health['worker']['state'],'integrity':call('integrity_snapshot'),'opcache_upload_invalidated':refresh['files']['upload.php']['invalidated'],'audio_writes':0,'member_writes':0}
 Path('upload-status-proof/live-state.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print('NOA_UPLOAD_STATUS_LIVE',json.dumps(result,ensure_ascii=False))
if __name__=='__main__':
 if 'verify' in sys.argv:verify_live()
 else:main()

