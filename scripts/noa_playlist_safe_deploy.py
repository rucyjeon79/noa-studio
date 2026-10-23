"""Deploy only the reviewed playlist JavaScript with optimistic SHA-256 locking."""
import base64, hashlib, os, subprocess, stat, urllib.request
from pathlib import Path
import paramiko

ROOT = '/hosting/noastudio/html'
REMOTE = ROOT + '/noa-playlists.js'
SOURCE = Path('deploy/noa-playlists.js')

def digest(data): return hashlib.sha256(data).hexdigest()

def main():
    data = SOURCE.read_bytes()
    prior = subprocess.check_output(['git','show','HEAD^:deploy/noa-playlists.js'])
    expected = {digest(prior), digest(data), '86b9ec2171f857d442fb9ccc3ae9935d2ba2ce8cf17397640b6a7de6a768bd29'}
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        key = transport.get_remote_server_key()
        fp = 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
        if fp != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'],os.environ['NOA_SSH_PASSWORD'])
        if not transport.is_authenticated(): raise RuntimeError('authentication_failed')
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            if sftp.normalize(ROOT) != ROOT: raise RuntimeError('root_mismatch')
            st = sftp.lstat(REMOTE)
            if not stat.S_ISREG(st.st_mode): raise RuntimeError('not_regular')
            with sftp.open(REMOTE,'rb') as stream: before = digest(stream.read())
            if before not in expected: raise RuntimeError('remote_changed_unexpectedly')
            if before != digest(data):
                temp = ROOT + '/.noa-playlists.js.' + os.environ['GITHUB_SHA'][:12] + '.tmp'
                with sftp.open(temp,'x') as stream: stream.write(data)
                with sftp.open(temp,'rb') as stream:
                    if digest(stream.read()) != digest(data): raise RuntimeError('upload_hash_mismatch')
                with sftp.open(REMOTE,'rb') as stream:
                    if digest(stream.read()) != before: raise RuntimeError('remote_race')
                sftp.posix_rename(temp,REMOTE)
            with sftp.open(REMOTE,'rb') as stream:
                if digest(stream.read()) != digest(data): raise RuntimeError('activation_hash_mismatch')
            print('Deployed verified file: noa-playlists.js sha256='+digest(data))
        finally: sftp.close()
    finally: transport.close()
    request = urllib.request.Request('https://noastudio.ai.kr/noa-playlists.js',headers={'Cache-Control':'no-cache'})
    with urllib.request.urlopen(request,timeout=25) as response:
        if digest(response.read()) != digest(data): raise RuntimeError('public_asset_mismatch')
    print('Public asset verified')

if __name__=='__main__': main()
