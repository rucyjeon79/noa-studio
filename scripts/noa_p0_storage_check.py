"""Observe account usage and reversible allocation; never removes existing files."""
import os,json,stat,time
from pathlib import Path
import paramiko
from noa_full_inventory import connect
from noa_deploy_guard import deployment_preflight,DeployBlocked
def main():
 t=connect();s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30);result={'sqlWrites':False,'mediaDeleted':False,'workersStopped':False}
 try:
  top='/hosting/noastudio';usage={};dirs=0
  for e in s.listdir_attr(top):
   if stat.S_ISLNK(e.st_mode):continue
   total=0;files=0;stack=[top+'/'+e.filename]if stat.S_ISDIR(e.st_mode)else[]
   if not stack:total=e.st_size;files=1
   while stack:
    p=stack.pop();dirs+=1
    if dirs>4000:raise RuntimeError('bounded_account_scan_limit')
    for x in s.listdir_attr(p):
     if stat.S_ISREG(x.st_mode):total+=x.st_size;files+=1
     elif stat.S_ISDIR(x.st_mode):stack.append(p+'/'+x.filename)
   usage[e.filename]={'bytes':total,'files':files}
  result['accountUsage']=usage;result['totalFileBytes']=sum(v['bytes']for v in usage.values());result['totalFiles']=sum(v['files']for v in usage.values());result['directories']=dirs
  p=top+'/noa-deploy-backups/.p0-allocation-'+os.environ['GITHUB_RUN_ID'];created=False
  try:
   with s.open(p,'wx')as f:
    created=True;result['createFile']=True;f.write(b'NOA-P0\n'*9363);f.flush()
   with s.open(p,'rb')as f:result['writeReadBytes']=len(f.read())
  except OSError as e:result['allocationFailure']={'type':type(e).__name__,'errno':e.errno,'message':str(e)}
  finally:
   if created:s.remove(p)
  try:
   with deployment_preflight(s,top+'/noa-deploy-backups',os.environ['GITHUB_RUN_ID'],65536,None)as backup:
    result['backupWritable']=True;result['probeBackup']=backup;s.rmdir(backup)
  except DeployBlocked as e:result['backupWritable']=False;result['guardCode']=e.code
  result['checkedAtUTC']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
  Path('full-release-proof').mkdir(exist_ok=True);Path('full-release-proof/storage.json').write_text(json.dumps(result,indent=2));print('P0_STORAGE '+json.dumps(result),flush=True)
 finally:s.close();t.close()
if __name__=='__main__':main()
