"""Deploy the reviewed UI file allowlist with pinned SSH, private backup and conditional rollback.
No SQL, member, media or JUKEBOX writes. Unknown server versions abort the whole release.
"""
import base64,hashlib,json,os,stat,subprocess,sys,time,urllib.request
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
BASELINE='018335cb6242f0a352ac7e564bc063f018d5bb9e'
FILES={
 'noa-bridge/home-core.php':'bridge/home-core.php',
 'noa-app/home.php':'deploy/noa-app/home.php',
 'noa-app/world-view.php':'deploy/noa-app/world-view.php',
 **{p:'deploy/'+p for p in ['noa-browse.js','noa-hero.js','noa-home.js','noa-my.php','noa-ui.css','noa-ui.js','noa-world.css','noa-world.js','noa-youtube.css','noa-youtube.php']}}
PROTECTED=['index.php','common.php','config.php','data/dbconfig.php','head.php','tail.php','version.php','bbs/login.php','bbs/login_check.php','noa-music.php']+['noa-app/jukebox/'+p for p in ['index.php','upload-core.php','core.php','upload.php','upload.js','upload.css']]
PROOF=Path('uiux-proof');STATE=PROOF/'release-state.json'
def sha(b):return hashlib.sha256(b).hexdigest()
def connect():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':t.close();raise RuntimeError('SSH host key mismatch; credentials not sent')
 t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
 if s.normalize(ROOT)!=ROOT:t.close();raise RuntimeError('Unexpected production root')
 return t,s
def read(s,p):
 if not stat.S_ISREG(s.lstat(p).st_mode):raise RuntimeError('Nonregular file '+p)
 with s.open(p,'rb') as f:return f.read()
def mkdir(s,p):
 try:s.mkdir(p,0o700)
 except OSError:
  if not stat.S_ISDIR(s.lstat(p).st_mode):raise
 if s.normalize(p)!=p:raise RuntimeError('Unexpected backup path')
def atomic(s,p,b,label):
 tmp=ROOT+'/noa-bridge/.uiux-'+os.environ['GITHUB_RUN_ID']+'-'+label+'-'+p.replace('/','_')+'.upload.php'
 with s.open(tmp,'wx') as f:f.write(b)
 s.chmod(tmp,0o644)
 if read(s,tmp)!=b:raise RuntimeError('Stage checksum mismatch '+p)
 return tmp
def rollback(s,state):
 restored=[]
 for p in reversed(state['changed']):
  current=read(s,ROOT+'/'+p);row=state['files'][p]
  if sha(current)==row['before']:continue
  if sha(current)!=row['after']:raise RuntimeError('Rollback preserves concurrent change; manual review needed: '+p)
  old=read(s,state['backup']+'/'+p)
  if sha(old)!=row['before']:raise RuntimeError('Backup integrity failure '+p)
  tmp=atomic(s,p,old,'rollback');s.posix_rename(tmp,ROOT+'/'+p)
  if sha(read(s,ROOT+'/'+p))!=row['before']:raise RuntimeError('Rollback checksum failure '+p)
  restored.append(p)
 state['rolledBack']=restored;STATE.write_text(json.dumps(state,indent=2));print('UIUX_ROLLBACK '+json.dumps({'restored':restored}),flush=True)
def main():
 PROOF.mkdir(exist_ok=True);t,s=connect()
 try:
  if len(sys.argv)>1 and sys.argv[1]=='rollback':
   if STATE.exists():rollback(s,json.loads(STATE.read_text()))
   return
  old={p:read(s,ROOT+'/'+p) for p in FILES};new={p:Path(local).read_bytes()for p,local in FILES.items()}
  for p,local in FILES.items():
   baseline=subprocess.check_output(['git','show',BASELINE+':'+local])
   if old[p]not in [baseline,new[p]]:raise RuntimeError('Unknown or concurrent production version; nothing changed: '+p)
  protected={p:sha(read(s,ROOT+'/'+p))for p in PROTECTED}
  pending=[p for p in FILES if old[p]!=new[p]];parent='/hosting/noastudio/noa-deploy-backups';mkdir(s,parent)
  backup=parent+'/uiux-20261021-'+os.environ['GITHUB_RUN_ID']+'-'+os.environ.get('GITHUB_RUN_ATTEMPT','1');s.mkdir(backup,0o700)
  if s.normalize(backup)!=backup:raise RuntimeError('Unexpected backup directory')
  for p in pending:
   folder=backup
   for part in p.split('/')[:-1]:folder+='/'+part;mkdir(s,folder)
   with s.open(backup+'/'+p,'wx')as f:f.write(old[p])
   s.chmod(backup+'/'+p,0o600)
   if read(s,backup+'/'+p)!=old[p]:raise RuntimeError('Backup checksum failure '+p)
  state={'sourceCommit':os.environ['GITHUB_SHA'],'backup':backup,'changed':[],'files':{p:{'source':FILES[p],'before':sha(old[p]),'after':sha(new[p])}for p in FILES},'protected':protected,'sqlWrites':False,'jukeboxWrites':False}
  with s.open(backup+'/manifest.json','wx')as f:f.write(json.dumps(state).encode())
  s.chmod(backup+'/manifest.json',0o600);STATE.write_text(json.dumps(state,indent=2))
  print('UIUX_PLAN '+json.dumps({'pending':pending,'backupVerified':True,'protectedFiles':len(protected)}),flush=True)
  staged={p:atomic(s,p,new[p],'stage')for p in pending}
  try:
   for p in pending:
    if read(s,ROOT+'/'+p)!=old[p]:raise RuntimeError('Concurrent production change '+p)
   # Dependencies and styles precede their view entry points.
   order=sorted(pending,key=lambda p:0 if p.endswith(('.js','.css'))or p.startswith('noa-bridge/') else 1)
   for p in order:
    if read(s,ROOT+'/'+p)!=old[p]:raise RuntimeError('Concurrent activation change '+p)
    s.posix_rename(staged[p],ROOT+'/'+p);state['changed'].append(p);STATE.write_text(json.dumps(state,indent=2))
    if read(s,ROOT+'/'+p)!=new[p]:raise RuntimeError('Installed checksum mismatch '+p)
    print('UIUX_UPDATED '+p,flush=True)
   for p,h in protected.items():
    if sha(read(s,ROOT+'/'+p))!=h:raise RuntimeError('Protected file changed '+p)
   for route in ['/','/noa-world.php?story=1','/noa-my.php','/noa-youtube.php','/noa-music.php','/bbs/login.php']:
    with urllib.request.urlopen(urllib.request.Request('https://noastudio.ai.kr'+route,headers={'Cache-Control':'no-cache'}),timeout=30)as r:
     b=r.read();assert r.status==200 and b'<html' in b and b'Fatal error' not in b
   with urllib.request.urlopen('https://noastudio.ai.kr/noa-bridge/home.php',timeout=30)as r:data=json.load(r)
   assert data['ok'];ids={v['videoId']for v in data['featured']}
   for k in ['ep','stories','covers']:assert len(data[k])<=10 and not ids.intersection(v['videoId']for v in data[k]),k
   for p in FILES:
    if not p.endswith(('.js','.css')):continue
    with urllib.request.urlopen('https://noastudio.ai.kr/'+p+'?v=20261021-uiux1',timeout=30)as r:assert r.read()==new[p]
   state['deployedAtUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());state['httpVerified']=True;STATE.write_text(json.dumps(state,indent=2));print('UIUX_DEPLOYED '+json.dumps(state),flush=True)
  except Exception:rollback(s,state);raise
 finally:t.close()
if __name__=='__main__':main()
