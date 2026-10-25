"""Scoped NOA release: dependency first, runtime ACL last; pinned SFTP, CAS and readback."""
import base64,hashlib,json,os,stat,subprocess,sys,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
FILES={}
for name in ['member-access.php','creator-core.php','creator.php','legacy-audio.php','home-core.php','home.php']:FILES['noa-bridge/'+name]='bridge/'+name
for name in ['noa-creator.js','noa-creator.css','noa-creator.php','noa-channel.php','noa-ui.js','noa-hero.js','noa-my.php','noa-sitemap.php','noa-app/jukebox/upload-core.php','noa-app/jukebox/stream.php','noa-app/jukebox/download.php','noa-app/home.php']:FILES[name]='deploy/'+name
FILES['extend/noa.design.php']='deploy/noa-design.extend.php'
FILES['data/noa-audio/.htaccess']='deploy/noa-legacy-audio.htaccess'
FILES['extend/noa.access.php']='deploy/noa-access.extend.php'
NEW={'noa-bridge/member-access.php','noa-bridge/creator-core.php','noa-bridge/creator.php','noa-bridge/legacy-audio.php','noa-creator.js','noa-creator.css','noa-creator.php','noa-channel.php','data/noa-audio/.htaccess','extend/noa.access.php'}
PROTECTED=['common.php','data/dbconfig.php','bbs/login.php','bbs/login_check.php','bbs/board.php','noa-music.php','noa-youtube.php','noa-world.php','noa-app/engine/n80.php','noa-app/jukebox/service.php','noa-bridge/youtube-thumbnail.php']
BACKUP=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-member-before.json'
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 out=Path('member-proof');out.mkdir(exist_ok=True);rollback='rollback' in sys.argv;desired={p:Path(v).read_bytes()for p,v in FILES.items()};known={p:{sha(subprocess.check_output(['git','show',c+':'+v]))for c in subprocess.check_output(['git','log','--format=%H','--',v],text=True).splitlines()}for p,v in FILES.items()}
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t,window_size=8388608) as s:
   s.get_channel().settimeout(60)
   if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_NOA_root')
   def read(path):
    try:info=s.lstat(ROOT+'/'+path)
    except FileNotFoundError:return None
    if not stat.S_ISREG(info.st_mode):raise RuntimeError('nonregular_target:'+path)
    with s.open(ROOT+'/'+path,'rb')as f:
     if info.st_size>32768:f.prefetch(file_size=info.st_size,max_concurrent_requests=32)
     return f.read()
   def put(path,data):
    with s.open(ROOT+'/'+path,'wx')as f:f.set_pipelined(True);f.write(data)
    s.chmod(ROOT+'/'+path,0o644)
    if read(path)!=data:raise RuntimeError('temporary_hash_mismatch:'+path)
   if rollback:
    for p,v in reversed(list(json.loads(BACKUP.read_text()).items())):
     old=base64.b64decode(v)if v is not None else None;current=read(p)
     if current==old:continue
     if current!=desired[p]:raise RuntimeError('rollback_concurrent_change:'+p)
     if old is None:s.remove(ROOT+'/'+p)
     else:
      parts=p.rsplit('/',1);temp=(parts[0]+'/.'+parts[1]if len(parts)==2 else '.'+p)+'.rollback-'+os.environ['GITHUB_SHA'][:12];put(temp,old);s.posix_rename(ROOT+'/'+temp,ROOT+'/'+p)
    print('MEMBER_RELEASE_OWNED_SOURCES_RESTORED');return
   before={p:read(p)for p in FILES};protected={p:sha(read(p))for p in PROTECTED}
   for p,v in before.items():
    if v is None and p not in NEW:raise RuntimeError('missing_existing_source:'+p)
    if v is not None and sha(v)not in known[p]:raise RuntimeError('unknown_operating_version_preserved:'+p)
   # Verify the installed GnuBoard resolves the member before loading additive extensions.
   common=read('common.php').decode('utf-8','replace');member_pos=common.find("$member = array");extend_pos=common.find("G5_EXTEND_PATH")
   if extend_pos<0 or common.rfind('$member',0,extend_pos)<0:raise RuntimeError('GnuBoard_extension_order_requires_review')
   media=[]
   for p in sorted([*Path('public/splash').glob('*.jpg'),*Path('public/splash').glob('*.mp4'),*Path('public/coming').glob('*.jpg'),Path('public/splash-portrait.jpg')]):
    remote='noa-assets/'+str(p.relative_to('public'));expected=sha(p.read_bytes())
    # An active, known ACL was installed only after the preceding complete media audit.
    # Re-check unchanged video sizes on follow-up source releases rather than transfer all 76 MB again.
    if p.suffix=='.mp4' and before['extend/noa.access.php'] is not None:
     try:info=s.lstat(ROOT+'/'+remote)
     except FileNotFoundError:info=None
     row={'path':remote,'bytes':info.st_size if info else 0,'sha256':None,'verification':'size_after_preceding_release_full_SHA256_audit','match':info is not None and stat.S_ISREG(info.st_mode) and info.st_size==p.stat().st_size}
    else:
     actual=read(remote);row={'path':remote,'bytes':len(actual)if actual else 0,'sha256':sha(actual)if actual else None,'verification':'SHA256','match':actual is not None and sha(actual)==expected}
    media.append(row)
    if len(media)%15==0:print('OPERATING_MEDIA_AUDIT_PROGRESS',len(media),flush=True)
   (out/'hero-media.json').write_text(json.dumps({'images':sum(r['path'].endswith('.jpg')for r in media),'videos':sum(r['path'].endswith('.mp4')for r in media),'rows':media},indent=2))
   bad=[r['path']for r in media if not r['match']]
   if bad:raise RuntimeError('hero_asset_inventory_mismatch:'+','.join(bad))
   print('OPERATING_HERO_ASSETS_VERIFIED',len(media),'60_IMAGES 45_VIDEOS')
   BACKUP.write_text(json.dumps({p:base64.b64encode(v).decode()if v is not None else None for p,v in before.items()}));BACKUP.chmod(0o600)
   for directory in ['data/noa-audio']:
    try:info=s.lstat(ROOT+'/'+directory)
    except FileNotFoundError:s.mkdir(ROOT+'/'+directory,0o755)
    else:
     if not stat.S_ISDIR(info.st_mode):raise RuntimeError('unsafe_directory:'+directory)
    if s.normalize(ROOT+'/'+directory)!=ROOT+'/'+directory:raise RuntimeError('noncanonical_directory')
   temps={}
   for p,data in desired.items():
    if before[p]==data:continue
    parts=p.rsplit('/',1);temp=(parts[0]+'/.'+parts[1]if len(parts)==2 else '.'+p)+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
    if read(temp)is not None:raise RuntimeError('temporary_exists:'+p)
    put(temp,data);temps[p]=temp
   if any(read(p)!=v for p,v in before.items()):raise RuntimeError('concurrent_operating_change')
   changed=[];final={}
   for p,data in desired.items():
    if p in temps:s.posix_rename(ROOT+'/'+temps[p],ROOT+'/'+p);changed.append(p)
    actual=read(p)
    if actual!=data:raise RuntimeError('final_hash_mismatch:'+p)
    final[p]=sha(actual)
   if any(sha(read(p))!=v for p,v in protected.items()):raise RuntimeError('protected_source_changed')
   receipt={'commit':os.environ['GITHUB_SHA'],'changed':changed,'sha256':final,'protectedUnchanged':len(PROTECTED),'memberRowsChanged':0,'existingDataChanged':0,'GnuBoardMemberBeforeExtensions':True,'heroAssetsVerified':len(media)}
   (out/'deployment.json').write_text(json.dumps(receipt,indent=2));print('NOA_MEMBER_SCOPED_DEPLOYED',json.dumps(receipt))
 finally:t.close()
 for p in FILES:
  if p.endswith(('.js','.css')):
   with urllib.request.urlopen(urllib.request.Request('https://noastudio.ai.kr/'+p+'?audit='+os.environ['GITHUB_SHA'][:12],headers={'Cache-Control':'no-cache'}),timeout=45)as r:
    if r.read()!=desired[p]:raise RuntimeError('public_asset_hash_mismatch:'+p)
if __name__=='__main__':main()
