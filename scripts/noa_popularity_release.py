"""Scoped popularity release; no player/design/core/queue mutations."""
import os,json,stat,hashlib,hmac,secrets,time,urllib.request,subprocess
from pathlib import Path
import paramiko
from noa_full_inventory import connect
from noa_taxonomy_release import service as taxonomy_service
from noa_deploy_guard import deployment_preflight
ROOT='/hosting/noastudio/html'
BASE='4c32463'
NEW={str(p):'noa-bridge/'+p.name for p in Path('bridge').glob('popularity*.php')}
NEW['bridge/rankings.php']='noa-bridge/rankings.php'
NEW.update({str(p):str(p.relative_to('deploy'))for p in Path('deploy/noa-app/popularity').glob('*')if p.is_file()})
def sha(data):return hashlib.sha256(data).hexdigest()
def service(key,action,**body):
 raw=json.dumps({'action':action,**body},separators=(',',':')).encode();ts=str(int(time.time()));nonce=secrets.token_hex(16);msg='NOA-POPULARITY-1\nPOST\n'+sha(raw)+'\n'+ts+'\n'+nonce
 req=urllib.request.Request('https://noastudio.ai.kr/noa-bridge/popularity-worker.php',data=raw,headers={'Content-Type':'application/json','X-NOA-Timestamp':ts,'X-NOA-Nonce':nonce,'X-NOA-Signature':hmac.new(key.encode(),msg.encode(),hashlib.sha256).hexdigest()})
 with urllib.request.urlopen(req,timeout=180)as r:out=json.load(r)
 if not out.get('ok'):raise RuntimeError('popularity:'+str(out.get('error','unknown')))
 return out

def main():
 phase=os.environ.get('NOA_POPULARITY_PHASE','prepare');Path('quality-popularity').mkdir(exist_ok=True);t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(45)
 try:
  with s.open('/hosting/noastudio/noa-ai-lab/worker.key','rb')as f:key=f.read(256).decode().strip()
  if len(key)!=64:raise RuntimeError('invalid_service_key')
  if phase=='hourly':
   out=service(key,'calculate');verified=service(key,'verify');Path('quality-popularity/hourly.json').write_text(json.dumps({'result':out,'verification':verified},indent=2));print('NOA_POPULARITY_HOURLY '+json.dumps(out));return
  def read(path):
   try:
    if not stat.S_ISREG(s.lstat(path).st_mode):raise RuntimeError('unsafe_file')
    with s.open(path,'rb')as f:return f.read()
   except FileNotFoundError:return None
  def mkdir(path):
   try:s.mkdir(path,0o755)
   except OSError:
    if not stat.S_ISDIR(s.lstat(path).st_mode)or s.normalize(path)!=path:raise RuntimeError('unsafe_directory')
  def deploy(targets,backup):
   for local,remote in targets.items():
    path=ROOT+'/'+remote;old=read(path);data=Path(local).read_bytes()
    if old==data:continue
    if old is not None:
     candidates=[BASE]if local=='bridge/home.php'else subprocess.check_output(['git','log','--format=%H','--',local],text=True).splitlines()
     approved=False
     for rev in candidates:
      try:known=subprocess.check_output(['git','show',rev+':'+local],stderr=subprocess.DEVNULL)
      except subprocess.CalledProcessError:continue
      if known==old:approved=True;break
     if not approved:raise RuntimeError('concurrent_or_unknown_file:'+remote)
     with s.open(backup+'/'+remote.replace('/','__'),'wx')as f:f.write(old)
     s.chmod(backup+'/'+remote.replace('/','__'),0o600)
    temp=path+'.popularity-stage-'+secrets.token_hex(8)
    with s.open(temp,'wx')as f:f.write(data)
    s.chmod(temp,0o644)
    if read(temp)!=data or read(path)!=old:raise RuntimeError('staging_or_concurrent_change')
    s.posix_rename(temp,path)
  if phase not in ['prepare','activate']:raise RuntimeError('invalid_phase')
  with deployment_preflight(s,'/hosting/noastudio/noa-deploy-backups','popularity-'+os.environ['GITHUB_RUN_ID']+'-'+phase,1048576,None)as backup:
   if phase=='prepare':
    mkdir(ROOT+'/noa-app/popularity');deploy(NEW,backup);state=service(key,'inspect');unknown=[n for n in state['existingRelevantTables']if ('ranking' in n or 'popularity' in n)and n not in ['noa_popularity_settings','noa_ranking_rows','noa_ranking_runs','noa_ranking_errors']]
    if unknown:raise RuntimeError('existing_ranking_system_requires_reuse:'+','.join(unknown))
    meta=taxonomy_service(key,'backup');Path('quality-popularity/backup-meta.json').write_text(json.dumps(meta));Path('quality-popularity/resume-state.json').write_text(json.dumps(state));print('NOA_POPULARITY_PREPARED '+json.dumps({'state':state,'backupSha256':meta['backup']['sha256'],'backupBytes':meta['backup']['bytes'],'tables':len(meta['backup']['tables'])}))
   else:
    proof=json.loads(Path('quality-popularity/isolated.json').read_text());meta=json.loads(Path('quality-popularity/backup-meta.json').read_text())
    if not proof['allPreexistingDataPreserved']or not proof['taxonomyAndConfirmedMatchesPreserved']or not proof['hourlyIdempotent']:raise RuntimeError('isolated_proof_required')
    deployed=service(key,'bootstrap',verifiedBackupSha256=meta['backup']['sha256'],isolatedRestoreVerified=True);result=service(key,'calculate');deploy({'bridge/home.php':'noa-bridge/home.php'},backup);verified=service(key,'verify');report={'commit':os.environ['GITHUB_SHA'],'migration':deployed,'firstSnapshot':result,'verification':verified,'playerFilesChanged':False,'designFilesChanged':False};Path('quality-popularity/production.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('NOA_POPULARITY_PRODUCTION '+json.dumps(report,ensure_ascii=False))
 finally:s.close();t.close()
if __name__=='__main__':main()
