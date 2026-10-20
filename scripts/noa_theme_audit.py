"""Read-only GnuBoard theme structure audit; never reads credentials or user data."""
import os,base64,hashlib,json,re
import paramiko

def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 try:
  t.get_security_options().key_types=('ssh-ed25519',)
  t.start_client(timeout=20)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('Host key mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
  s=paramiko.SFTPClient.from_transport(t);root='/hosting/noastudio/html'
  if s.normalize(root)!=root:raise RuntimeError('Root mismatch')
  for folder in ['theme','skin/board','skin/member','skin/search','mobile/skin/board','mobile/skin/member','extend']:
   try:print('DIRECTORY',folder,json.dumps(s.listdir(root+'/'+folder),ensure_ascii=False))
   except FileNotFoundError:print('ABSENT',folder)
  for path in ['version.php','head.php','tail.php','head.sub.php','tail.sub.php','theme/basic/theme.config.php','theme/basic/head.php','theme/basic/tail.php','theme/basic/index.php']:
   try:
    with s.open(root+'/'+path,'rb') as f:raw=f.read(100000)
    print('CORE',path,'SHA256',hashlib.sha256(raw).hexdigest());print(raw.decode('utf-8',errors='replace'))
   except FileNotFoundError:print('ABSENT',path)
  with s.open(root+'/common.php','rb') as f:c=f.read().decode('utf-8',errors='replace').splitlines()
  keep=set()
  for i,line in enumerate(c):
   if any(k in line for k in ['cf_theme','G5_THEME','extend/','extend_path','include_once($extend','run_event','G5_MOBILE_PATH']):keep.update(range(max(0,i-2),min(len(c),i+4)))
  print('COMMON theme/hook excerpts only:')
  for i in sorted(keep):print(str(i+1)+': '+c[i])
 finally:t.close()
if __name__=='__main__':main()
