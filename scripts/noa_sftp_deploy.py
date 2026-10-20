"""Pinned SSH deployment; creates only missing NOA files, never overwrites data."""
import base64
import hashlib
import io
import os
from pathlib import Path
import stat
import shlex
import re
import paramiko

FILES = {
    'deploy/noa-ui.css':'noa-ui.css',
    'deploy/noa-legacy-i18n.json':'noa-legacy-i18n.json',
    'deploy/noa-ui.js':'noa-ui.js',
    'deploy/noa-design.json':'noa-design.json',
    'deploy/noa-home.js':'noa-home.js',
    'deploy/noa-settings.php':'noa-settings.php',
    'deploy/noa-theme-admin.php':'noa-theme-admin.php',
    'bridge/ui-preferences.php':'noa-bridge/ui-preferences.php',
    'deploy/noa-design.extend.php':'extend/noa.design.php',
    'deploy/noa2.php': 'noa2.php',
    'deploy/noa-library.php': 'noa-library.php',
    'bridge/index.php': 'noa-bridge/index.php',
    'bridge/library.php': 'noa-bridge/library.php',
    'deploy/noa-home.extend.php': 'extend/noa.home.php',
    'bridge/storage.php': 'noa-bridge/storage.php',
    'bridge/setup.php': 'noa-bridge/setup.php',
    'bridge/seed.php': 'noa-bridge/seed.php',
    'bridge/source-archive.php': 'noa-bridge/source-archive.php',
    'bridge/source-import.php': 'noa-bridge/source-import.php',
    'bridge/source-cli.php': 'noa-bridge/source-cli.php',
    'bridge/source-audit.php': 'noa-bridge/source-audit.php',
    'bridge/catalog.php': 'noa-bridge/catalog.php',
    'bridge/check-media.php': 'noa-bridge/check-media.php',
    'bridge/user-playlists.php': 'noa-bridge/user-playlists.php',
    'deploy/noa-playlists.js': 'noa-playlists.js',
    'deploy/noa-editor.php': 'noa-editor.php',
    'deploy/noa-download.php': 'noa-download.php',
    'bridge/media-status.php': 'noa-bridge/media-status.php',
    'bridge/source-url-report.php': 'noa-bridge/source-url-report.php',
    'deploy/noa-manifest.json': 'noa-manifest.json',
    'deploy/noa-sw.js': 'noa-sw.js',
    'deploy/noa-icon-192.png': 'noa-icon-192.png',
    'deploy/noa-icon-512.png': 'noa-icon-512.png',
    'deploy/noa-music.php': 'noa-music.php',
    'deploy/noastudio/theme/noastudio/img/noa-face.jpg': 'noa-bridge/noa-face.jpg',
}
for character_file in ['cast-pair.jpg','noa-face.jpg','noa-face.png','noa-sheet.png','noa-side.jpg','noel-face.jpg','noel-face.png','noel-sheet.png','noel-side.jpg']:
    FILES['public/characters/'+character_file]='noa-bridge/characters/'+character_file

for theme_file in sorted(Path('deploy/theme/noa_studio').rglob('*')):
    if theme_file.is_file():FILES[str(theme_file)]='theme/noa_studio/'+str(theme_file.relative_to('deploy/theme/noa_studio'))

