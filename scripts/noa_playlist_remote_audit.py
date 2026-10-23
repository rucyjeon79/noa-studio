"""Read-only remote playlist version audit; never download or print private file contents."""
import os, hashlib, base64, subprocess, stat
from pathlib import Path
import paramiko
REMOTE='/hosting/noastudio/html/noa-playlists.js'
def digest(data): return hashlib.sha256(data).hexdigest()
def main():
    required=['NOA_SSH_HOST','NOA_SSH_USER','NOA_SSH_PASSWORD','NOA_SSH_HOST_FINGERPRINT']
    if any(not os.getenv(k) for k in required): raise RuntimeError('missing_noa_ssh_secret')
    transport=paramiko.Transport((os.environ['NOA_SSH_HOST'],2022))
    try:
        transport.get_security_options().key_types=('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint='SHA256:'+base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint!=os.environ['NOA_SSH_HOST_FINGERPRINT']: raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        if not transport.is_authenticated(): raise RuntimeError('authentication_failed')
        sftp=paramiko.SFTPClient.from_transport(transport)
        try:
            if sftp.normalize('/hosting/noastudio/html')!='/hosting/noastudio/html': raise RuntimeError('root_mismatch')
            if not stat.S_ISREG(sftp.lstat(REMOTE).st_mode): raise RuntimeError('nonregular_file')
            with sftp.open(REMOTE,'rb') as f: remote_hash=digest(f.read())
        finally: sftp.close()
    finally: transport.close()
    print('REMOTE_SHA256',remote_hash)
    current=digest(Path('deploy/noa-playlists.js').read_bytes())
    print('CURRENT_SHA256',current)
    commits=subprocess.check_output(['git','log','--format=%H','--','deploy/noa-playlists.js'],text=True).splitlines()
    matches=[]
    for commit in commits:
        data=subprocess.check_output(['git','show',commit+':deploy/noa-playlists.js'])
        if digest(data)==remote_hash: matches.append(commit)
    print('KNOWN_HISTORY_MATCHES',','.join(matches) if matches else 'none')
    print('STATUS','already_deployed' if remote_hash==current else 'known_previous' if matches else 'unknown_remote_version')
if __name__=='__main__':main()
