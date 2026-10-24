"""Read-only preservation of three explicitly inventoried stale staging files."""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import stat
import tarfile
import time
import paramiko

FILES = [
    'html/.noa-playlists.js.d9b07e91918b.tmp',
    'html/noa-jukebox/컬렉션/fantasy-ambient-edm/EP.22 하루의 끝에 - Reborn/cover.webp.stage-39545023474',
    'html/noa-app/jukebox/upload.css.b2fddd64b01f.tmp',
]


def main():
    root = '/hosting/noastudio'
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
        rows = []
        with tarfile.open(target / 'staging-backups.tar.gz', 'w:gz') as tar:
            for rel in FILES:
                path = root + '/' + rel
                try:
                    attr = s.lstat(path)
                except FileNotFoundError:
                    continue
                if not stat.S_ISREG(attr.st_mode) or attr.st_size > 1048576 or time.time() - attr.st_mtime < 3600:
                    raise RuntimeError('staging_not_stale_regular_file')
                with s.open(path, 'rb') as f:
                    data = f.read(attr.st_size + 1)
                after = s.lstat(path)
                if len(data) != attr.st_size or (after.st_size, after.st_mtime) != (attr.st_size, attr.st_mtime):
                    raise RuntimeError('staging_changed_preserved')
                member = tarfile.TarInfo(rel)
                member.size = len(data)
                member.mode = 0o600
                member.mtime = attr.st_mtime
                tar.addfile(member, io.BytesIO(data))
                rows.append({'path': rel, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(), 'mtime': attr.st_mtime})
        (target / 'staging-manifest.json').write_text(json.dumps({'files': rows}, indent=2))
        print('STALE_STAGING_READ_ONLY_PRESERVED', len(rows), sum(r['bytes'] for r in rows), flush=True)
    finally:
        t.close()


if __name__ == '__main__':
    main()
