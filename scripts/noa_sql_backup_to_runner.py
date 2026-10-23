"""Transfer enumerated SQL backups from NOA SFTP to temporary runner disk; no deletion."""
import os,hashlib,base64,stat,json
from pathlib import Path
import paramiko
REMOTE='/hosting/noastudio/noa-db-private'
FILES=['15133165eb1e1d6529158ed051d94e9a.sql','fda4138b6ba4d525f337e4a86038218f.sql','d54c43955754a84d1fca3778345f37a0.sql','ce1beb1a0ad64e9dc4b50654625c6618.sql','362dfee5ef4c3df496fdbc83cb482a5a.sql']
def main():
 required=['NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT']
 if any(not os.getenv(k) for k in required):raise RuntimeError('missing_noa_ssh_secret')
 dest=Path(os.environ['RUNNER_TEMP'])/'noa-db-backups';dest.mkdir(mode=0o700,exist_ok=True)
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=30)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
  if not t.is_authenticated():raise RuntimeError('authentication_failed')
  s=paramiko.SFTPClient.from_transport(t)
  try:
   if s.normalize(REMOTE)!=REMOTE:raise RuntimeError('remote_directory_mismatch')
   manifest=[]
   for name in FILES:
    remote=REMOTE+'/'+name;attr=s.lstat(remote)
    if not stat.S_ISREG(attr.st_mode):raise RuntimeError('not_regular:'+name)
    h=hashlib.sha256();total=0
    with s.open(remote,'rb') as src,open(dest/name,'xb') as out:
     while True:
      chunk=src.read(1024*1024)
      if not chunk:break
      out.write(chunk);h.update(chunk);total+=len(chunk)
    if total!=attr.st_size:raise RuntimeError('size_mismatch:'+name)
    after=s.lstat(remote)
    if (after.st_size,after.st_mtime)!=(attr.st_size,attr.st_mtime):raise RuntimeError('source_changed:'+name)
    meta_name=name[:-4]+'.json'
    with s.open(REMOTE+'/'+meta_name,'rb') as f:meta_raw=f.read(1048577)
    if len(meta_raw)>1048576:raise RuntimeError('metadata_too_large')
    meta=json.loads(meta_raw)
    if meta.get('id')!=name[:-4] or meta.get('bytes')!=total or meta.get('sha256')!=h.hexdigest():raise RuntimeError('metadata_mismatch:'+name)
    if not isinstance(meta.get('tables'),dict) or not meta['tables']:raise RuntimeError('missing_table_manifest:'+name)
    (dest/meta_name).write_bytes(meta_raw)
    manifest.append({'file':name,'bytes':total,'sha256':h.hexdigest(),'source_mtime':attr.st_mtime,'metadata_file':meta_name,'metadata_sha256':hashlib.sha256(meta_raw).hexdigest()})
   (dest/'manifest.json').write_text(json.dumps(manifest,indent=2))
   print('SFTP_TRANSFER_VERIFIED',len(manifest),'files',sum(x['bytes'] for x in manifest),'bytes')
  finally:s.close()
 finally:t.close()
if __name__=='__main__':main()

