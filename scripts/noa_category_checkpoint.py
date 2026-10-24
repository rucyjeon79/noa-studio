import base64,hashlib,io,json,os,stat,tarfile
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
FILES=['noa-category-order.php','noa-category-order-admin.php','noa-ui.css','noa-browse.js','noa-library.php','noa-music.php','noa-youtube.php','extend/noa.design.php']
PROTECTED=['common.php','config.php','data/dbconfig.php','index.php','noa-bridge/youtube-store.php','noa-app/home.php','noa-app/p0-player.js','noa-app/p0-media.css']
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
 t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));s=None
 try:
  t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=30)
  fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
  if fp!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
  t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t)
  if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
  out=Path('category-checkpoint');out.mkdir(exist_ok=True)
  with s.open('/hosting/noastudio/noa-ai-lab/category-order.json','rb') as f:raw=f.read()
  order=json.loads(raw)
  expected='b22e29d53094e6052b027996301f013e2ff77755703adfa97730cc1b0bc5b9e6'
  if sha(raw)!=expected:raise RuntimeError('order_changed_since_native_admin_validation')
  (out/'category-order.json').write_bytes(raw)
  report={'ok':True,'sha256':sha(raw),'bytes':len(raw),'counts':{g:len(order[g])for g in ['story','cover']},'runtimeWrites':0,'databaseWrites':0}
  (out/'host-order-proof.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

 finally:
  if s:s.close()
  t.close()
if __name__=='__main__':main()
