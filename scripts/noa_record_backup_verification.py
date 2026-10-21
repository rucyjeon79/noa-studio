"""Record only the successful isolated restore result; no production SQL execution."""
import base64,datetime,hashlib,json,os,re
import paramiko
EXPECTED='6dac39d8fe1b14a53a6ba198d9374edb0d8b6c6b8b785dfc3a64699fecc31a3c'
ROOT='/hosting/noastudio/noa-db-private'
def main():
 run=os.environ['NOA_VERIFIED_RUN'];assert run=='39530927135'
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  assert fp=='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU'
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t)
  for name in s.listdir(ROOT):
   if not re.fullmatch(r'[a-f0-9]{32}\.json',name):continue
   path=ROOT+'/'+name
   with s.open(path,'rb') as f:old=f.read(65536)
   m=json.loads(old)
   if m.get('sha256')!=EXPECTED:continue
   assert s.stat(ROOT+'/'+m['id']+'.sql').st_size==m['bytes']
   m['restoreVerified']=True;m['restoreVerification']={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'engine':'MySQL 8.0','proofRun':'https://github.com/rucyjeon79/noa-studio/actions/runs/'+run,'allSchemasEqual':True,'allRowContentChecksumsEqual':True,'productionRestored':False}
   temp=path+'.verification-'+os.environ['GITHUB_RUN_ID']+'.tmp'
   with s.open(temp,'wx') as f:f.write(json.dumps(m,ensure_ascii=False).encode())
   s.chmod(temp,0o600)
   with s.open(path,'rb') as f:assert f.read(65536)==old,'manifest_changed'
   s.posix_rename(temp,path)
   with s.open(path,'rb') as f:assert json.loads(f.read(65536))==m
   print('BACKUP_RESTORE_VERIFICATION_RECORDED '+json.dumps({'sha256':EXPECTED,'bytes':m['bytes'],'tables':len(m['tables']),'restoreVerified':True,'productionSQLExecuted':False}));return
  raise RuntimeError('matching_private_backup_missing')
 finally:t.close()
if __name__=='__main__':main()
