"""Guarded integration release using exact Drive-verified operating preimages.

Only this task's twelve reviewed runtime files may change. Rollback uses the
checkpoint archive, including the operating HOME bytes absent from git history.
"""
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import secrets
import stat
import sys
import tarfile
import time
import urllib.error
import urllib.parse
import urllib.request

import paramiko

ROOT = '/hosting/noastudio/html'
COMPLETION_STORE = '/hosting/noastudio/noa-ai-lab/n80-completion'
RECEIPT = Path('scripts/noa_finish_drive_receipt.json')
STATE = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-category-release.json'
# Helpers precede consumers; entry pages and HOME are activated last.
ORDER = ['noa-bridge/music-readmodel.php', 'noa-bridge/user-playlists.php',
         'noa-app/engine/event-contract.php', 'noa-app/engine/registry.php',
         'noa-app/engine/completion-receipt.php', 'noa-app/engine/completion-report.php',
         'noa-music-detail.php', 'noa-sitemap.php', 'noa-playlists.js',
         'noa-app/p0-player.js', 'noa-music.php', 'noa-app/home.php']
FILES = {p: ('bridge/' + p[len('noa-bridge/'):] if p.startswith('noa-bridge/') else 'deploy/' + p)
         for p in ORDER}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def load_preimages(receipt, archive):
    """Read bytes without extracting paths, symlinks or unexpected members."""
    if (receipt.get('readbackVerified') is not True
            or receipt.get('restoreExtractionVerified') is not True
            or receipt.get('checkpointRun') != 40078930378
            or receipt.get('artifactId') != 12554153399
            or set(receipt.get('files', {})) != set(FILES)
            or not re.fullmatch(r'[A-Za-z0-9_-]+', receipt.get('driveId', ''))):
        raise RuntimeError('drive_recovery_receipt_invalid')
    raw = Path(archive).read_bytes()
    if len(raw) > 20 * 1024 * 1024 or sha(raw) != receipt.get('archiveSha256'):
        raise RuntimeError('drive_verified_archive_hash_mismatch')
    expected = {p for p, info in receipt['files'].items() if info is not None}
    old = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode='r:gz') as source:
        for member in source.getmembers():
            if (member.name not in expected or member.name in old
                    or not member.isfile() or member.size > 4 * 1024 * 1024):
                raise RuntimeError('unexpected_recovery_archive_member')
            data = source.extractfile(member).read()
            record = receipt['files'][member.name]
            if len(data) != record['bytes'] or sha(data) != record['sha256']:
                raise RuntimeError('drive_verified_member_hash_mismatch: ' + member.name)
            old[member.name] = data
    if set(old) != expected:
        raise RuntimeError('incomplete_recovery_archive')
    return old


def snapshot(path):
    started = time.perf_counter()
    request = urllib.request.Request('https://noastudio.ai.kr' + path,
                                     headers={'Cache-Control': 'no-cache'})
    with urllib.request.urlopen(request, timeout=60) as response:
        body, url = response.read(), response.url
    return {'ids': set(re.findall(rb'data-video="([A-Za-z0-9_-]{11})"', body)),
            'keys': re.findall(rb'<article class="song" data-key="([^"]+)"', body),
            'bytes': len(body), 'total_ms': round((time.perf_counter()-started)*1000, 1),
            'url': url}


