"""Safely install the additive NOA ENGINE registry without changing existing modules."""
import base64,hashlib,os,stat,urllib.request
from pathlib import Path
import paramiko
ROOT='/hosting/noastudio/html'
REL='noa-app/engine/workflow.php'
SOURCE=Path('deploy')/REL
def sha(b):return hashlib.sha256(b).hexdigest()
def main():
    required=('NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT','GITHUB_SHA')
    if any(not os.getenv(k) for k in required):raise RuntimeError('missing_deploy_config')
    data=SOURCE.read_bytes();expected=sha(data)
    t=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint!=os.environ['NOA_SSH_HOST_FINGERPRINT']:raise RuntimeError('host_key_mismatch')
        t.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        if not t.is_authenticated():raise RuntimeError('authentication_failed')
        s=paramiko.SFTPClient.from_transport(t)
        try:
            if s.normalize(ROOT)!=ROOT:raise RuntimeError('unexpected_root')
            parent=ROOT+'/noa-app/engine'
            for directory in (ROOT+'/noa-app',parent):
                try:st=s.lstat(directory)
                except FileNotFoundError:s.mkdir(directory,0o755)
                else:
                    if not stat.S_ISDIR(st.st_mode):raise RuntimeError('invalid_directory')
            target=ROOT+'/'+REL
            try:
                st=s.lstat(target)
                if not stat.S_ISREG(st.st_mode):raise RuntimeError('nonregular_target')
                with s.open(target,'rb') as f:old=f.read()
            except FileNotFoundError:old=None
            if old is not None and old!=data:raise RuntimeError('unknown_existing_registry_refuse_overwrite')
            if old is None:
                temp=target+'.'+os.environ['GITHUB_SHA'][:12]+'.tmp'
                try:s.lstat(temp)
                except FileNotFoundError:pass
                else:raise RuntimeError('temporary_file_exists')
                with s.open(temp,'wx') as f:f.write(data)
                with s.open(temp,'rb') as f:
                    if sha(f.read())!=expected:raise RuntimeError('staging_hash_mismatch')
                try:s.lstat(target)
                except FileNotFoundError:pass
                else:raise RuntimeError('concurrent_target_creation')
                s.rename(temp,target)
            with s.open(target,'rb') as f:
                if sha(f.read())!=expected:raise RuntimeError('remote_hash_mismatch')
            print('NOA_ENGINE_WORKFLOW_REMOTE_VERIFIED',expected)
        finally:s.close()
    finally:t.close()
    # No public endpoint: registry is a PHP library, not an executable health API.
    print('NOA_ENGINE_WORKFLOW_DEPLOYED_READ_ONLY')
if __name__=='__main__':main()
