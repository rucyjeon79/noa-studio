"""Read-only source checkpoint. Private keys/config contents never enter archive."""
import base64, hashlib, io, json, os, stat, tarfile
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
FILES=['noa-app/engine/music-availability.php','noa-app/engine/consume-music.php']
PROTECTED=['common.php','config.php','data/dbconfig.php','index.php','noa-app/jukebox/upload.js','noa-app/jukebox/upload-core.php','noa-app/jukebox/queue-core.php','noa-app/jukebox/core.php','noa-browse.js','noa-app/p0-player.js']
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));s=None
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=30)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(30)
  if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
  out=Path('category-checkpoint');out.mkdir(exist_ok=True);manifest={'files':{},'protected':{},'sourceCommit':os.environ['GITHUB_SHA']}
  with tarfile.open(out/'preimages.tar.gz','w:gz') as tar:
   for p in FILES+PROTECTED:
    parent=(ROOT+'/'+p).rsplit('/',1)[0]
    if s.normalize(parent)!=parent:raise RuntimeError('unsafe_parent:'+p)
    try:info=s.lstat(ROOT+'/'+p)
    except FileNotFoundError:
     if p in PROTECTED:raise RuntimeError('protected_missing:'+p)
     manifest['files'][p]=None;continue
    if not stat.S_ISREG(info.st_mode) or info.st_size>4*1024*1024:raise RuntimeError('unsafe_source:'+p)
    with s.open(ROOT+'/'+p,'rb') as f:b=f.read(4*1024*1024+1)
    if len(b)!=info.st_size:raise RuntimeError('source_changed_during_read:'+p)
    manifest['files' if p in FILES else 'protected'][p]={'bytes':len(b),'sha256':sha(b)}
    if p in FILES:
     m=tarfile.TarInfo(p);m.size=len(b);m.mode=stat.S_IMODE(info.st_mode);tar.addfile(m,io.BytesIO(b))
  for p,rec in {**manifest['files'],**manifest['protected']}.items():
   if rec is None:continue
   with s.open(ROOT+'/'+p,'rb') as f:
    if sha(f.read())!=rec['sha256']:raise RuntimeError('concurrent_source_changed:'+p)
  manifest['archiveSha256']=sha((out/'preimages.tar.gz').read_bytes())
  (out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest))
 finally:
  if s:s.close()
  t.close()
if __name__=='__main__':main()
