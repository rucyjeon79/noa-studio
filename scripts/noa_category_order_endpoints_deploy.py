"""Safely install two new category order endpoints without overwriting unknown files."""
import os,base64,hashlib,paramiko,stat
from pathlib import Path
ROOT='/hosting/noastudio/html'
FILES=['noa-category-order.php','noa-category-order-admin.php']
def digest(b):return hashlib.sha256(b).hexdigest()
def main():
 required=['NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT']
 if any(not os.getenv(k) for k in required):raise RuntimeError('missing_noa_secret')
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
  if not t.is_authenticated():raise RuntimeError('authentication_failed')
  s=paramiko.SFTPClient.from_transport(t)
  try:
   if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
   for name in FILES:
    remote=ROOT+'/'+name;data=Path('deploy',name).read_bytes()
    try:
     info=s.lstat(remote)
    except FileNotFoundError:info=None
    if info:
     if not stat.S_ISREG(info.st_mode):raise RuntimeError('unexpected_target_type')
     with s.open(remote,'rb') as f:old=f.read()
     if digest(old)==digest(data):continue
     raise RuntimeError('existing_file_conflict:'+name)
    tmp=ROOT+'/.'+name+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
    try:s.lstat(tmp)
    except FileNotFoundError:pass
    else:raise RuntimeError('temporary_file_exists')
    with s.open(tmp,'wb') as f:f.write(data)
    with s.open(tmp,'rb') as f:
     if digest(f.read())!=digest(data):raise RuntimeError('upload_hash_mismatch')
    s.posix_rename(tmp,remote)
    with s.open(remote,'rb') as f:
     if digest(f.read())!=digest(data):raise RuntimeError('installed_hash_mismatch')
    print('NEW_ENDPOINT_VERIFIED',name,digest(data))
  finally:s.close()
 finally:t.close()
if __name__=='__main__':main()
