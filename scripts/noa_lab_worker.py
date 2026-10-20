"""Launch the Node worker with its application key held only in process memory."""
import os,base64,hashlib,subprocess
from pathlib import Path
import paramiko

def main():
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint!=os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('SSH host key mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        sftp=paramiko.SFTPClient.from_transport(transport)
        with sftp.open('/hosting/noastudio/noa-ai-lab/worker.key','rb') as handle:
            key=handle.read(256).decode().strip()
        if len(key)!=64 or any(c not in '0123456789abcdef' for c in key):
            raise RuntimeError('Application worker key invalid')
    finally:
        transport.close()
    worker_env={k:v for k,v in os.environ.items() if not k.startswith('NOA_SSH_')}
    worker_env['NOA_LAB_WORKER_KEY']=key
    result=subprocess.run(['node',str(Path(__file__).resolve().parent.parent/'lab/worker.mjs')],env=worker_env,check=False)
    raise SystemExit(result.returncode)

if __name__=='__main__':
    main()
