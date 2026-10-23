"""Route deployment rollback snapshots to ephemeral runner storage and verified Drive.

Normal production paths and the production deployment lock stay on SFTP.
Snapshot writes never create hosting copies. Missing Drive access fails closed.
"""
import base64
import configparser
import hashlib
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile

DRIVE_FOLDER = '1ZeCFabpOvXMB5rNRg8C3m5XR3mPTvKp3'
BASE = '/hosting/noastudio/'


def snapshot_path(path):
    if not isinstance(path, str) or not path.startswith(BASE) or '..' in Path(path).parts:
        return False
    rel = path[len(BASE):]
    if rel.startswith('noa-deploy-backups/'):
        return not rel.split('/')[1].startswith('.work-deploy-lock')
    return rel.startswith('noa-ai-lab/taxonomy-release-')


class DriveStore:
    def __init__(self):
        self.config = None
        self.verified = set()

    def command(self, *args):
        result = subprocess.run(['rclone', '--config', str(self.config),
                                 '--drive-root-folder-id', DRIVE_FOLDER, *args],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=180)
        if result.returncode:
            raise RuntimeError('DRIVE_SNAPSHOT_UNAVAILABLE: production snapshot write blocked')
        return result.stdout

    def require(self):
        if self.config:
            return
        value = os.environ.get('NOA_DRIVE_RCLONE_CONFIG_B64')
        if not value:
            raise RuntimeError('DRIVE_SNAPSHOT_AUTH_MISSING: no hosting backup will be created')
        if not shutil.which('rclone'):
            for command in [['sudo','apt-get','update','-qq'],['sudo','apt-get','install','-y','-qq','rclone']]:
                install=subprocess.run(command,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=180)
                if install.returncode:raise RuntimeError('DRIVE_SNAPSHOT_CLIENT_UNAVAILABLE: no hosting backup will be created')
        raw = base64.b64decode(value, validate=True)
        cfg = configparser.ConfigParser()
        cfg.read_string(raw.decode())
        if not cfg.has_section('noa-backup') or cfg.get('noa-backup', 'type') != 'drive':
            raise RuntimeError('DRIVE_SNAPSHOT_REMOTE_INVALID')
        folder = Path(os.environ['RUNNER_TEMP']) / 'noa-drive-snapshot-private'
        folder.mkdir(mode=0o700, exist_ok=True)
        self.config = folder / 'rclone.conf'
        self.config.write_bytes(raw)
        self.config.chmod(0o600)
        try:
            self.command('lsf', 'noa-backup:', '--max-depth', '1')
        except Exception:
            self.config.unlink(missing_ok=True)
            self.config = None
            raise

    def publish(self, path, local):
        self.require()
        data = local.read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        name = digest + '.snapshot'
        if digest not in self.verified:
            self.command('copyto', str(local), 'noa-backup:' + name, '--checksum', '--stats', '0')
            actual = self.command('cat', 'noa-backup:' + name)
            if len(actual) != len(data) or hashlib.sha256(actual).hexdigest() != digest:
                raise RuntimeError('DRIVE_SNAPSHOT_READBACK_MISMATCH')
            self.verified.add(digest)
        receipt = {'path': path, 'bytes': len(data), 'sha256': digest,
                   'drive_folder_id': DRIVE_FOLDER, 'drive_name': name,
                   'readback_verified': True, 'hosting_copy_created': False}
        receipt_name = hashlib.sha256(path.encode()).hexdigest() + '.receipt.json'
        with tempfile.NamedTemporaryFile(dir=os.environ['RUNNER_TEMP'], mode='w', delete=False) as f:
            json.dump(receipt, f)
            temp = Path(f.name)
        try:
            self.command('copyto', str(temp), 'noa-backup:' + receipt_name, '--checksum', '--stats', '0')
        finally:
            temp.unlink(missing_ok=True)


class SnapshotFile:
    def __init__(self, file, callback):
        self.file = file
        self.callback = callback
        self.closed = False

    def __getattr__(self, name):
        return getattr(self.file, name)

    def prefetch(self, *args, **kwargs):
        return None

    def set_pipelined(self, *args, **kwargs):
        return None

    def write(self, data):
        return self.file.write(data.encode() if isinstance(data, str) else data)

    def close(self):
        if not self.closed:
            self.closed = True
            self.file.close()
            self.callback()

    def __enter__(self):
        return self

    def __exit__(self, kind, value, trace):
        if kind is None:
            self.close()
        else:
            self.closed = True
            self.file.close()


class SnapshotSFTP:
    def __init__(self, sftp, store=None):
        self.sftp = sftp
        self.store = store or DriveStore()
        self.root = Path(os.environ['RUNNER_TEMP']) / 'noa-rollback-snapshots'

    def __getattr__(self, name):
        return getattr(self.sftp, name)

    def local(self, path):
        return self.root / path[len(BASE):]

    def mkdir(self, path, mode=0o755):
        if not snapshot_path(path):
            return self.sftp.mkdir(path, mode)
        self.store.require()
        local = self.local(path)
        local.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
        local.mkdir(mode=0o700)

    def normalize(self, path):
        if snapshot_path(path):
            if not self.local(path).exists():
                raise FileNotFoundError(path)
            return path
        return self.sftp.normalize(path)

    def lstat(self, path):
        return self.local(path).lstat() if snapshot_path(path) else self.sftp.lstat(path)

    stat = lstat

    def chmod(self, path, mode):
        return self.local(path).chmod(mode) if snapshot_path(path) else self.sftp.chmod(path, mode)

    def open(self, path, mode='r', *args, **kwargs):
        if not snapshot_path(path):
            return self.sftp.open(path, mode, *args, **kwargs)
        writing = any(flag in mode for flag in 'wxa+')
        if writing:
            self.store.require()
        local = self.local(path)
        py_mode = ('x' if 'x' in mode else 'a' if 'a' in mode else 'w' if 'w' in mode else 'r') + ('+' if '+' in mode else '') + 'b'
        file = local.open(py_mode)
        if not writing:
            return SnapshotFile(file, lambda: None)
        local.chmod(0o600)
        return SnapshotFile(file, lambda: self.store.publish(path, local))

    def remove(self, path):
        return self.local(path).unlink() if snapshot_path(path) else self.sftp.remove(path)

    def rmdir(self, path):
        return self.local(path).rmdir() if snapshot_path(path) else self.sftp.rmdir(path)


def snapshot_sftp(sftp):
    return SnapshotSFTP(sftp)
