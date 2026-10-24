"""Install only new finished runtime files and run a signed live observation.
No backup, host staging file, schema mutation, queue claim or business ACK.
"""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import stat
import time
import urllib.error
import urllib.request

from n80_guardian_remote_audit import ROOT, compare_sources

FILES = ('noa-app/engine/live-observer.php', 'noa-app/engine/observe.php')
URL = 'https://noastudio.ai.kr/noa-app/engine/observe.php'


def sha(data):
    return hashlib.sha256(data).hexdigest()


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def request_observation(key):
    raw = b'{"action":"observe","limit":10}'
    timestamp, nonce = str(int(time.time())), secrets.token_hex(16)
    message = 'N80-OBSERVE-1\n' + sha(raw) + '\n' + timestamp + '\n' + nonce
    signature = hmac.new(key, message.encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(URL, data=raw, headers={
        'Content-Type': 'application/json', 'X-N80-Timestamp': timestamp,
        'X-N80-Nonce': nonce, 'X-N80-Signature': signature}, method='POST')
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=45) as response:
            body = response.read(1024 * 1024 + 1)
            actual_signature = response.headers.get('X-N80-Signature', '')
            content_type = response.headers.get('Content-Type', '')
    except (OSError, TimeoutError):
        raise RuntimeError('observer_transport_failed') from None
    if len(body) > 1024 * 1024 or 'application/json' not in content_type:
        raise RuntimeError('observer_response_invalid')
    expected = hmac.new(key, ('N80-OBSERVE-RESPONSE-1\n' + nonce + '\n' + sha(body)).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(actual_signature, expected):
        raise RuntimeError('observer_response_authentication_failed')
    result = json.loads(body)
    if result.get('ok') is not True or result.get('nonce') != nonce:
        raise RuntimeError('observer_response_binding_failed')
    observed = result['result']
    if (observed.get('runtime') != 'live_observer'
            or observed.get('productionWrites') != 0
            or observed.get('businessAck') is not False
            or observed.get('queueMutation') is not False
            or observed.get('automaticDispatch') is not False
            or not observed.get('guardian', {}).get('policyCompliant')):
        raise RuntimeError('observer_safety_contract_failed')
    if observed.get('rejected'):
        raise RuntimeError('observer_catalog_reconciliation_failed')
    return observed


def unauthorized_check():
    try:
        with urllib.request.build_opener(NoRedirect()).open(URL, timeout=20):
            raise RuntimeError('observer_authentication_not_enforced')
    except urllib.error.HTTPError as error:
        if error.code != 401:
            raise RuntimeError('observer_authentication_check_failed') from None


def install_finished(sftp):
    initial = compare_sources(sftp)
    # Every pre-existing production source must already match. Only these exact
    # new files may be absent; unknown versions are never overwritten.
    for row in initial['rows']:
        if row['state'] == 'match' or (not row['required'] and row['state'] == 'missing'):
            continue
        if row['module'] in FILES and row['state'] == 'missing':
            continue
        raise RuntimeError('production_version_conflict:' + row['module'])
    parent = ROOT + '/noa-app/engine'
    if sftp.normalize(parent) != parent or not stat.S_ISDIR(sftp.lstat(parent).st_mode):
        raise RuntimeError('unsafe_engine_directory')
    installed = []
    for relative in FILES:
        target = ROOT + '/' + relative
        data = (Path('deploy') / relative).read_bytes()
        try:
            attrs = sftp.lstat(target)
        except FileNotFoundError:
            attrs = None
        if attrs is not None:
            if not stat.S_ISREG(attrs.st_mode):
                raise RuntimeError('nonregular_runtime_target')
            with sftp.open(target, 'rb') as source:
                if sha(source.read()) != sha(data):
                    raise RuntimeError('runtime_version_conflict')
            continue
        owned = False
        try:
            # The uploaded bytes are final, PHP-linted production source. There
            # is no alternate .tmp/.stage path on hosting and no live overwrite.
            with sftp.open(target, 'wx') as output:
                owned = True
                output.write(data)
            sftp.chmod(target, 0o644)
            with sftp.open(target, 'rb') as source:
                if sha(source.read()) != sha(data):
                    raise RuntimeError('runtime_readback_failed')
        except Exception:
            if owned:
                try:
                    with sftp.open(target, 'rb') as source:
                        partial = source.read()
                    if len(partial) <= len(data) and data.startswith(partial):
                        sftp.remove(target)
                except OSError:
                    pass
            raise
        installed.append(relative)
    verified = compare_sources(sftp)
    if not verified['allMatch']:
        raise RuntimeError('post_install_source_drift')
    return installed, verified['requiredCount']


def main():
    import paramiko
    required = ['NOA_SSH_HOST', 'NOA_SSH_USER', 'NOA_SSH_PASSWORD', 'NOA_SSH_HOST_FINGERPRINT']
    if any(not os.getenv(name) for name in required):
        raise RuntimeError('missing_noa_authentication')
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(
            transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if not hmac.compare_digest(fingerprint, os.environ['NOA_SSH_HOST_FINGERPRINT']):
            raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            sftp.get_channel().settimeout(30)
            key_path = '/hosting/noastudio/noa-ai-lab/worker.key'
            if not stat.S_ISREG(sftp.lstat(key_path).st_mode):
                raise RuntimeError('unsafe_noa_service_key')
            with sftp.open(key_path, 'rb') as source:
                key = source.read(256).strip()
            if len(key) != 64:
                raise RuntimeError('invalid_noa_service_key')
            installed, count = install_finished(sftp)
        finally:
            sftp.close()
    finally:
        transport.close()
    unauthorized_check()
    first, second = request_observation(key), request_observation(key)
    first_by_id = {row['eventId']: row for row in first['receipts']}
    for row in second['receipts']:
        if row['eventId'] in first_by_id and row != first_by_id[row['eventId']]:
            raise RuntimeError('unstable_observation_receipt')
    if first['observed'] < 1:
        raise RuntimeError('no_live_canary_evidence')
    proof = {'commit': os.environ['GITHUB_SHA'], 'runId': os.environ['GITHUB_RUN_ID'],
             'installedFiles': installed, 'verifiedRuntimeFiles': count,
             'unauthorizedRequestsRejected': True, 'repeatObservationVerified': True,
             'hostStagingFiles': 0, 'productionDatabaseWrites': 0,
             'liveObservation': second}
    output = Path(os.environ['RUNNER_TEMP']) / 'n80-live-observer-result.json'
    output.write_text(json.dumps(proof, indent=2) + '\n')
    summary = os.getenv('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as handle:
            handle.write('## N80 live observation\n\n')
            handle.write('Authenticated live jobs observed: ' + str(second['observed']) + '\n\n')
            handle.write('Mode: read-only; business ACK disabled; production DB writes: 0; host staging files: 0.\n')
    print('N80_LIVE_OBSERVER_VERIFIED', json.dumps(proof))


if __name__ == '__main__':
    main()
