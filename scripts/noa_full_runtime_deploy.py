"""Reconcile reviewed main runtime code only. No migrations, source-data imports or core edits."""
import os,json,stat,subprocess,time,urllib.request,urllib.error,sys
from noa_deploy_guard import deployment_preflight
from pathlib import Path
from collections import Counter
from noa_full_inventory import mappings,connect,sha,ROOT

def main():
 allmap=mappings()
 # Large original assets are being independently hashed; deploy only runtime modules here.
 protected_work={'noa-music.php','noa-bridge/catalog.php','noa-jukebox/.htaccess'}
 m={r:l for r,l in allmap.items()if not r.startswith(('noa-assets/','noa-app/jukebox/')) and r not in protected_work and r not in ['noa-bridge/seed.php','noa-bridge/source-archive.php','noa-bridge/catalog-seed.php']}
 preflight=None
 t=connect();s=t.open_sftp_client() if hasattr(t,'open_sftp_client')else __import__('paramiko').SFTPClient.from_transport(t)
 s.get_channel().settimeout(30)
 def read(p):
  try:
   st=s.lstat(p)
   if not stat.S_ISREG(st.st_mode):raise RuntimeError('nonregular_target '+p)
   with s.open(p,'rb')as f:f.prefetch(file_size=st.st_size,max_concurrent_requests=8);return f.read()
  except FileNotFoundError:return None
 def mkdir(p,mode=0o755):
  try:s.mkdir(p,mode)
  except OSError:
   if not stat.S_ISDIR(s.lstat(p).st_mode):raise
  assert s.normalize(p)==p
 try:
  assert s.normalize(ROOT)==ROOT;rows=[];pending=[];old={};unknown=[]
  for remote,local in m.items():
   b=Path(local).read_bytes();actual=read(ROOT+'/'+remote);expected=sha(b);known=None
   if actual==b:state='match'
   elif actual is None:state='missing'
   else:
    for commit in subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines():
     try:past=subprocess.check_output(['git','show',commit+':'+local],stderr=subprocess.DEVNULL)
     except subprocess.CalledProcessError:continue
     if past==actual:known=commit;break
    state='different'if known else'unknown_preserved'
   rows.append({'remote':remote,'source':local,'state':state,'beforeSha256':sha(actual)if actual is not None else None,'afterSha256':expected,'previousMainCommit':known})
   if state=='unknown_preserved':unknown.append(remote)
   if state in ['missing','different']:pending.append((remote,b));old[remote]=actual
  proof=Path('full-release-proof');proof.mkdir(exist_ok=True)
  (proof/'code-before.json').write_text(json.dumps(rows,indent=2))
  print('CODE_PLAN '+json.dumps({'counts':dict(Counter(r['state']for r in rows)),'pending':[r for r in rows if r['state']!='match']}),flush=True)
  cache_only=os.environ.get('NOA_P0_CACHE_ONLY')=='1'
  cache_targets={'noa-app/home.php','noa-app/world-view.php','noa-my.php','noa-youtube.php'}
  if cache_only and (unknown or any(r not in cache_targets for r,b in pending)):
   raise RuntimeError('cache_dependencies_not_deployed; preserve active owner release')
  protected=['common.php','config.php','data/dbconfig.php','_common.php','head.php','tail.php','bbs/login.php','bbs/login_check.php','bbs/logout.php','version.php']
  guard={p:sha(read(ROOT+'/'+p))for p in protected}
  if not pending:
   result={'commit':os.environ['GITHUB_SHA'],'changed':[],'changedCount':0,'preservedUnknown':unknown,'sqlMigrations':False,'protectedJukeboxExcluded':True,'backupRequired':False}
   (proof/'release.json').write_text(json.dumps(result,indent=2));print('FULL_RUNTIME_RELEASE '+json.dumps(result),flush=True);return
  for remote,b in pending:
   local=m[remote]
   if local.endswith('.php'):subprocess.run(['php','-l',local],check=True)
   if local.endswith('.js'):subprocess.run(['node','--check',local],check=True)
  available=None
  try:
   _,capacity=s._request(__import__('paramiko').sftp.CMD_EXTENDED,'statvfs@openssh.com',ROOT)
   values=[capacity.get_int64()for _ in range(11)];available=values[1]*values[4]
  except OSError:pass
  required=sum(len(b)+(len(old[r])if old[r]else 0)for r,b in pending)
  preflight=deployment_preflight(s,'/hosting/noastudio/noa-deploy-backups',os.environ['GITHUB_RUN_ID'],required,available)
  backup=preflight.__enter__()
  for remote,b in pending:
   if old[remote]is None:continue
   target=backup+'/'+remote
   parent=backup
   for part in remote.split('/')[:-1]:parent+='/'+part;mkdir(parent,0o700)
   with s.open(target,'wx')as f:f.write(old[remote])
   s.chmod(target,0o600);assert read(target)==old[remote]
  manifest={'commit':os.environ['GITHUB_SHA'],'backup':backup,'files':rows,'protectedHashes':guard}
  with s.open(backup+'/manifest.json','wx')as f:f.write(json.dumps(manifest).encode())
  s.chmod(backup+'/manifest.json',0o600)
  # Prepare all versions first; dependency files activate before endpoints/views.
  pending.sort(key=lambda x:(0 if x[0].startswith('noa-bridge/')and x[0]!='noa-bridge/home.php'else 1 if x[0].endswith(('.js','.css'))else 2))
  staged={};installed=[]
  for remote,b in pending:
   parent=ROOT
   for part in remote.split('/')[:-1]:parent+='/'+part;mkdir(parent)
   temp=ROOT+'/noa-bridge/.full-'+os.environ['GITHUB_RUN_ID']+'-'+remote.replace('/','_')+'.upload.php'
   with s.open(temp,'wx')as f:f.write(b)
   s.chmod(temp,0o644);assert read(temp)==b;staged[remote]=temp
  try:
   # Compare every original again immediately before activation.
   for remote,b in pending:
    if read(ROOT+'/'+remote)!=old[remote]:raise RuntimeError('concurrent_change '+remote)
   for remote,b in pending:
    if read(ROOT+'/'+remote)!=old[remote]:raise RuntimeError('concurrent_change_before_activation '+remote)
    s.posix_rename(staged[remote],ROOT+'/'+remote);installed.append((remote,b));assert read(ROOT+'/'+remote)==b
    print('UPDATED '+remote+' '+sha(b),flush=True)
   for p,digest in guard.items():assert sha(read(ROOT+'/'+p))==digest,'core_changed '+p
   for path in ['/','/index.php','/noa-bridge/home.php','/noa-world.php','/noa-youtube.php','/noa-music.php','/noa-my.php','/bbs/login.php']:
    with urllib.request.urlopen(urllib.request.Request('https://noastudio.ai.kr'+path,headers={'Cache-Control':'no-cache'}),timeout=30)as r:
     body=r.read();assert r.status==200
     if cache_only and path in ['/','/index.php','/noa-world.php','/noa-youtube.php','/noa-my.php']:assert b'20261021-p0-final' in body,'cache_url_not_updated '+path
     if path=='/noa-bridge/home.php':
      data=json.loads(body);assert data['ok'];print('LIVE_HOME_COUNTS '+json.dumps({k:len(data[k])for k in ['stories','covers','playlists']}),flush=True)
   result={'commit':os.environ['GITHUB_SHA'],'backup':backup,'changed':[r for r,b in pending],'changedCount':len(pending),'preservedUnknown':unknown,'coreUnchanged':True,'sqlMigrations':False,'deployedAtUTC':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
   (proof/'release.json').write_text(json.dumps(result,indent=2));print('FULL_RUNTIME_RELEASE '+json.dumps(result),flush=True)
  except Exception:
   for remote,b in reversed(installed):
    if old[remote]is not None:
     if read(ROOT+'/'+remote)!=b:raise RuntimeError('rollback_concurrent_change '+remote)
     temp=ROOT+'/noa-bridge/.rollback-'+os.environ['GITHUB_RUN_ID']+'-'+remote.replace('/','_')+'.php'
     with s.open(temp,'wx')as f:f.write(old[remote])
     s.chmod(temp,0o644);s.posix_rename(temp,ROOT+'/'+remote)
   raise
 finally:
  try:
   if preflight is not None:preflight.__exit__(*sys.exc_info())
  finally:t.close()
if __name__=='__main__':main()
