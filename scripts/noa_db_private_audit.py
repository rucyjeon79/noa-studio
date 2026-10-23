"""Read-only metadata inventory of the 12 files under NOA private DB directory."""
import os,stat,base64,hashlib,json,datetime
import paramiko
ROOT='/hosting/noastudio/noa-db-private'
def main():
 required=('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT')
 if any(not os.getenv(k) for k in required):raise RuntimeError('missing_noa_ssh_secret')
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
   entries=[];stack=[ROOT]
   while stack:
    folder=stack.pop()
    for attr in s.listdir_attr(folder):
     path=folder+'/'+attr.filename
     if stat.S_ISLNK(attr.st_mode):continue
     if stat.S_ISDIR(attr.st_mode):stack.append(path);continue
     if not stat.S_ISREG(attr.st_mode):continue
     rel=path[len(ROOT)+1:]
     entries.append({'path':rel,'bytes':attr.st_size,'modified_utc':datetime.datetime.fromtimestamp(attr.st_mtime,datetime.timezone.utc).isoformat(),'extension':os.path.splitext(rel)[1].lower()})
   entries.sort(key=lambda x:-x['bytes'])
   report={'root':ROOT,'count':len(entries),'total_bytes':sum(x['bytes'] for x in entries),'files':entries}
   print('NOA_DB_PRIVATE_INVENTORY '+json.dumps(report,ensure_ascii=False),flush=True)
  finally:s.close()
 finally:t.close()
if __name__=='__main__':main()
