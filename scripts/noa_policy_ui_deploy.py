"""Deploy three display assets, with exact Drive-backed preimages and no host staging."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import urllib.error
import urllib.request

import paramiko

ROOT = '/hosting/noastudio/html'
FILES = {
    'noa-policy-20261024.css': 'deploy/noa-policy-20261024.css',
    'noa-ui.js': 'deploy/noa-ui.js',
    'extend/noa.design.php': 'deploy/noa-design.extend.php',
}
PROTECTED = ['index.php', 'common.php', 'config.php', 'data/dbconfig.php',
             'bbs/login.php', 'bbs/login_check.php', 'noa-app/jukebox/core.php',
             'noa-app/jukebox/upload-core.php', 'noa-app/jukebox/upload.js',
             'noa-app/jukebox/upload-transport.js', 'noa-app/jukebox/service.php',
             'noa-app/database/core.php', 'noa-app/taxonomy/index.php']
STATE = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-policy-release.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    rollback = sys.argv[1:] == ['rollback']
    receipt = json.loads(Path('scripts/noa_policy_ui_drive_receipt.json').read_text())
    if not (receipt['readback_verified'] and receipt['restore_extraction_verified']):
        raise RuntimeError('drive_recovery_not_verified')
    new = {p: Path(f).read_bytes() for p, f in FILES.items()}
    old = {}
    for p, rec in receipt['files'].items():
        old[p] = subprocess.check_output(['git', 'show', receipt['baseline_commit'] + ':' + FILES[p]])
        if sha(old[p]) != rec['sha256'] or len(old[p]) != rec['bytes']:
            raise RuntimeError('runner_preimage_not_drive_verified')
    state = json.loads(STATE.read_text()) if rollback else {'changed': [], 'drive_file_id': receipt['drive_file_id']}
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    sftp = None
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=30)
        fp = 'SHA256:' + base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        sftp = paramiko.SFTPClient.from_transport(transport)
        if sftp.normalize(ROOT) != ROOT:
            raise RuntimeError('unexpected_host_root')

        def read(p):
            full = ROOT + '/' + p
            if sftp.normalize(full.rsplit('/', 1)[0]) != full.rsplit('/', 1)[0]:
                raise RuntimeError('noncanonical_parent')
            try:
                info = sftp.lstat(full)
            except FileNotFoundError:
                return None
            if not stat.S_ISREG(info.st_mode):
                raise RuntimeError('nonregular_file_preserved: ' + p)
            with sftp.open(full, 'rb') as f:
                return f.read()

        def write(p, data, exclusive=False):
            full = ROOT + '/' + p
            mode = 0o644 if exclusive else stat.S_IMODE(sftp.lstat(full).st_mode)
            with sftp.open(full, 'wx' if exclusive else 'wb') as f:
                f.write(data)
                f.flush()
            sftp.chmod(full, mode)
            if read(p) != data:
                raise RuntimeError('source_readback_mismatch: ' + p)

        def restore(allow_partial=False):
            for p in reversed(state['changed']):
                current = read(p)
                owned = current == new[p] or (allow_partial and current is not None and new[p].startswith(current))
                if not owned:
                    raise RuntimeError('rollback_concurrent_source_preserved: ' + p)
                if p in old:
                    write(p, old[p])
                else:
                    sftp.remove(ROOT + '/' + p)
            state['rolled_back'] = True
            STATE.write_text(json.dumps(state))

        if rollback:
            restore()
            print('NOA_POLICY_RELEASE_ROLLED_BACK')
            return

        before = {p: read(p) for p in FILES}
        for p, current in before.items():
            if current != new[p] and current != old.get(p):
                raise RuntimeError('unknown_current_source_preserved: ' + p)
        guard = {p: sha(read(p)) for p in PROTECTED}
        STATE.write_text(json.dumps(state))
        try:
            for p in FILES:
                if before[p] == new[p]:
                    continue
                if read(p) != before[p]:
                    raise RuntimeError('concurrent_change_preserved: ' + p)
                state['changed'].append(p)
                STATE.write_text(json.dumps(state))
                write(p, new[p], exclusive=before[p] is None)
            for p, expected in guard.items():
                if sha(read(p)) != expected:
                    raise RuntimeError('protected_source_changed: ' + p)
            for p in ['/', '/bbs/login.php', '/noa-settings.php', '/noa-music.php',
                      '/noa-app/database/index.php', '/noa-app/taxonomy/index.php']:
                expected = 403 if p.startswith('/noa-app/') else 200
                try:
                    with urllib.request.urlopen('https://noastudio.ai.kr' + p, timeout=30) as response:
                        if response.status != expected or b'Fatal error:' in response.read():
                            raise RuntimeError('http_smoke_failed: ' + p)
                except urllib.error.HTTPError as e:
                    if e.code != expected:
                        raise RuntimeError('guest_authorization_changed: ' + p) from e
            state.update(files={p: {'bytes': len(v), 'sha256': sha(v)} for p, v in new.items()},
                         protected_files_unchanged=len(guard), host_temporary_files=0,
                         database_mutations=0, drive_preimages_match_production=True)
            STATE.write_text(json.dumps(state))
            Path('policy-proof').mkdir(exist_ok=True)
            Path('policy-proof/deployment.json').write_text(json.dumps(state, indent=2) + '\n')
            print('NOA_COMMON_POLICY_DEPLOYED ' + json.dumps(state))
        except Exception:
            restore(allow_partial=True)
            raise
    finally:
        if sftp:
            sftp.close()
        transport.close()


if __name__ == '__main__':
    main()