def verify(before):
    world = snapshot('/noa-world.php')
    ordinary = snapshot('/noa-youtube.php')
    if (not world['ids'] or ordinary['ids'] & world['ids']
            or ordinary['ids'] != before['ordinary']['ids']
            or world['ids'] != before['world']['ids']):
        raise RuntimeError('public_video_identity_preservation_failed')
    music = snapshot('/noa-music.php')
    if not music['keys'] or music['keys'] != before['music']['keys']:
        raise RuntimeError('music_ordered_key_preservation_failed')
    for path in ['/noa-youtube.php?world=1', '/noa-youtube.php?playlist=PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY']:
        if urllib.parse.urlparse(snapshot(path)['url']).path != '/noa-world.php':
            raise RuntimeError('legacy_world_route_failed')
    checks = []
    for path, expected in [('/noa-sitemap.php', 200), ('/noa-category-order-admin.php', 403),
                           ('/noa-library.php', 403), ('/noa-app/engine/completion-report.php', 401)]:
        try:
            with urllib.request.urlopen('https://noastudio.ai.kr' + path, timeout=45) as response:
                actual = response.status
        except urllib.error.HTTPError as error:
            actual = error.code
        if actual != expected:
            raise RuntimeError('public_status_failed: ' + path)
        checks.append({'url': 'https://noastudio.ai.kr' + path, 'status': actual,
                       'expectedStatus': expected})
    with urllib.request.urlopen('https://noastudio.ai.kr/noa-category-order.php', timeout=30) as response:
        order = json.load(response)
    if not all(isinstance(order.get(group), list) for group in ['story', 'cover']):
        raise RuntimeError('public_order_schema_invalid')
    return {'musicKeysPreserved': True, 'musicCount': len(music['keys']),
            'musicBytesBefore': before['music']['bytes'], 'musicBytesAfter': music['bytes'],
            'musicHttpMsBefore': before['music']['total_ms'], 'musicHttpMsAfter': music['total_ms'],
            'ordinaryBefore': len(before['ordinary']['ids']), 'ordinaryAfter': len(ordinary['ids']),
            'officialWorldCount': len(world['ids']), 'overlapAfter': 0,
            'nonOfficialSetPreserved': True, 'worldSetPreserved': True,
            'legacyLinksRedirectToWorld': True, 'http': checks}


def ensure_completion_store(sftp):
    parent = COMPLETION_STORE.rsplit('/', 1)[0]
    if sftp.normalize(parent) != parent or not stat.S_ISDIR(sftp.lstat(parent).st_mode):
        raise RuntimeError('unsafe_completion_parent')
    created = False
    try:
        info = sftp.lstat(COMPLETION_STORE)
    except FileNotFoundError:
        try:
            sftp.mkdir(COMPLETION_STORE, 0o700)
            created = True
        except OSError:
            # A concurrent creator is accepted only if all safety checks pass.
            pass
        info = sftp.lstat(COMPLETION_STORE)
    if (not stat.S_ISDIR(info.st_mode) or sftp.normalize(COMPLETION_STORE) != COMPLETION_STORE
            or stat.S_IMODE(info.st_mode) != 0o700):
        raise RuntimeError('unsafe_completion_directory')
    return created


