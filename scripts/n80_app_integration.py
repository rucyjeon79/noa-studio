"""Authenticated whole-app data integration. Work files stay on the runner."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import stat
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request

from n80_guardian_remote_audit import ROOT, compare_sources
from n80_live_observer import NoRedirect

NEW_FILES = ('noa-app/engine/app-data.php', 'noa-app/engine/app-observe.php')
ADAPTER = 'noa-app/engine/music-adapter.php'
OLD_SHA = '95a49f20c81aa0cc36c47d21584522419da9490c9bfc1c3687cb1ddc39cf5f2d'
BASE_COMMIT = 'b6edbbfd200be90f8b4d8fd2cb575f043539ad9f'
URL = 'https://noastudio.ai.kr/noa-app/engine/app-observe.php'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(sftp, path):
    try:
        if not stat.S_ISREG(sftp.lstat(path).st_mode):
            raise RuntimeError('unsafe_runtime_file')
        with sftp.open(path, 'rb') as handle:
            return handle.read()
    except FileNotFoundError:
        return None


def install(sftp):
    proof = json.loads(Path('scripts/n80_music_adapter_drive_receipt.json').read_text())
    if (proof.get('sha256') != OLD_SHA or proof.get('readbackVerified') is not True
            or proof.get('bytes') != 1148 or not proof.get('driveId')):
        raise RuntimeError('verified_drive_preimage_required')
    baseline = subprocess.check_output(['git', 'show', BASE_COMMIT + ':deploy/' + ADAPTER])
    if sha(baseline) != OLD_SHA:
        raise RuntimeError('restore_source_mismatch')
    subprocess.run(['php', '-l'], input=baseline, capture_output=True, check=True)
    audit = compare_sources(sftp)
    for row in audit['rows']:
        if row['state'] == 'match' or (not row['required'] and row['state'] == 'missing'):
            continue
        if row['module'] in NEW_FILES and row['state'] == 'missing':
            continue
        if row['module'] == ADAPTER and row['actualSha256'] == OLD_SHA:
            continue
        raise RuntimeError('unrecognized_production_change:' + row['module'])
    parent = ROOT + '/noa-app/engine'
    if sftp.normalize(parent) != parent:
        raise RuntimeError('unsafe_runtime_directory')
    installed = []
    for relative in NEW_FILES:
        target = ROOT + '/' + relative
        data = (Path('deploy') / relative).read_bytes()
        current = read(sftp, target)
        if current is not None:
            if current != data:
                raise RuntimeError('unknown_integration_runtime_version')
            continue
        with sftp.open(target, 'wx') as handle:
            handle.write(data)
        sftp.chmod(target, 0o644)
        if read(sftp, target) != data:
            raise RuntimeError('new_runtime_readback_failed')
        installed.append(relative)
    target = ROOT + '/' + ADAPTER
    expected = (Path('deploy') / ADAPTER).read_bytes()
    current = read(sftp, target)
    if current != expected:
        if current != baseline:
            raise RuntimeError('concurrent_adapter_change')
        # This small internal library is replaced only while the shared Actions
        # deployment/observer concurrency group is held. No hosting staging copy.
        try:
            with sftp.open(target, 'wb') as handle:
                handle.write(expected)
            if read(sftp, target) != expected:
                raise RuntimeError('adapter_readback_failed')
        except Exception:
            actual = read(sftp, target)
            if actual is not None and len(actual) <= len(expected) and expected.startswith(actual):
                with sftp.open(target, 'wb') as handle:
                    handle.write(baseline)
                if read(sftp, target) != baseline:
                    raise RuntimeError('adapter_restore_failed') from None
            raise
        installed.append(ADAPTER)
    verified = compare_sources(sftp)
    if not verified['allMatch']:
        raise RuntimeError('post_install_source_drift')
    return {'changedFiles': installed, 'verifiedFiles': verified['requiredCount'],
            'driveRecoveryCopy': proof, 'hostBackupFiles': 0, 'hostTemporaryFiles': 0}


def call(key):
    raw = b'{"action":"audit"}'
    ts, nonce = str(int(time.time())), secrets.token_hex(16)
    msg = 'N80-APP-DATA-1\n' + sha(raw) + '\n' + ts + '\n' + nonce
    req = urllib.request.Request(URL, data=raw, method='POST', headers={
        'Content-Type': 'application/json', 'X-N80-Timestamp': ts, 'X-N80-Nonce': nonce,
        'X-N80-Signature': hmac.new(key, msg.encode(), hashlib.sha256).hexdigest()})
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=150) as response:
            body = response.read(2 * 1024 * 1024 + 1)
            signature = response.headers.get('X-N80-Signature', '')
    except (OSError, TimeoutError):
        raise RuntimeError('app_data_endpoint_unavailable') from None
    if len(body) > 2 * 1024 * 1024:
        raise RuntimeError('app_data_response_oversize')
    expected = hmac.new(key, ('N80-APP-DATA-RESPONSE-1\n' + nonce + '\n' + sha(body)).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise RuntimeError('app_data_response_authentication_failed')
    decoded = json.loads(body)
    if decoded.get('nonce') != nonce or decoded.get('ok') is not True:
        raise RuntimeError('app_data_response_binding_failed')
    return decoded['result']


def public_checks():
    checks = []
    pages = {'/': [200], '/bbs/login.php': [200], '/noa-music.php': [200],
             '/noa-youtube.php': [200], '/noa-world.php': [200], '/noa-ai-lab.php': [200, 302, 403],
             '/noa-app/jukebox/': [200, 302, 403], '/noa-app/database/': [302, 403],
             '/noa-bridge/user-playlists.php': [401]}
    opener = urllib.request.build_opener(NoRedirect())
    for path, allowed in pages.items():
        try:
            with opener.open('https://noastudio.ai.kr' + path, timeout=25) as response:
                status = response.status
                content = response.read(128 * 1024)
                nonempty = bool(content.strip())
        except urllib.error.HTTPError as error:
            status, nonempty = error.code, True
        except OSError:
            status, nonempty = 0, False
        checks.append({'path': path, 'status': status, 'ok': status in allowed and nonempty})
    with opener.open('https://noastudio.ai.kr/noa-bridge/catalog.php', timeout=60) as response:
        data = json.load(response)
    items = data['items']
    media = {'publicCatalogItems': len(items), 'audioVerifiedItems': sum(bool(r.get('audioVerified')) for r in items)}
    for field, label in [('audioUrl', 'audio'), ('coverImageUrl', 'cover')]:
        candidate = next((row.get(field) for row in items if row.get(field) and urllib.parse.urlsplit(row[field]).hostname == 'noastudio.ai.kr'), None)
        if not candidate:
            media[label] = {'ok': False, 'reason': 'no_public_sample'}
            continue
        req = urllib.request.Request(candidate, headers={'Range': 'bytes=0-4095'})
        with opener.open(req, timeout=30) as response:
            prefix = response.read(4096)
            content_type = response.headers.get('Content-Type', '')
            media[label] = {'ok': bool(prefix) and ('audio/' in content_type if label == 'audio' else 'image/' in content_type),
                            'status': response.status, 'contentType': content_type, 'sampleBytes': len(prefix)}
    return {'pages': checks, 'media': media}


def main():
    import paramiko
    if any(not os.getenv(k) for k in ['NOA_SSH_HOST', 'NOA_SSH_USER', 'NOA_SSH_PASSWORD', 'NOA_SSH_HOST_FINGERPRINT']):
        raise RuntimeError('missing_noa_connection')
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        fp = 'SHA256:' + base64.b64encode(hashlib.sha256(transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if not hmac.compare_digest(fp, os.environ['NOA_SSH_HOST_FINGERPRINT']):
            raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            sftp.get_channel().settimeout(45)
            with sftp.open('/hosting/noastudio/noa-ai-lab/worker.key', 'rb') as handle:
                key = handle.read(256).strip()
            if len(key) != 64:
                raise RuntimeError('invalid_noa_service_key')
            deployment = install(sftp)
        finally:
            sftp.close()
    finally:
        transport.close()
    try:
        urllib.request.build_opener(NoRedirect()).open(URL, timeout=20)
    except urllib.error.HTTPError as error:
        if error.code != 401:
            raise RuntimeError('app_data_authentication_check_failed') from None
    else:
        raise RuntimeError('app_data_endpoint_unprotected')
    result = call(key)
    proof = {'commit': os.environ['GITHUB_SHA'], 'runId': os.environ['GITHUB_RUN_ID'],
             'deployment': deployment, 'appData': result}
    destination = Path(os.environ['RUNNER_TEMP']) / 'n80-app-integration.json'
    destination.write_text(json.dumps(proof, indent=2) + '\n')
    proof['publicChecks'] = public_checks()
    destination.write_text(json.dumps(proof, indent=2) + '\n')
    with open(os.environ['GITHUB_STEP_SUMMARY'], 'a') as handle:
        handle.write('## N80 whole-app data integration\n\n')
        handle.write('Tables verified: ' + str(result['modules']['database']['tablesVerified']) + '\n\n')
        handle.write('Data issues: ' + str(len(result['issues'])) + '; database writes: 0.\n')
    print('N80_APP_INTEGRATION_RESULT', json.dumps(proof))
    if not result['integrityOk'] or any(not row['ok'] for row in proof['publicChecks']['pages']):
        raise RuntimeError('app_integration_findings_require_review')


if __name__ == '__main__':
    main()
