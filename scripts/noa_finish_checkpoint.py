import base64,hashlib,io,json,os,stat,tarfile
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
FILES=['noa-music.php','noa-app/p0-player.js','noa-app/home.php','noa-playlists.js','noa-bridge/user-playlists.php','noa-sitemap.php']
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));s=None
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=30)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t)
  if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
  out=Path('finish-checkpoint');out.mkdir(exist_ok=True);manifest={'files':{},'protected':{}}
  with tarfile.open(out/'preimages.tar.gz','w:gz') as tar:
   for p in FILES+['common.php','config.php','data/dbconfig.php','index.php','noa-bridge/youtube-store.php','noa-youtube.php','noa-browse.js','noa-app/p0-media.css','noa-app/jukebox/upload-core.php','noa-app/jukebox/upload.js']:
    try:info=s.lstat(ROOT+'/'+p)
    except FileNotFoundError:manifest['files'][p]=None;continue
    if not stat.S_ISREG(info.st_mode):raise RuntimeError('nonregular:'+p)
    with s.open(ROOT+'/'+p,'rb') as f:b=f.read()
    manifest['files' if p in FILES else 'protected'][p]={'bytes':len(b),'sha256':sha(b)}
    if p in FILES:
     m=tarfile.TarInfo(p);m.size=len(b);m.mode=stat.S_IMODE(info.st_mode);tar.addfile(m,io.BytesIO(b))
  manifest['archiveSha256']=sha((out/'preimages.tar.gz').read_bytes())
  (out/'manifest.json').write_text(json.dumps(manifest,indent=2));print(json.dumps(manifest))
 finally:
  if s:s.close()
  t.close()
if __name__=='__main__':main()
