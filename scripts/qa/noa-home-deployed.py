"""Read only exact deployed home module paths; never reads configuration/secrets."""
import base64,hashlib,json,os,subprocess
from pathlib import Path
import paramiko
BASE='128165cdcfe663970bd21c4eb124b84078e19d88'
FILES={'bridge/home.php':'noa-bridge/home.php','bridge/home-core.php':'noa-bridge/home-core.php','deploy/noa-home.js':'noa-home.js','deploy/noa-app/home.php':'noa-app/home.php','deploy/noa2.php':'noa2.php'}
t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022));t.use_compression(True)
try:
 t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
 fp='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
 if fp!='SHA256:0LqxbpOziJ4XgOMNEkfVrVGle3kpjJessI+jKqZ4JCU':raise RuntimeError('host_key_mismatch')
 t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD']);s=paramiko.SFTPClient.from_transport(t);s.get_channel().settimeout(20);report={}
 for local,remote in FILES.items():
  with s.open('/hosting/noastudio/html/'+remote,'rb')as f:data=f.read(1048577)
  if len(data)>1048576:raise RuntimeError('source_size_limit')
  previous=subprocess.check_output(['git','show',BASE+':'+local]);digest=lambda b:hashlib.sha256(b).hexdigest()
  report[remote]={'deployedSha256':digest(data),'baselineMainSha256':digest(previous),'candidateSha256':digest(Path(local).read_bytes()),'matchesBaselineMain':data==previous,'matchesCandidate':data==Path(local).read_bytes()}
 Path('quality-home').mkdir(mode=0o700,exist_ok=True);Path('quality-home/deployed-source-hashes.json').write_text(json.dumps(report,indent=2));print('NOA_HOME_DEPLOYED_SOURCE '+json.dumps(report))
finally:t.close()
