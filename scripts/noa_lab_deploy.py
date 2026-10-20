"""Additive AI LAB release: pinned host, exact version checks, no database writes."""
import os,base64,hashlib,stat
from pathlib import Path
import paramiko
import noa_sftp_deploy as deploy

FILES={
 'deploy/noa-ai-lab.php':'noa-ai-lab.php','deploy/noa-ai-lab.js':'noa-ai-lab.js','deploy/noa-ai-lab.css':'noa-ai-lab.css',
 'deploy/noa-editor.php':'noa-editor.php','deploy/noa-library.php':'noa-library.php','deploy/noa-ui.js':'noa-ui.js','bridge/catalog.php':'noa-bridge/catalog.php',
 **{'bridge/'+name:'noa-bridge/'+name for name in ['lab-core.php','lab-api.php','lab-creator.php','lab-worker.php','lab-oauth.php','lab-file.php']}}
# Exact files verified in the preceding production recovery. No unknown server version is overwritten.
BASELINES={
 'noa-editor.php':'dfee60d9adfd94d0d61d572d579878a8e18564916ab5b9726ecb6355cf11b47f',
 'noa-library.php':'01ddf00d42a02faf6950e6c5c58ca593768be6796cdea2104929352f975b0e27',
 'noa-ui.js':'063e4d93821e7296b8f6b349f54718404e200393c70f2b47d412a7db405f80b2',
 'noa-bridge/catalog.php':'61c0c6fa5bf2754568cb59548a871fe16bcbc2853d14b49d1b89ea90f52e47b1',
}
def private_storage():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.get_security_options().key_types=('ssh-ed25519',)
 try:
  t.start_client(timeout=20)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('SSH host key mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t)
  root='/hosting/noastudio/noa-ai-lab'
  if s.normalize('/hosting/noastudio')!='/hosting/noastudio':raise RuntimeError('Unexpected private parent')
  for path in [root,root+'/jobs']:
   if not deploy.exists(s,path):s.mkdir(path,0o700)
   elif not stat.S_ISDIR(s.lstat(path).st_mode):raise RuntimeError('Invalid private directory')
   s.chmod(path,0o700)
  for name,length,data in [('master.key',32,os.urandom(32)),('worker.key',64,os.urandom(32).hex().encode())]:
   path=root+'/'+name
   if deploy.exists(s,path):
    if not stat.S_ISREG(s.lstat(path).st_mode) or s.stat(path).st_size!=length:raise RuntimeError('Existing private key invalid; preserved')
   else:
    with s.open(path,'wx') as f:f.write(data)
   s.chmod(path,0o600)
  s.close();print('Private storage ready; existing keys and job data preserved.')
 finally:t.close()
def main():
 private_storage();deploy.FILES=FILES;deploy.UPGRADE_FROM.update(BASELINES);deploy.main()
if __name__=='__main__':main()
