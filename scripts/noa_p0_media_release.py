"""Small guarded release for P0 media recovery. No SQL, worker or upload writes."""
import os,json,subprocess,stat
from pathlib import Path
from noa_uiux_release import connect,read,sha,atomic,mkdir,ROOT,PROTECTED
from noa_deploy_guard import deployment_preflight,verified_backup
BASE='e6435bf9b45c7dece6f114a6c39c483c2de76145'
FILES=['noa-app/p0-media.css','noa-app/p0-player.js','noa-youtube.js','noa-youtube.php','noa-music.php']
NEW=set(FILES[:2]);out=Path('p0-proof');out.mkdir(exist_ok=True)
def maybe(s,p):
 try:return read(s,p)
 except FileNotFoundError:return None

def main():
 t,s=connect();changed=[];state={'source':os.environ['GITHUB_SHA'],'sqlWrites':0,'files':{}}
 try:
  before={p:maybe(s,ROOT+'/'+p) for p in FILES};after={p:Path('deploy/'+p).read_bytes() for p in FILES}
  for p,b in before.items():
   if p in NEW:
    if b is not None and b!=after[p]:raise RuntimeError('Unknown new asset: '+p)
   else:
    baseline=subprocess.check_output(['git','show',BASE+':deploy/'+p])
    if b not in [baseline,after[p]]:raise RuntimeError('Concurrent production change preserved: '+p)
  protected={p:sha(read(s,ROOT+'/'+p)) for p in PROTECTED}
  pending=[p for p in FILES if before[p]!=after[p]]
  with deployment_preflight(s,'/hosting/noastudio/noa-deploy-backups',os.environ['GITHUB_RUN_ID']+'-media-'+os.environ.get('GITHUB_RUN_ATTEMPT','1'),sum(len(after[p])+len(before[p] or b'') for p in pending),None) as backup:
   state['backup']=backup
   for p in pending:
    folder=backup
    for part in p.split('/')[:-1]:folder+='/'+part;mkdir(s,folder)
    if before[p] is not None:verified_backup(s,backup+'/'+p,before[p])
    state['files'][p]={'before':sha(before[p]) if before[p] is not None else None,'after':sha(after[p])}
   verified_backup(s,backup+'/manifest.json',json.dumps(state).encode())
   staged={p:atomic(s,p,after[p],'p0-media') for p in pending}
   try:
    for p in pending:
     if maybe(s,ROOT+'/'+p)!=before[p]:raise RuntimeError('Concurrent change: '+p)
    for p in pending:
     s.posix_rename(staged[p],ROOT+'/'+p);changed.append(p)
     if read(s,ROOT+'/'+p)!=after[p]:raise RuntimeError('Readback mismatch: '+p)
    for p,h in protected.items():
     if sha(read(s,ROOT+'/'+p))!=h:raise RuntimeError('Protected file changed: '+p)
   except Exception:
    for p in reversed(changed):
     if maybe(s,ROOT+'/'+p)!=after[p]:raise RuntimeError('Rollback blocked by concurrent edit: '+p)
     if before[p] is None:s.remove(ROOT+'/'+p)
     else:s.posix_rename(atomic(s,p,before[p],'p0-rollback'),ROOT+'/'+p)
    raise
   state['changed']=changed;state['protectedFiles']=len(protected);state['ok']=True
  (out/'release.json').write_text(json.dumps(state,indent=2));print('P0_MEDIA_RELEASE '+json.dumps(state))
 finally:s.close();t.close()
if __name__=='__main__':main()