def main():
    rollback = sys.argv[1:] == ['rollback']
    if sys.argv[1:] and not rollback:
        raise RuntimeError('unsupported_release_action')
    required = ['NOA_SSH_HOST', 'NOA_SSH_USER', 'NOA_SSH_PASSWORD', 'NOA_SSH_HOST_FINGERPRINT', 'GITHUB_SHA']
    if any(not os.environ.get(key) for key in required):
        raise RuntimeError('required_noa_release_secret_missing')
    receipt = json.loads(RECEIPT.read_text())
    archive = Path(os.environ.get('NOA_FINISH_PREIMAGE_ARCHIVE',
                     str(Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-finish-preimages/preimages.tar.gz')))
    old = load_preimages(receipt, archive)
    new = {p: Path(source).read_bytes() for p, source in FILES.items()}
    state = json.loads(STATE.read_text()) if rollback else {
        'changed': [], 'stagesCreated': [], 'source_commit': os.environ['GITHUB_SHA'],
        'drive_file_id': receipt['driveId'], 'preimage_archive_sha256': receipt['archiveSha256'],
        'checkpoint_run': receipt['checkpointRun'], 'checkpoint_artifact_id': receipt['artifactId']}
    if state.get('source_commit') != os.environ['GITHUB_SHA']:
        raise RuntimeError('release_state_commit_mismatch')
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    sftp = None
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=30)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(
            transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        sftp = paramiko.SFTPClient.from_transport(transport)
        sftp.get_channel().settimeout(90)
        if sftp.normalize(ROOT) != ROOT:
            raise RuntimeError('unexpected_host_root')

        def read(path):
            full = ROOT + '/' + path
            parent = full.rsplit('/', 1)[0]
            if sftp.normalize(parent) != parent:
                raise RuntimeError('noncanonical_parent')
            try:
                info = sftp.lstat(full)
            except FileNotFoundError:
                return None
            if not stat.S_ISREG(info.st_mode):
                raise RuntimeError('nonregular_file_preserved: ' + path)
            with sftp.open(full, 'rb') as stream:
                return stream.read()

        def save_state():
            STATE.write_text(json.dumps(state))

        def write(path, data, expected):
            full = ROOT + '/' + path
            if read(path) != expected:
                raise RuntimeError('concurrent_source_preserved: ' + path)
            mode = 0o644 if expected is None else stat.S_IMODE(sftp.lstat(full).st_mode)
            stage = full + '.noa-' + os.environ['GITHUB_SHA'][:12] + '-' + secrets.token_hex(12) + '.tmp'
            owned = False
            try:
                with sftp.open(stage, 'wx') as stream:
                    owned = True
                    state['stagesCreated'].append(stage)
                    save_state()
                    stream.write(data)
                    stream.flush()
                sftp.chmod(stage, mode)
                with sftp.open(stage, 'rb') as stream:
                    if stream.read() != data:
                        raise RuntimeError('temporary_readback_mismatch: ' + path)
                if read(path) != expected:
                    raise RuntimeError('concurrent_source_preserved: ' + path)
                if expected is None:
                    # Do not overwrite a concurrently created new endpoint.
                    sftp.rename(stage, full)
                else:
                    sftp.posix_rename(stage, full)
                owned = False
                if read(path) != data:
                    raise RuntimeError('source_readback_mismatch: ' + path)
            finally:
                if owned:
                    try:
                        sftp.remove(stage)
                    except FileNotFoundError:
                        pass

        def restore():
            conflicts = []
            for path in reversed(state['changed']):
                current = read(path)
                previous = old.get(path)
                if current == previous:
                    continue
                if current != new[path]:
                    conflicts.append(path)
                    continue
                if previous is None:
                    if read(path) != new[path]:
                        conflicts.append(path)
                        continue
                    sftp.remove(ROOT + '/' + path)
                else:
                    write(path, previous, current)
            state['rolled_back'] = not conflicts
            state['rollback_preserved_concurrent'] = conflicts
            save_state()
            if conflicts:
                raise RuntimeError('rollback_concurrent_source_preserved: ' + ','.join(conflicts))

        if rollback:
            restore()
            print('NOA_INTEGRATION_OWNED_BYTES_ROLLED_BACK')
            return
        before = {path: read(path) for path in FILES}
        for path, current in before.items():
            if current != new[path] and current != old.get(path):
                raise RuntimeError('unknown_current_source_preserved: ' + path)
        protected = {}
        for path, expected in receipt['protected'].items():
            current = read(path)
            if current is None or len(current) != expected['bytes'] or sha(current) != expected['sha256']:
                raise RuntimeError('protected_source_changed_since_checkpoint: ' + path)
            protected[path] = expected['sha256']
        state['completion_directory_created'] = ensure_completion_store(sftp)
        save_state()
        public_before = {'ordinary': snapshot('/noa-youtube.php'), 'world': snapshot('/noa-world.php'),
                         'music': snapshot('/noa-music.php')}
        try:
            for path in FILES:
                if before[path] == new[path]:
                    continue
                if read(path) != before[path]:
                    raise RuntimeError('concurrent_change_preserved: ' + path)
                state['changed'].append(path)
                save_state()
                write(path, new[path], before[path])
            for path, expected in protected.items():
                current = read(path)
                if current is None or sha(current) != expected:
                    raise RuntimeError('protected_source_changed: ' + path)
            for stage in state['stagesCreated']:
                try:
                    sftp.lstat(stage)
                except FileNotFoundError:
                    continue
                raise RuntimeError('owned_release_temporary_residue')
            state['publicVerification'] = verify(public_before)
            state.update(files={p: {'bytes': len(data), 'sha256': sha(data), 'readbackVerified': True}
                                for p, data in new.items()},
                         preimages=receipt['files'], protected_files_unchanged=len(protected),
                         atomicReplacement=True, host_temporary_files=0, database_mutations=0,
                         drive_preimages_match_production=True)
            save_state()
            Path('category-deploy-proof.json').write_text(json.dumps(state, indent=2) + '\n')
            print('NOA_INTEGRATION_FINISH_DEPLOYED ' + json.dumps(state))
        except Exception:
            restore()
            raise
    finally:
        if sftp:
            sftp.close()
        transport.close()


if __name__ == '__main__':
    main()
