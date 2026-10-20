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
    'deploy/noa-manifest.json': 'noa-manifest.json',
    'deploy/noa-sw.js': 'noa-sw.js',
    'deploy/noa-icon-192.png': 'noa-icon-192.png',
    'deploy/noa-icon-512.png': 'noa-icon-512.png',
    'deploy/noa-music.php': 'noa-music.php',
    'deploy/noastudio/theme/noastudio/img/noa-face.jpg': 'noa-bridge/noa-face.jpg',
}
for character_file in ['cast-pair.jpg','noa-face.jpg','noa-face.png','noa-sheet.png','noa-side.jpg','noel-face.jpg','noel-face.png','noel-sheet.png','noel-side.jpg']:
    FILES['public/characters/'+character_file]='noa-bridge/characters/'+character_file

UPGRADE_FROM = {
    'noa-bridge/source-import.php': 'a36477eadb38d85884e85b6f88a7eccabeb18809885d8baf5bf95f7688c26098',
    'noa-bridge/source-cli.php': '46bca66a3f0267a03d3c6aa5705a18b405e05c06b18d1bcca9ebab12507c365e',
    'noa-music.php': 'd7709827760b42cedbd358c14d7516666e55c84ef17ff91113b53ed2dfa60d27',
    'noa2.php': '6516bb99bf0e25cab7cdf940b61c1850137b2780c7fc24bbeebd52d21588175a',
    'noa-bridge/setup.php': '7f309c673320781965d19766dfff614a98e42cac52ae8add1093bf4cdef052e0',
    'noa-library.php': 'c052ba7d1b40ea56e216c9a09925390b0b872bbe9b233ac95d01f54af4739d55',
    'noa-bridge/index.php': '22eaf129ab9581e179521ae3c898b3c6d9e7652a4acb7b9b6c35d78693967c36',
    'noa-bridge/library.php': '4dba2be3791a6462724aa2dec1c3fc8c58e56798d8a6791c00f6a6631a170741',
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
        probe = transport.open_session(timeout=15)
        probe.settimeout(20)
        probe.exec_command('php -v')
        print('PHP CLI version probe:', probe.recv(2048).decode('utf-8',errors='replace')[:500])
        print('PHP CLI probe exit:', probe.recv_exit_status())
        probe.close()
        php = """define('_GNUBOARD_', true);
        chdir('/hosting/noastudio/html');
        include 'data/dbconfig.php';
        try {
          mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
          $db = new mysqli(G5_MYSQL_HOST,G5_MYSQL_USER,G5_MYSQL_PASSWORD,G5_MYSQL_DB);
          $rows = $db->query('SHOW TABLES'); $out = [];
          while ($r = $rows->fetch_row()) {
            $name = $r[0];
            if (preg_match('/^(g5_member|g5_board|g5_write_[a-z0-9_]+|noa_[a-z0-9_]+)$/D', $name)) {
              $n = $db->query('SELECT COUNT(*) FROM `'.$name.'`')->fetch_row();
              $out[$name] = (int)$n[0];
            }
          }
          echo json_encode(['read_only_table_counts'=>$out]);
        } catch (Throwable $e) { echo json_encode(['inspection_error'=>get_class($e)]); }
        """
        channel = transport.open_session(timeout=15)
        channel.settimeout(20)
        channel.exec_command('php -r '+shlex.quote(php))
        chunks = []
        while True:
            block = channel.recv(4096)
            if not block:
                break
            chunks.append(block)
        diagnostic = b''.join(chunks).decode('utf-8', errors='replace').strip()
        # Print only the intended JSON; never expose PHP diagnostics or config.
        import json
        try:
            metadata = json.loads(diagnostic)
            print('Database inspection:', json.dumps(metadata))
        except ValueError:
            print('Database inspection: CLI did not return metadata JSON')
        channel.close()
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
        candidates = []
        for directory in ['/usr/bin', '/usr/local/bin', '/usr/local']:
            try:
                names = [n for n in sftp.listdir(directory) if 'php' in n.lower()]
                print('PHP runtime inventory:', directory, names)
                for name in names:
                    full = directory+'/'+name
                    if stat.S_ISDIR(sftp.stat(full).st_mode):
                        for suffix in ['/bin/php', '/bin/php-cli']:
                            if exists(sftp, full+suffix): candidates.append(full+suffix)
                    elif re.fullmatch(r'php(?:-cli|[0-9.]*)?', name): candidates.append(full)
            except (OSError, IOError):
                print('PHP runtime inventory unavailable:', directory)
        migrated = False
        for binary in candidates:
            if not stat.S_ISREG(sftp.stat(binary).st_mode): continue
            check = transport.open_session(timeout=15)
            check.settimeout(20)
            check.exec_command(shlex.quote(binary)+' -v')
            version=check.recv(2048).decode('utf-8',errors='replace')
            status=check.recv_exit_status(); check.close()
            print('Runtime candidate:', binary, 'exit', status, version[:160])
            if status or '(cli)' not in version: continue
            run = transport.open_session(timeout=15); run.settimeout(40)
            run.exec_command(shlex.quote(binary)+' '+shlex.quote(root+'/noa-bridge/source-cli.php'))
            result=run.makefile('r').read().decode('utf-8',errors='replace').strip()
            status=run.recv_exit_status();run.close()
            try:
                report=json.loads(result)
            except ValueError:
                raise RuntimeError('Source migration did not return JSON')
            print('Source migration report:', json.dumps(report,ensure_ascii=False))
            if status: raise RuntimeError('Source migration verification failed')
            migrated=True;break
        if not migrated:
            try:
                from noa_source_migrate import migrate
                migrate(transport, sftp, root)
            except Exception as exc:
                print('SOURCE_IMPORT_PENDING:', type(exc).__name__, '(details withheld to protect database credentials)')
        sftp.close()
    finally:
        transport.close()

if __name__ == '__main__':
    main()