UPGRADE_FROM = {
    'noa-ui.css':'913f850315791f405920e675776b14ae3e52b107908bdfa08a24ec9c3a28d03a',
    'extend/noa.design.php':'268077455ef07ec2e471d7d31eb846049e97819f3ee7cfb4ac556122d7ff9780',
    'noa-ui.js':'55a9e184f2287272a5730243ca2e86fbc7a6d26f8febd6a88d5e6a4c566eb12d',
    'noa-bridge/media-status.php': 'bbc22ad2bf4118c372470d17eea462002908913401ade88078327afdd65b52b2',
    'noa-bridge/catalog.php': '9afa60c7efa78f0f84f77033a978f4abfdbbf0fc764ce32ed2f2123703b83061',
    'noa-bridge/source-import.php': 'a36477eadb38d85884e85b6f88a7eccabeb18809885d8baf5bf95f7688c26098',
    'noa-bridge/source-cli.php': '46bca66a3f0267a03d3c6aa5705a18b405e05c06b18d1bcca9ebab12507c365e',
    'noa-music.php': '8398475ffe080d977f6eaee0e870c83b96cf4f559706b912f03a0c93a2208574',
    'noa2.php': 'd9876e42c9352eef3cdde3f0167fad22272025e5bba832d38f06b651b7a94671',
    'noa-bridge/setup.php': 'ffe48650823967d7ca824b3dea988267515ebfe519a77c01113b8c9b4e5f589f',
    'noa-library.php': '25cf6ec71542615949a833fddb171f91e9007f0d223771c62d854d204ba34f66',
    'noa-bridge/index.php': '22eaf129ab9581e179521ae3c898b3c6d9e7652a4acb7b9b6c35d78693967c36',
    'noa-bridge/library.php': '4dba2be3791a6462724aa2dec1c3fc8c58e56798d8a6791c00f6a6631a170741',
}
PROTECTED = ['index.php', 'common.php', 'config.php', '.htaccess', 'data/dbconfig.php','head.php','tail.php','head.sub.php','tail.sub.php','version.php','theme/basic/theme.config.php']

def exists(sftp, path):
    try:
        sftp.lstat(path)
        return True
    except FileNotFoundError:
        return False

def digest(sftp, path):
    with sftp.open(path, 'rb') as handle:
        handle.prefetch(file_size=sftp.stat(path).st_size,max_concurrent_requests=8)
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
                if not stat.S_ISREG(sftp.lstat(target).st_mode):
                    raise RuntimeError('Refusing overwrite: '+relative)
                current = digest(sftp, target)
                if current == expected:
                    print('Already identical:', relative)
                elif current == UPGRADE_FROM.get(relative):
                    pending.append((target, relative, data, expected))
                else:
                    raise RuntimeError('Refusing unknown existing version: '+relative)
            else:
                if exists(sftp, target+'.upload.php'):
                    raise RuntimeError('Temporary target exists: '+relative)
                pending.append((target, relative, data, expected))
        if not exists(sftp, root+'/noa-bridge'):
            sftp.mkdir(root+'/noa-bridge', 0o755)
        elif not stat.S_ISDIR(sftp.lstat(root+'/noa-bridge').st_mode):
            raise RuntimeError('Invalid NOA bridge directory')
        if not exists(sftp, root+'/noa-bridge/characters'):
            sftp.mkdir(root+'/noa-bridge/characters',0o755)
        elif not stat.S_ISDIR(sftp.lstat(root+'/noa-bridge/characters').st_mode):
            raise RuntimeError('Invalid character asset directory')
        for relative in FILES.values():
            parent=root
            for part in relative.split('/')[:-1]:
                parent+='/'+part
                if not exists(sftp,parent):sftp.mkdir(parent,0o755)
                elif not stat.S_ISDIR(sftp.lstat(parent).st_mode):raise RuntimeError('Invalid deployment directory: '+relative)
        for target, relative, data, expected in pending:
            temp = target+'.upload.php'
            with sftp.open(temp, 'wx') as output:
                output.set_pipelined(True)
                output.write(data)
            sftp.chmod(temp, 0o644)
            if digest(sftp, temp) != expected:
                raise RuntimeError('Transfer verification failed: '+relative)
            if exists(sftp, target):
                if digest(sftp, target) != UPGRADE_FROM.get(relative):
                    raise RuntimeError('Concurrent remote change: '+relative)
                sftp.posix_rename(temp, target)
                action = 'UPDATED'
            else:
                sftp.rename(temp, target)
                action = 'CREATED'
            if digest(sftp, target) != expected:
                raise RuntimeError('Remote verification failed: '+relative)
            print(action, relative, 'bytes', len(data), 'sha256', expected)
        after = {p: digest(sftp, root+'/'+p) for p in before}
        if before != after:
            raise RuntimeError('Protected file changed during deployment')
        print('Protected GnuBoard files unchanged:', ', '.join(before))
        print('No SQL writes executed; only known NOA versions updated; no legacy file overwritten or deleted')
        sftp.close()
    finally:
        transport.close()

if __name__ == '__main__':
    main()
