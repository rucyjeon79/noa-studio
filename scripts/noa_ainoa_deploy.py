"""Scoped AInoa and launch release. Existing music, members and core remain untouched."""
import base64,hashlib,json,os,stat,subprocess,sys,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
FILES={'noa-bridge/index.php':'bridge/index.php','noa-bridge/ainoa-generation.php':'bridge/ainoa-generation.php','noa-youtube.php':'deploy/noa-youtube.php','noa-creator.php':'deploy/noa-creator.php','noa-editor.php':'deploy/noa-editor.php','noa-bridge/ainoa-points.php':'bridge/ainoa-points.php','noa-bridge/subscription-core.php':'bridge/subscription-core.php','noa-bridge/youtube-catalog.php':'bridge/youtube-catalog.php','noa-browse-order.js':'deploy/noa-browse-order.js','noa-bridge/lab-api.php':'bridge/lab-api.php','noa-ai-lab.php':'deploy/noa-ai-lab.php','noa-ai-lab.js':'deploy/noa-ai-lab.js','noa-assets/ainoa-symbol.png':'public/ainoa/ainoa-symbol.png','noa-launch.js':'deploy/noa-launch.js','noa-manifest.json':'deploy/noa-manifest.json','noa-sw.js':'deploy/noa-sw.js','noa-bridge/subscription-access.php':'bridge/subscription-access.php','extend/noa.access.php':'deploy/noa-access.extend.php','noa-bridge/ainoa-core.php':'bridge/ainoa-core.php','noa-ainoa.php':'deploy/noa-ainoa.php','noa-ainoa.css':'deploy/noa-ainoa.css','noa-ainoa.js':'deploy/noa-ainoa.js','noa-bridge/package-record.php':'bridge/package-record.php','noa-browse-edit.js':'deploy/noa-browse-edit.js','noa-browse.js':'deploy/noa-browse.js','extend/noa.design.php':'deploy/noa-design.extend.php'}
# Install shared dependencies before callers; every activation keeps preimage guards.
_priorities=['noa-bridge/package-record.php','noa-bridge/ainoa-generation.php','noa-bridge/ainoa-core.php']
FILES={**{p:FILES[p]for p in _priorities},**{p:v for p,v in FILES.items()if p not in _priorities}}
NEW={'noa-bridge/ainoa-generation.php','noa-bridge/ainoa-points.php','noa-assets/ainoa-symbol.png','noa-launch.js','noa-bridge/ainoa-core.php','noa-ainoa.php','noa-ainoa.css','noa-ainoa.js'}
PROTECTED=['common.php','data/dbconfig.php','bbs/login.php','bbs/login_check.php','bbs/board.php','noa-music.php','noa-world.php','noa-hero.js','noa-app/engine/n80.php','noa-app/jukebox/stream.php','noa-app/jukebox/download.php']
BACKUP=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-ainoa-before.json'
def sha(v):return hashlib.sha256(v).hexdigest()
def main():
 out=Path('ainoa-proof');out.mkdir(exist_ok=True);desired={p:Path(v).read_bytes()for p,v in FILES.items()};rollback='rollback'in sys.argv
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
    print('AINOA_RELEASE_OWNED_SOURCE_RESTORED');return
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
   receipt={'commit':os.environ['GITHUB_SHA'],'changed':list(temps),'sha256':{p:sha(desired[p])for p in FILES},'protectedUnchanged':len(PROTECTED),'databaseWrites':0,'memberRowsChanged':0,'pointDebits':0,'pricesSeeded':False};(out/'deployment.json').write_text(json.dumps(receipt,indent=2));print('NOA_AINOA_SCOPED_DEPLOYED',json.dumps(receipt))
 finally:t.close()
 for p in FILES:
  if p.endswith(('.js','.css','.png','.json')):
   with urllib.request.urlopen(urllib.request.Request('https://noastudio.ai.kr/'+p+'?audit='+os.environ['GITHUB_SHA'][:12],headers={'Cache-Control':'no-cache'}),timeout=30)as r:
    if sha(r.read())!=sha(desired[p]):raise RuntimeError('public_asset_hash_mismatch:'+p)
if __name__=='__main__':main()
