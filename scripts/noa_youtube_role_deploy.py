"""Deploy only the public YouTube read model; no data writes or host staging."""
import base64
import hashlib
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import re
import time
import urllib.error
import urllib.request
import urllib.parse

import paramiko

ROOT = '/hosting/noastudio/html'
FILES = {
    'noa-bridge/youtube-store.php': 'bridge/youtube-store.php',
    'noa-youtube.php': 'deploy/noa-youtube.php',
}
PROTECTED = ['index.php', 'common.php', 'config.php', 'data/dbconfig.php',
             'bbs/login.php', 'bbs/login_check.php', 'noa-app/jukebox/core.php',
             'noa-app/jukebox/upload-core.php', 'noa-app/jukebox/upload.js',
             'noa-app/jukebox/upload-transport.js', 'noa-app/jukebox/service.php',
             'noa-app/database/core.php', 'noa-app/taxonomy/index.php',
             'noa-app/home.php','noa-bridge/world-mv.php']
STATE = Path(os.environ.get('RUNNER_TEMP', '/tmp')) / 'noa-youtube-role-release.json'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def snapshot(path):
    started=time.perf_counter()
    with urllib.request.urlopen('https://noastudio.ai.kr'+path,timeout=45)as r:
        body=r.read();url=r.url
    return {'ids':set(re.findall(rb'data-video="([A-Za-z0-9_-]{11})"',body)),
            'bytes':len(body),'total_ms':round((time.perf_counter()-started)*1000,1),'url':url}


def verify(before):
    for attempt in range(3):
        world=snapshot('/noa-world.php');ordinary=snapshot('/noa-youtube.php')
        expected=before['ordinary']['ids']-before['world']['ids']
        if world['ids'] and not ordinary['ids']&world['ids'] and ordinary['ids']==expected and world['ids']==before['world']['ids']:
            break
        if attempt==2:raise RuntimeError('public_membership_or_preservation_check_failed')
        time.sleep(2)
    for path in ['/noa-youtube.php?world=1','/noa-youtube.php?playlist=PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY']:
        if urllib.parse.urlparse(snapshot(path)['url']).path!='/noa-world.php':raise RuntimeError('legacy_world_route_failed')
    return {'ordinaryBefore':len(before['ordinary']['ids']),'ordinaryAfter':len(ordinary['ids']),
            'officialWorldCount':len(world['ids']),'overlapAfter':0,'nonOfficialSetPreserved':True,
            'worldSetPreserved':True,'legacyLinksRedirectToWorld':True,
            'htmlBytesBefore':before['ordinary']['bytes'],'htmlBytesAfter':ordinary['bytes'],
            'httpTotalMsBefore':before['ordinary']['total_ms'],'httpTotalMsAfter':ordinary['total_ms'],
            'ordinaryIdsAfter':sorted(x.decode()for x in ordinary['ids']),
            'officialWorldIds':sorted(x.decode()for x in world['ids'])}


def main():
    rollback = sys.argv[1:] == ['rollback']
    receipt = json.loads(Path('scripts/noa_youtube_role_drive_receipt.json').read_text())
    if not (receipt['readbackVerified'] and receipt['restoreExtractionVerified']):
        raise RuntimeError('drive_recovery_not_verified')
    new = {p: Path(f).read_bytes() for p, f in FILES.items()}
    old = {}
    for p, rec in receipt['files'].items():
        old[p] = subprocess.check_output(['git', 'show', receipt['baseCommit'] + ':' + FILES[p]])
        if sha(old[p]) != rec['sha256'] or len(old[p]) != rec['bytes']:
            raise RuntimeError('runner_preimage_not_drive_verified')
    state = json.loads(STATE.read_text()) if rollback else {'changed': [], 'drive_file_id': receipt['driveId']}
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
            print('NOA_YOUTUBE_ROLE_ROLLED_BACK')
            return

        before = {p: read(p) for p in FILES}
        for p, current in before.items():
            if current != new[p] and current != old.get(p):
                raise RuntimeError('unknown_current_source_preserved: ' + p)
        guard = {p: sha(read(p)) for p in PROTECTED}
        STATE.write_text(json.dumps(state))
        public_before={'ordinary':snapshot('/noa-youtube.php'),'world':snapshot('/noa-world.php')}
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
            state['publicVerification']=verify(public_before)
            state.update(files={p: {'bytes': len(v), 'sha256': sha(v)} for p, v in new.items()},
                         protected_files_unchanged=len(guard), host_temporary_files=0,
                         database_mutations=0, drive_preimages_match_production=True)
            STATE.write_text(json.dumps(state))
            Path('youtube-role-proof.json').write_text(json.dumps(state, indent=2) + '\n')
            print('NOA_YOUTUBE_ROLE_DEPLOYED ' + json.dumps(state))
        except Exception:
            restore(allow_partial=True)
            raise
    finally:
        if sftp:
            sftp.close()
        transport.close()


if __name__ == '__main__':
    main()
