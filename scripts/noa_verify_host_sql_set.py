"""Restore the exact enumerated backup bytes in disposable loopback MySQL only."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import tempfile
import paramiko
from noa_sql_backup_to_runner import FILES, REMOTE
from noa_verify_private_backup import verify_dump


def main():
    t = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    t.use_compression(True)
    try:
        t.get_security_options().key_types = ('ssh-ed25519',)
        t.start_client(timeout=30)
        fp = 'SHA256:' + base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        t.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        s = paramiko.SFTPClient.from_transport(t, window_size=8388608)
        s.get_channel().settimeout(90)
        if s.normalize(REMOTE) != REMOTE:
            raise RuntimeError('unexpected_root')
        report = []
        with tempfile.TemporaryDirectory(prefix='noa-host-sql-proof-') as tmp:
            os.chmod(tmp, 0o700)
            for name in FILES:
                attr = s.lstat(REMOTE + '/' + name)
                if not stat.S_ISREG(attr.st_mode) or not 0 < attr.st_size <= 268435456:
                    raise RuntimeError('unsafe_sql_source')
                with s.open(REMOTE + '/' + name[:-4] + '.json', 'rb') as f:
                    meta = json.loads(f.read(1048576))
                if meta['id'] != name[:-4] or meta['bytes'] != attr.st_size:
                    raise RuntimeError('source_manifest_mismatch')
                dump = Path(tmp) / name
                s.get(REMOTE + '/' + name, str(dump), max_concurrent_prefetch_requests=32)
                dump.chmod(0o600)
                after = s.lstat(REMOTE + '/' + name)
                with dump.open('rb') as f:
                    digest = hashlib.file_digest(f, 'sha256').hexdigest()
                if digest != meta['sha256'] or dump.stat().st_size != attr.st_size or (after.st_size, after.st_mtime) != (attr.st_size, attr.st_mtime):
                    raise RuntimeError('source_checksum_changed')
                env = dict(os.environ, MYSQL_PWD='noa-isolated-only')
                result = subprocess.run(['mysql', '--no-defaults', '--host=127.0.0.1', '--user=root', '--execute=DROP DATABASE IF EXISTS noa_restore_verification; CREATE DATABASE noa_restore_verification CHARACTER SET utf8mb4;'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=30)
                if result.returncode:
                    raise RuntimeError('isolated_database_reset_failed')
                verify_dump(dump, meta, tmp)
                report.append({'file': name, 'bytes': attr.st_size, 'sha256': digest, 'isolated_mysql_restore': True, 'all_rows_and_schemas_verified': True})
                dump.unlink()
        print('NOA_SQL_SET_RESTORE_PROOF ' + json.dumps({'files': report, 'production_mysql_modified': False, 'hosting_deleted': False}), flush=True)
    finally:
        t.close()


if __name__ == '__main__':
    main()
