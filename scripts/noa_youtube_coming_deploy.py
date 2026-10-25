"""NOA-only, metadata-only Coming soon release. No database or YouTube writes."""
import base64,hashlib,json,os,stat,subprocess,sys,urllib.request
from pathlib import Path
import paramiko
from noa_full_inventory import connect,ROOT
FILES={'noa-bridge/youtube-catalog.php':'bridge/youtube-catalog.php','noa-browse-edit.js':'deploy/noa-browse-edit.js','noa-browse.js':'deploy/noa-browse.js','noa-youtube.js':'deploy/noa-youtube.js','noa-youtube.css':'deploy/noa-youtube.css'}
for p in sorted(Path('public/coming').glob('*.jpg')):FILES['noa-assets/coming/'+p.name]=str(p)
FILES.update({'noa-music.php':'deploy/noa-music.php','noa-youtube.php':'deploy/noa-youtube.php'})
NEW={'noa-bridge/youtube-catalog.php',*(p for p in FILES if p.startswith('noa-assets/coming/'))}
PROTECTED=['common.php','bbs/login.php','bbs/login_check.php','bbs/board.php','noa-bridge/youtube-thumbnail.php','noa-app/home.php']
BACKUP=Path(os.environ.get('RUNNER_TEMP','/tmp'))/'noa-coming-release-before.json'
def sha(v):return hashlib.sha256(v).hexdigest()
def get(path):
 with urllib.request.urlopen(urllib.request.Request('https://noastudio.ai.kr/'+path,headers={'Cache-Control':'no-cache'}),timeout=60) as r:return r.read()
def embedded(html,marker):
 i=html.index(marker)+len(marker);return json.JSONDecoder().raw_decode(html[i:])[0]
def main():
 out=Path('youtube-coming-proof');out.mkdir(exist_ok=True);rollback='rollback' in sys.argv
 if not rollback:
  before_rows=embedded(get('noa-youtube.php').decode(),'const rows=');music=embedded(get('noa-music.php').decode(),'const records=');(out/'before.json').write_text(json.dumps({'publicIds':[r['video'] for r in before_rows if r.get('video')],'musicKeys':[r.get('orderKey') or r['key'] for r in music if r['kind']!='playlist']}))
 desired={remote:Path(local).read_bytes() for remote,local in FILES.items()};known={}
 if not rollback:
  for remote,local in FILES.items():known[remote]={sha(subprocess.check_output(['git','show',c+':'+local])) for c in subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines()}
 t=connect()
 try:
  with paramiko.SFTPClient.from_transport(t) as s:
   s.get_channel().settimeout(30)
   if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_NOA_root')
   def read(path):
    try:info=s.lstat(ROOT+'/'+path)
    except FileNotFoundError:return None
    if not stat.S_ISREG(info.st_mode):raise RuntimeError('nonregular_target:'+path)
    with s.open(ROOT+'/'+path,'rb') as f:return f.read()
   if rollback:
    saved=json.loads(BACKUP.read_text())
    for remote,entry in reversed(list(saved.items())):
     old=base64.b64decode(entry['before']) if entry['before'] is not None else None
     if old is None or read(remote)==old:continue
     if read(remote)!=desired[remote]:raise RuntimeError('rollback_concurrent_change:'+remote)
     temp=remote.rsplit('/',1);temp=temp[0]+'/.rollback-'+temp[-1] if len(temp)==2 else '.rollback-'+remote
     if read(temp) is not None:raise RuntimeError('rollback_temporary_exists')
     with s.open(ROOT+'/'+temp,'wx') as f:f.write(old)
     if read(temp)!=old:raise RuntimeError('rollback_readback')
     s.posix_rename(ROOT+'/'+temp,ROOT+'/'+remote)
    print('COMING_RELEASE_OWNED_SOURCES_RESTORED');return
   before={p:read(p) for p in FILES};protected={p:sha(read(p)) for p in PROTECTED}
   for remote,old in before.items():
    if old is None and remote not in NEW:raise RuntimeError('missing_existing_target:'+remote)
    if old is not None and sha(old) not in known[remote]:raise RuntimeError('unknown_remote_preserved:'+remote)
   BACKUP.write_text(json.dumps({p:{'before':base64.b64encode(v).decode() if v is not None else None} for p,v in before.items()}));BACKUP.chmod(0o600)
   directory=ROOT+'/noa-assets/coming'
   try:info=s.lstat(directory)
   except FileNotFoundError:s.mkdir(directory,0o755)
   else:
    if not stat.S_ISDIR(info.st_mode):raise RuntimeError('unsafe_asset_directory')
   if s.normalize(directory)!=directory:raise RuntimeError('noncanonical_asset_directory')
   temps={}
   for remote,data in desired.items():
    if before[remote]==data:continue
    parts=remote.rsplit('/',1);temp=parts[0]+'/.'+parts[-1] if len(parts)==2 else '.'+remote;temp+='.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
    if read(temp) is not None:raise RuntimeError('temporary_exists:'+remote)
    with s.open(ROOT+'/'+temp,'wx') as f:f.write(data)
    s.chmod(ROOT+'/'+temp,0o644)
    if read(temp)!=data:raise RuntimeError('temporary_hash_mismatch:'+remote)
    temps[remote]=temp
   if any(read(p)!=v for p,v in before.items()):raise RuntimeError('concurrent_operating_change')
   changed=[]
   for remote,data in desired.items():
    if remote in temps:s.posix_rename(ROOT+'/'+temps[remote],ROOT+'/'+remote);changed.append(remote)
    if read(remote)!=data:raise RuntimeError('final_hash_mismatch:'+remote)
   if any(sha(read(p))!=digest for p,digest in protected.items()):raise RuntimeError('protected_source_changed')
   receipt={'commit':os.environ['GITHUB_SHA'],'changed':changed,'sha256':{p:sha(read(p)) for p in FILES},'protectedUnchanged':len(PROTECTED),'databaseWrites':0,'youtubeWrites':0}
 finally:t.close()
 for remote in FILES:
  if remote.endswith(('.js','.css','.jpg')):
   if get(remote+'?audit='+os.environ['GITHUB_SHA'][:12])!=desired[remote]:raise RuntimeError('public_asset_hash_mismatch:'+remote)
 for page in ['noa-music.php','noa-youtube.php']:
  html=get(page).decode();assert 'v='+sha(desired['noa-browse.js']) in html,'stale_shared_browse_cache'
 (out/'deployment.json').write_text(json.dumps(receipt,indent=2));print('NOA_COMING_SCOPED_DEPLOYED',json.dumps(receipt))
if __name__=='__main__':main()
