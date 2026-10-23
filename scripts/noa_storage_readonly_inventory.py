"""Read-only production storage inventory. No files are modified or downloaded."""
import os,stat,base64,hashlib,json
from collections import defaultdict
import paramiko
ROOT='/hosting/noastudio'
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
   stack=[ROOT];seen=0;totals=defaultdict(lambda:[0,0]);subfolders=defaultdict(lambda:[0,0]);suspects=defaultdict(lambda:[0,0]);errors=[];candidates=[]
   while stack:
    folder=stack.pop()
    try:entries=s.listdir_attr(folder)
    except OSError:errors.append(folder);continue
    for entry in entries:
     path=folder+'/'+entry.filename;mode=entry.st_mode
     if stat.S_ISLNK(mode):continue
     if stat.S_ISDIR(mode):
      if len(stack)<100000:stack.append(path)
     elif stat.S_ISREG(mode):
      seen+=1;rel=path[len(ROOT)+1:];top=rel.split('/')[0];totals[top][0]+=entry.st_size;totals[top][1]+=1;group='/'.join(rel.split('/')[:3]);subfolders[group][0]+=entry.st_size;subfolders[group][1]+=1
      name=entry.filename.lower()
      category=('deploy_backup' if 'noa-deploy-backups/' in rel else
                'staged' if '.stage-' in name or '.upload.' in name or name.endswith('.tmp') else
                'synthetic_candidate' if any(x in name for x in ('synthetic','test-tone','sine-wave','qa-tone')) else None)
      if category:
       suspects[category][0]+=entry.st_size;suspects[category][1]+=1
       candidates.append({'path':rel,'bytes':entry.st_size,'mtime':entry.st_mtime,'category':category})
   report={'files':seen,'candidate_files':sorted(candidates,key=lambda x:-x['bytes']),'subfolders_by_bytes':sorted(({'folder':k,'bytes':v[0],'files':v[1]} for k,v in subfolders.items()),key=lambda v:-v['bytes']),'folders_by_bytes':sorted(({'folder':k,'bytes':v[0],'files':v[1]} for k,v in totals.items()),key=lambda v:-v['bytes']),'candidates':dict(suspects),'unreadable_folders':len(errors)}
   from pathlib import Path
   Path('storage-audit').mkdir(exist_ok=True)
   Path('storage-audit/inventory.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
   print('NOA_STORAGE_READ_ONLY '+json.dumps({'files':seen,'candidates':len(candidates),'candidate_bytes':sum(x['bytes'] for x in candidates),'unreadable_folders':len(errors)},ensure_ascii=False),flush=True)
  finally:s.close()
 finally:t.close()
if __name__=='__main__':main()
