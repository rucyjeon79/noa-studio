"""Pinned SSH deployment; creates only missing NOA files, never overwrites data."""
import base64
import hashlib
import io
import os
from pathlib import Path
import stat
import paramiko

FILES = {
    'deploy/noa2.php': 'noa2.php',
    'deploy/noa-library.php': 'noa-library.php',
    'bridge/index.php': 'noa-bridge/index.php',
    'bridge/library.php': 'noa-bridge/library.php',
}
PROTECTED = ['index.php', 'common.php', 'config.php', '.htaccess', 'data/dbconfig.php']

def exists(sftp, path):
    try:
        sftp.lstat(path)
        return True
    except FileNotFoundError:
        return False

def digest(sftp, path):
    with sftp.open(path, 'rb') as handle:
        return hashlib.sha256(handle.read()).hexdigest()

def main():
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    transport.get_security_options().key_types = ('ssh-ed25519',)
    try:
        transport.start_client(timeout=20)
        key = transport.get_remote_server_key()
        fp = 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')
        if fp != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('SSH host key mismatch; no credentials sent')
        transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        if not transport.is_authenticated():
            raise RuntimeError('SSH authentication failed')
        sftp = paramiko.SFTPClient.from_transport(transport)
        root = os.environ['NOA_SSH_ROOT'].rstrip('/')
        if root != '/hosting/noastudio/html' or sftp.normalize(root) != root:
            raise RuntimeError('Unexpected production root')
        if not stat.S_ISREG(sftp.lstat(root + '/common.php').st_mode):
            raise RuntimeError('GnuBoard missing')
        print('Root entries:', ', '.join(sorted(sftp.listdir(root))))
        before = {p: digest(sftp, root+'/'+p) for p in PROTECTED if exists(sftp, root+'/'+p)}
        pending = []
        for local, relative in FILES.items():
            data = Path(local).read_bytes()
            expected = hashlib.sha256(data).hexdigest()
            target = root+'/'+relative
            if exists(sftp, target):
                if not stat.S_ISREG(sftp.lstat(target).st_mode) or digest(sftp, target) != expected:
                    raise RuntimeError('Refusing overwrite: '+relative)
                print('Already identical:', relative)
            else:
                if exists(sftp, target+'.upload.php'):
                    raise RuntimeError('Temporary target exists: '+relative)
                pending.append((target, relative, data, expected))
        if not exists(sftp, root+'/noa-bridge'):
            sftp.mkdir(root+'/noa-bridge', 0o755)
        elif not stat.S_ISDIR(sftp.lstat(root+'/noa-bridge').st_mode):
            raise RuntimeError('Invalid NOA bridge directory')
        for target, relative, data, expected in pending:
            temp = target+'.upload.php'
            with sftp.open(temp, 'wx') as output:
                output.write(data)
            sftp.chmod(temp, 0o644)
            if digest(sftp, temp) != expected:
                raise RuntimeError('Transfer verification failed: '+relative)
            sftp.rename(temp, target)
            if digest(sftp, target) != expected:
                raise RuntimeError('Remote verification failed: '+relative)
            print('CREATED', relative, 'bytes', len(data), 'sha256', expected)
        after = {p: digest(sftp, root+'/'+p) for p in before}
        if before != after:
            raise RuntimeError('Protected file changed during deployment')
        print('Protected GnuBoard files unchanged:', ', '.join(before))
        print('No SQL executed; no existing remote file overwritten or deleted')
        sftp.close()
    finally:
        transport.close()

if __name__ == '__main__':
    main()
