"""Deploy the queue hook, then provision its private dispatcher credential if supplied."""
import os
import re
import secrets
import stat
import paramiko
import noa_ainoa_deploy as release

PRIVATE = '/hosting/noastudio/noa-jukebox-private'
release.FILES = {
    'noa-app/jukebox/wake-core.php': 'deploy/noa-app/jukebox/wake-core.php',
    'noa-app/jukebox/queue-core.php': 'deploy/noa-app/jukebox/queue-core.php',
}
release.NEW = {'noa-app/jukebox/wake-core.php'}

def configure(sftp, token):
    if sftp.normalize(PRIVATE) != PRIVATE or not stat.S_ISDIR(sftp.lstat(PRIVATE).st_mode):
        raise RuntimeError('unexpected_private_directory')
    target = PRIVATE + '/upload-wake-token'
    try:
        info = sftp.lstat(target)
    except FileNotFoundError:
        info = None
    if info and (not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077):
        raise RuntimeError('unsafe_existing_wake_credential')
    if not token:
        return 'existing_private_file' if info and info.st_size else 'missing'
    if not re.fullmatch(r'[A-Za-z0-9_]{20,255}', token):
        raise RuntimeError('invalid_wake_secret_format')
    tmp = PRIVATE + '/.upload-wake-' + secrets.token_hex(16)
    with sftp.open(tmp, 'wx') as out:
        try:
            sftp.chmod(tmp, 0o600)
            out.write(token.encode('ascii'))
        except BaseException:
            sftp.remove(tmp)
            raise
    try:
        sftp.posix_rename(tmp, target)
    finally:
        try:
            sftp.remove(tmp)
        except FileNotFoundError:
            pass
    return 'installed'

if __name__ == '__main__':
    token = os.environ.pop('NOA_JUKEBOX_WAKE_TOKEN', '').strip()
    release.main()
    transport = release.connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            print('UPLOAD_WAKE_CONFIGURATION', configure(sftp, token), flush=True)
    finally:
        transport.close()
