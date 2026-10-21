"""Deploy authorized root entrypoint only; private verified backups and automatic rollback."""
import os,stat,json,base64,hashlib,urllib.request
from pathlib import Path
import paramiko

ROOT='/hosting/noastudio/html'
FILES={'noa-app/home.php':'deploy/noa-app/home.php','index.php':'deploy/index.php','extend/noa.home.php':'deploy/noa-home.extend.php'}
BASE={'noa-app/home.php':None,'index.php':'99bd395515b6a15e9f94402493cbf06243be40f9b361ffe67aeb26dc1fd9c7d9','extend/noa.home.php':'0e18254726f04a14e7d98aa2624c00f448893a5b5c72270486141be5a5f75a1b'}
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('Host key mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
  s=paramiko.SFTPClient.from_transport(t)
  assert s.normalize(ROOT)==ROOT
  def read(path):
   try:
    if not stat.S_ISREG(s.lstat(path).st_mode):raise RuntimeError('Not a regular file: '+path)
    with s.open(path,'rb') as f:return f.read()
   except FileNotFoundError:return None
  def digest(path):
   b=read(path);return sha(b) if b is not None else None
  def mkdir(path,mode):
   try:s.mkdir(path,mode)
   except OSError:
    if not stat.S_ISDIR(s.lstat(path).st_mode):raise
  runid=os.environ['GITHUB_RUN_ID']
  parent='/hosting/noastudio/noa-deploy-backups'
  mkdir(parent,0o700);assert s.normalize(parent)==parent
  backup=parent+'/root-20261021-'+runid
  s.mkdir(backup,0o700)
  old={p:read(ROOT+'/'+p) for p in FILES}
  expected={p:sha(Path(local).read_bytes()) for p,local in FILES.items()}
  for p,data in old.items():
   if (sha(data) if data is not None else None)!=BASE[p]:raise RuntimeError('Concurrent or unknown production version: '+p)
  core=['common.php','_common.php','config.php','data/dbconfig.php','head.php','tail.php','version.php','bbs/login.php','bbs/login_check.php','bbs/logout.php','.htaccess']
  protected=sorted(set(core+[p for p in s.listdir(ROOT) if p.startswith('noa') and p.endswith(('.php','.js','.css','.json'))]))
  protected_hash={p:digest(ROOT+'/'+p) for p in protected}
  for p,data in old.items():
   if data is None:continue
   target=backup+'/'+p
   for folder in list(Path(p).parents)[:-1][::-1]:
    if str(folder)!='.':mkdir(backup+'/'+str(folder),0o700)
   with s.open(target,'wx') as f:f.write(data)
   s.chmod(target,0o600)
   if digest(target)!=sha(data):raise RuntimeError('Backup checksum mismatch')
  manifest={'source_commit':os.environ['GITHUB_SHA'],'backup':backup,'previous_hashes':BASE,'new_hashes':expected,'protected_hashes':protected_hash}
  with s.open(backup+'/manifest.json','wx') as f:f.write(json.dumps(manifest,indent=2).encode())
  s.chmod(backup+'/manifest.json',0o600)
  print('VERIFIED_PRIVATE_BACKUP '+json.dumps(manifest))
  mkdir(ROOT+'/noa-app',0o755)
  def atomic(path,data):
   # Never stage PHP inside extend/: GnuBoard automatically includes it.
   tmp=ROOT+'/noa-bridge/.root-release-'+runid+'-'+path.replace('/','_')+'.upload.php'
   with s.open(tmp,'wx') as f:f.write(data)
   s.chmod(tmp,0o644)
   if digest(tmp)!=sha(data):raise RuntimeError('Upload checksum mismatch')
   s.posix_rename(tmp,ROOT+'/'+path)
   if digest(ROOT+'/'+path)!=sha(data):raise RuntimeError('Installed checksum mismatch')
  changed=[]
  try:
   for p,local in FILES.items():
    if digest(ROOT+'/'+p)!=BASE[p]:raise RuntimeError('Concurrent server change: '+p)
    atomic(p,Path(local).read_bytes());changed.append(p);print('UPDATED '+p+' sha256 '+expected[p])
   for p,h in protected_hash.items():
    if digest(ROOT+'/'+p)!=h:raise RuntimeError('Protected file changed: '+p)
   for route in ['/','/index.php','/noa2.php','/noa2.php?compat=1']:
    req=urllib.request.Request('https://noastudio.ai.kr'+route,headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(req,timeout=30) as response:
     body=response.read().decode()
     assert response.status==200 and 'Music beyond' in body and 'PHP Fatal' not in body
     assert '/noa2.php' not in response.geturl()
     print('ROOT_HTTP_VERIFIED '+json.dumps({'requested':route,'final':response.geturl(),'status':response.status,'cache':response.headers.get('Cache-Control')}))
  except Exception:
   for p in reversed(changed):
    if old[p] is not None:
     if digest(ROOT+'/'+p)!=expected[p]:raise RuntimeError('Rollback blocked by concurrent change: '+p)
     atomic(p,old[p]);print('ROLLED_BACK '+p)
   raise
  print('ROOT_RELEASE_SUCCESS '+json.dumps({'source_commit':os.environ['GITHUB_SHA'],'backup':backup,'changed':list(FILES),'protected_unchanged':len(protected_hash),'sql_migrations':False}))
 finally:t.close()
if __name__=='__main__':main()
