"""Pinned SFTP + HMAC service operations. Never prints credentials or raw DB rows.
prepare deploys ONLY new fixed-operation modules, creates a private fresh backup.
activate requires isolated restoration tests to have passed before additive SQL.
"""
import os,json,hashlib,base64,hmac,secrets,time,stat,subprocess,urllib.request,urllib.error
from pathlib import Path
import paramiko
BASE='a2ffa6d00940536927f3eae00355a79d1db8b1b2'
ROOT='/hosting/noastudio/html'
FINGERPRINT='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
NEW={str(p):'noa-bridge/'+p.name for p in Path('bridge').glob('taxonomy*.php')}
UI={str(p):str(p.relative_to('deploy')) for p in Path('deploy/noa-app/taxonomy').glob('*')if p.is_file()}
UI.update({'deploy/noa-taxonomy-browse.js':'noa-taxonomy-browse.js','deploy/noa-taxonomy.extend.php':'extend/noa.taxonomy.php'})
HOOKS={p:'noa-bridge/'+Path(p).name for p in ['bridge/youtube-store.php','bridge/lab-creator.php','bridge/home-core.php','bridge/world-mv.php']}
HOOKS['deploy/noa-music.php']='noa-music.php'
def digest(b):return hashlib.sha256(b).hexdigest()
def service(key,action,**body):
 raw=json.dumps({'action':action,**body},separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16)
 msg='NOA-TAXONOMY-1\nPOST\n'+digest(raw)+'\n'+ts+'\n'+nonce
 headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key.encode(),msg.encode(),hashlib.sha256).hexdigest()}
 req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/taxonomy-worker.php',data=raw,headers=headers,method='POST')
 try:
  with urllib.request.urlopen(req,timeout=180)as r:out=json.load(r)
 except urllib.error.HTTPError as e:
  try:err=json.load(e).get('error','request_failed')
  except Exception:err='request_failed'
  raise RuntimeError('taxonomy_service_'+str(e.code)+':'+err)from None
 if not out.get('ok'):raise RuntimeError('taxonomy_service_failed')
 return out

def main():
 phase=os.environ.get('NOA_TAXONOMY_PHASE','prepare');t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.use_compression(True)
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=FINGERPRINT:raise RuntimeError('host_key_mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
  with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(256).decode().strip()
  if len(key)!=64:raise RuntimeError('invalid_service_key')
  def read(path):
   try:
    if not stat.S_ISREG(s.lstat(path).st_mode):raise RuntimeError('nonregular_target')
    with s.open(path,'rb')as f:return f.read()
   except FileNotFoundError:return None
  def mkdir(path,mode=0o755):
   try:s.mkdir(path,mode)
   except OSError:
    if not stat.S_ISDIR(s.lstat(path).st_mode):raise
   if s.normalize(path)!=path:raise RuntimeError('symlink_directory')
  protected=['index.php','common.php','config.php','data/dbconfig.php','bbs/login.php','extend/noa.home.php']
  core={p:digest(read(ROOT+'/'+p)) for p in protected}
  backup='/hosting/noastudio/noa-ai-lab/taxonomy-release-'+os.environ['GITHUB_RUN_ID'];mkdir(backup,0o700)
  targets=NEW if phase=='prepare' else {**NEW,**UI,**HOOKS}
  manifest={};changed=[]
  for local,remote in targets.items():
   data=Path(local).read_bytes();old=read(ROOT+'/'+remote);expected=digest(data)
   if old is not None and digest(old)!=expected:
    if local in HOOKS:baseline=subprocess.check_output(['git','show',BASE+':'+local])
    elif local in NEW:
     # Only a prior reviewed taxonomy commit in this repository can be upgraded.
     baseline=None
     commits=subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines()
     for commit in commits:
      candidate=subprocess.check_output(['git','show',commit+':'+local])
      if digest(candidate)==digest(old):baseline=candidate;break
     if baseline is None:raise RuntimeError('unknown_taxonomy_module:'+remote)
    else:
     baseline=None
     for commit in subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines():
      candidate=subprocess.check_output(['git','show',commit+':'+local])
      if digest(candidate)==digest(old):baseline=candidate;break
     if baseline is None:raise RuntimeError('unknown_admin_module:'+remote)
    if digest(old)!=digest(baseline):raise RuntimeError('concurrent_source_change:'+remote)
   manifest[remote]={'before':digest(old)if old is not None else None,'after':expected}
  # Stage all files before any activation; exact comparison repeated before rename.
  staged=[]
  mkdir(ROOT+'/noa-app');mkdir(ROOT+'/noa-app/taxonomy')
  for local,remote in targets.items():
   data=Path(local).read_bytes();current=read(ROOT+'/'+remote);m=manifest[remote]
   if current is not None and digest(current)==m['after']:continue
   if current is not None:
    with s.open(backup+'/'+remote.replace('/','__'),'wx')as f:f.write(current)
    s.chmod(backup+'/'+remote.replace('/','__'),0o600)
   temp=ROOT+'/noa-app/taxonomy/.stage-'+secrets.token_hex(8)+'.tmp'
   with s.open(temp,'wx')as f:f.write(data)
   s.chmod(temp,0o644)
   if digest(read(temp))!=m['after']:raise RuntimeError('staging_checksum')
   staged.append((temp,remote,m))
  for temp,remote,m in staged:
   current=read(ROOT+'/'+remote)
   if (digest(current)if current is not None else None)!=m['before']:raise RuntimeError('concurrent_target_change')
   s.posix_rename(temp,ROOT+'/'+remote);changed.append(remote)
  for p,h in core.items():
   if digest(read(ROOT+'/'+p))!=h:raise RuntimeError('protected_core_changed')
  with s.open(backup+'/manifest.json','w')as f:f.write(json.dumps(manifest).encode())
  s.chmod(backup+'/manifest.json',0o600)
  Path('quality-taxonomy').mkdir(exist_ok=True)
  if phase=='prepare':
   inventory=service(key,'inspect');report=service(key,'backup');Path('quality-taxonomy/baseline-private.json').write_text(json.dumps(inventory));Path('quality-taxonomy/backup-meta.json').write_text(json.dumps(report));print('NOA_TAXONOMY_PREPARED '+json.dumps({'inventory':report['inventory'],'backupSha256':report['backup']['sha256'],'backupBytes':report['backup']['bytes'],'backupTables':len(report['backup']['tables']),'codeUploaded':changed,'sqlApplied':False}))
  elif phase=='activate':
   proof=json.loads(Path('quality-taxonomy/report.json').read_text());backup_meta=json.loads(Path('quality-taxonomy/backup-meta.json').read_text())
   if not proof['allPreexistingTablesPreserved'] or not proof['replaySafe'] or not proof['productionEditsSurviveRedeploy']:raise RuntimeError('isolated_validation_not_verified')
   # Only the fixed additive bootstrap is allowed; no submitted SQL/paths/commands.
   report=service(key,'bootstrap',verifiedBackupSha256=backup_meta['backup']['sha256'],isolatedRestoreVerified=True)
   Path('quality-taxonomy/production.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('NOA_TAXONOMY_LIVE '+json.dumps(report,ensure_ascii=False))
   public=urllib.request.urlopen('https://noastudio.ai.kr/noa-bridge/taxonomy.php',timeout=30);d=json.load(public)
   if not d.get('installed'):raise RuntimeError('public_taxonomy_not_active')
   print('Production public classification videos:',len(d['videos']))
  else:raise RuntimeError('invalid_release_phase')
 finally:t.close()
if __name__=='__main__':main()
