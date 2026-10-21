"""Deploy only the additive database module; preserve core, root entrypoint and DB."""
import os,stat,json,base64,hashlib,urllib.request,urllib.error
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
FILES={str(p.relative_to('deploy')):str(p) for p in Path('deploy/noa-app/database').glob('*') if p.is_file()}
FILES['extend/noa.database.php']='deploy/noa-database.extend.php'
BASE={'noa-app/database/index.php':'9bd381a72581cf8fd3176fc3a74be259d6390301b8761c285ce8d0b583bffe96','noa-app/database/ui.js':'610b6eefaebaa223cf7b1632adae2c5a056b5a69fb901bbf11bf7477455c0118'} # Only this reviewed previous module version may be replaced.
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('Host key mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t)
  assert s.normalize(ROOT)==ROOT
  def read(path):
   try:
    if not stat.S_ISREG(s.lstat(path).st_mode):raise RuntimeError('Nonregular target: '+path)
    with s.open(path,'rb') as f:return f.read()
   except FileNotFoundError:return None
  def digest(path):
   data=read(path);return sha(data) if data is not None else None
  def mkdir(path,mode):
   try:s.mkdir(path,mode)
   except OSError:
    if not stat.S_ISDIR(s.lstat(path).st_mode):raise
   assert s.normalize(path)==path
  core=['index.php','common.php','config.php','data/dbconfig.php','bbs/login.php','bbs/login_check.php','version.php','extend/noa.home.php']
  protected={p:digest(ROOT+'/'+p) for p in core}
  expected={p:sha(Path(local).read_bytes()) for p,local in FILES.items()}
  old={p:read(ROOT+'/'+p) for p in FILES}
  for p,data in old.items():
   if data is not None and sha(data) not in [expected[p],BASE.get(p)]:raise RuntimeError('Concurrent/unknown module exists: '+p)
  private='/hosting/noastudio/noa-db-private';mkdir(private,0o700);s.chmod(private,0o700)
  mkdir(ROOT+'/noa-app',0o755);mkdir(ROOT+'/noa-app/database',0o755)
  changes=[]
  for p,local in FILES.items():
   if digest(ROOT+'/'+p)==expected[p]:continue
   assert read(ROOT+'/'+p)==old[p]
   temp=ROOT+'/noa-app/database/.release-'+os.environ['GITHUB_RUN_ID']+'-'+p.replace('/','_')+'.tmp'
   with s.open(temp,'wx') as f:f.write(Path(local).read_bytes())
   s.chmod(temp,0o644);assert digest(temp)==expected[p]
   # Extension activates last; staging outside extend avoids accidental includes.
   s.posix_rename(temp,ROOT+'/'+p);assert digest(ROOT+'/'+p)==expected[p];changes.append(p)
  for p,h in protected.items():assert digest(ROOT+'/'+p)==h,'Protected file changed: '+p
  routes={}
  for path in ['/noa-app/database/','/noa-app/database/index.php','/noa-app/database/core.php']:
   try:r=urllib.request.urlopen('https://noastudio.ai.kr'+path,timeout=30)
   except urllib.error.HTTPError as e:r=e
   assert r.status==403,(path,r.status);routes[path]=r.status
  for path in ['/noa-app/database/ui.js','/noa-app/database/style.css','/']:
   with urllib.request.urlopen('https://noastudio.ai.kr'+path,timeout=30) as r:assert r.status==200
  # CLI-only read/backup probe: outside web root, no web auth bypass or public script.
  probe=private+'/release-probe-'+os.environ['GITHUB_RUN_ID']+'.php'
  code='''<?php
  $_SERVER['REQUEST_METHOD']='CLI';$_SERVER['REQUEST_URI']='/noa-db-cli';$_SERVER['SERVER_NAME']='noastudio.ai.kr';$_SERVER['HTTP_HOST']='noastudio.ai.kr';$_SERVER['REMOTE_ADDR']='127.0.0.1';
  ob_start();require '/hosting/noastudio/html/common.php';ob_end_clean();require '/hosting/noastudio/html/noa-app/database/core.php';
  try{$db=nd_db();$t=nd_tables($db);$s=nd_rows($db,'SELECT VERSION() AS version,@@session.transaction_read_only AS readOnly')[0];
  $result=['connection'=>$s,'tableCount'=>count($t),'tables'=>array_map(fn($r)=>['name'=>$r['TABLE_NAME'],'engine'=>$r['ENGINE'],'estimatedRows'=>$r['TABLE_ROWS']],$t)];
  nd_audit('release_probe','ok',['tableCount'=>count($t)]);
  try{$backup=nd_backup($db,null);$result['backup']=['id'=>$backup['id'],'bytes'=>$backup['bytes'],'sha256'=>$backup['sha256'],'tableCount'=>count($backup['tables']),'integrityVerified'=>true,'restoreVerified'=>false];}catch(Throwable $e){$result['backup']=['verified'=>false,'reason'=>$e instanceof PDOException?'SQLSTATE '.$e->getCode():$e->getMessage()];}
  echo 'NOA_DB_PROOF '.json_encode($result,JSON_UNESCAPED_UNICODE)."\\n";
  }catch(Throwable $e){echo 'NOA_DB_PROOF '.json_encode(['connectionVerified'=>false,'errorType'=>get_class($e),'code'=>$e->getCode()])."\\n";exit(2);}
  '''
  try:
   with s.open(probe,'wx') as f:f.write(code.encode())
   s.chmod(probe,0o600)
   channel=t.open_session(timeout=15);channel.settimeout(55);channel.exec_command('php '+probe)
   output=channel.makefile('r').read(65536).decode('utf-8','replace')
   # Do not publish general bootstrap warnings or server configuration; report tagged JSON only.
   lines=[line for line in output.splitlines() if line.startswith('NOA_DB_PROOF ')]
   if lines:print('\n'.join(lines))
   else:print('NOA_DB_PROOF '+json.dumps({'connectionVerified':False,'reason':'Hosting CLI is unavailable; authenticated browser validation required'}))
  except Exception as e:print('NOA_DB_PROOF '+json.dumps({'connectionVerified':False,'reason':'Hosting CLI unavailable','type':type(e).__name__}))
  finally:
   try:s.remove(probe)
   except OSError:pass
  print('DATABASE_RELEASE '+json.dumps({'commit':os.environ['GITHUB_SHA'],'changed':changes,'protectedCoreUnchanged':True,'anonymousRoutes':routes,'productionRestoreExecuted':False}))
 finally:t.close()
if __name__=='__main__':main()
