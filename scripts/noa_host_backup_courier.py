"""Read-only deployment backup collection and capacity/reference evidence."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import paramiko

ROOT = '/hosting/noastudio'


def main():
    target = Path(os.environ['RUNNER_TEMP']) / 'noa-db-backups'
    target.mkdir(mode=0o700)
    t = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        t.get_security_options().key_types = ('ssh-ed25519',)
        t.start_client(timeout=30)
        fp = 'SHA256:' + base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        t.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        s = paramiko.SFTPClient.from_transport(t)
        s.get_channel().settimeout(60)
        if s.normalize(ROOT) != ROOT:
            raise RuntimeError('unexpected_root')
        stack = [ROOT + '/noa-deploy-backups']
        for attr in s.listdir_attr(ROOT + '/noa-ai-lab'):
            if attr.filename.startswith('taxonomy-release-') and stat.S_ISDIR(attr.st_mode):
                stack.append(ROOT + '/noa-ai-lab/' + attr.filename)
        rows = []
        with tarfile.open(target / 'deployment-backups.tar.gz', 'w:gz') as tar:
            while stack:
                folder = stack.pop()
                if s.normalize(folder) != folder:
                    raise RuntimeError('backup_directory_symlink')
                for attr in s.listdir_attr(folder):
                    path = folder + '/' + attr.filename
                    if attr.filename == '.work-deploy-lock':
                        raise RuntimeError('deployment_active_preserved')
                    if stat.S_ISDIR(attr.st_mode):
                        stack.append(path)
                        continue
                    if not stat.S_ISREG(attr.st_mode) or attr.st_size > 16777216:
                        raise RuntimeError('unknown_backup_file_preserved')
                    with s.open(path, 'rb') as f:
                        data = f.read(attr.st_size + 1)
                    after = s.lstat(path)
                    if len(data) != attr.st_size or (after.st_size, after.st_mtime) != (attr.st_size, attr.st_mtime):
                        raise RuntimeError('backup_changed_preserved')
                    rel = path[len(ROOT) + 1:]
                    item = tarfile.TarInfo(rel)
                    item.size = len(data)
                    item.mode = 0o600
                    item.mtime = attr.st_mtime
                    tar.addfile(item, io.BytesIO(data))
                    rows.append({'path': rel, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'mtime': attr.st_mtime})
        facts = {}
        commands = {
            'tools': 'for x in php php8.2 php82 flock sha256sum du grep find; do command -v "$x" || true; done',
            'capacity': 'du -sb /hosting/noastudio/*',
            'backup_runtime_references': "grep -RlE 'noa-db-private|noa-deploy-backups' /hosting/noastudio/html --include='*.php' --include='*.js'",
            'sql_literal_runtime_references': "grep -RlE '15133165eb1e1d6529158ed051d94e9a|fda4138b6ba4d525f337e4a86038218f|d54c43955754a84d1fca3778345f37a0|ce1beb1a0ad64e9dc4b50654625c6618|362dfee5ef4c3df496fdbc83cb482a5a' /hosting/noastudio/html --include='*.php' --include='*.js'",
            'db_lock': 'flock -n /hosting/noastudio/noa-db-private/operation.lock true',
        }
        for name, command in commands.items():
            try:
                channel = t.open_session(timeout=20)
                channel.settimeout(90)
                channel.exec_command(command)
                output = channel.makefile('rb').read(1048576).decode(errors='replace')
                status = channel.recv_exit_status()
                channel.close()
                facts[name] = {'status': status, 'output': output}
            except Exception:
                facts[name] = {'unavailable': True}
        protected = {}
        for rel in ['html/index.php', 'html/common.php', 'html/config.php', 'html/data/dbconfig.php', 'html/noa-app/database/core.php', 'html/noa-app/jukebox/core.php', 'html/noa-app/jukebox/service.php']:
            with s.open(ROOT + '/' + rel, 'rb') as f:
                data = f.read(2097153)
            if len(data) > 2097152:
                raise RuntimeError('protected_code_too_large')
            protected[rel] = hashlib.sha256(data).hexdigest()
        facts['protected_hashes'] = protected
        plans = []
        for attr in s.listdir_attr(ROOT + '/noa-db-private'):
            if attr.filename.endswith('.partial') or attr.filename.startswith('restore-plan-'):
                plans.append({'name': attr.filename, 'bytes': attr.st_size, 'mtime': attr.st_mtime})
        facts['active_or_planned_database_operations'] = plans
        report = {'files': rows, 'total_bytes': sum(row['bytes'] for row in rows), 'facts': facts}
        (target / 'deployment-manifest.json').write_text(json.dumps(report, indent=2))
        print('DEPLOYMENT_BACKUPS_READ_ONLY_COLLECTED', len(rows), report['total_bytes'], flush=True)
    finally:
        t.close()


if __name__ == '__main__':
    main()
