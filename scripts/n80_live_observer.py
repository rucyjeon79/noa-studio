"""Keep existing signed observation; opt in only to the exact MUSIC verifier.
No backup, staging, schema mutation, general dispatch or FIFO claim.
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
MUSIC_URL = 'https://noastudio.ai.kr/noa-app/engine/consume-music.php'
MUSIC_BASE = '/hosting/noastudio/noa-ai-lab/n80-music-consumer'
MUSIC_POLICY = '/hosting/noastudio/noa-ai-lab/n80-music-consumer-policy.json'
MUSIC_EFFECT = 'music_catalog_availability_verified'
MUSIC_PHASES = {'bootstrap','load_runtime','policy','db_config','db_connect','db_readonly','consumer','ready_identity',
                'local_media','public_catalog','public_detail','public_audio','public_readmodel','final_source','unknown'}
MUSIC_REASONS = {'verified','verification_error','unsupported_public_read','public_read_failed','public_url_access_disabled',
                 'public_http_non_success','public_read_too_large','public_tls_failed','public_read_timeout','public_network_failed',
                 'invalid_job_id','source_not_ready','superseded_job','missing_commit_timestamp','job_upload_identity_mismatch',
                 'public_catalog_missing','ready_audio_integrity_failed','public_audio_reference_mismatch','public_route_failed',
                 'public_readmodel_invalid','public_asset_reference_mismatch','public_detail_mismatch','public_audio_bytes_mismatch',
                 'source_changed_during_verification','event_changed'}


def sha(data):
    return hashlib.sha256(data).hexdigest()


def compact(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def music_http_error(error, key, nonce):
    """Log fixed enums only. Never include response bodies, URLs or headers."""
    code, detail, authenticated = 'http_error', {}, False
    try:
        raw = error.read(4097)
        if len(raw) <= 4096:
            body = json.loads(raw)
            signature = error.headers.get('X-N80-Signature', '')
            expected = hmac.new(key, ('N80-MUSIC-CONSUME-RESPONSE-1\n' + nonce + '\n' + sha(raw)).encode(), hashlib.sha256).hexdigest()
            authenticated = bool(signature) and hmac.compare_digest(signature, expected) and body.get('nonce') == nonce
            allowed = {'authentication_required','invalid_request','music_consumer_disabled','observer_disabled','music_consumer_unavailable',
                       'music_availability_not_verified','unsafe_private_store','source_not_ready','superseded_job','lease_active',
                       'terminal','retry_exhausted','id_conflict','stale_lease_generation','lease_expired','ack_readback_failed'}
            if body.get('error') in allowed: code = body['error']
            if authenticated:
                candidate = body.get('diagnostic', {})
                if candidate.get('phase') in MUSIC_PHASES: detail['phase'] = candidate['phase']
                if candidate.get('reason') in MUSIC_REASONS: detail['reason'] = candidate['reason']
                if candidate.get('exceptionClass') in {'PDOException','RuntimeException','TypeError','Error','JsonException','other'}: detail['exceptionClass'] = candidate['exceptionClass']
                if type(candidate.get('httpStatus')) is int and 0 <= candidate['httpStatus'] <= 599: detail['httpStatus'] = candidate['httpStatus']
                import re
                if isinstance(candidate.get('sqlState'), str) and re.fullmatch('[A-Z0-9]{5}', candidate['sqlState']): detail['sqlState'] = candidate['sqlState']
    except (ValueError, UnicodeError, AttributeError):
        pass
    return RuntimeError('music_consumer_http_error:' + json.dumps({'status': int(error.code), 'error': code,
                        'authenticated': authenticated, **detail}, separators=(',', ':')))


def private_read(sftp, path, maximum):
    info = sftp.lstat(path)
    if (sftp.normalize(path) != path or not stat.S_ISREG(info.st_mode)
            or stat.S_IMODE(info.st_mode) != 0o600 or not 0 < info.st_size <= maximum):
        raise RuntimeError('unsafe_music_private_file')
    with sftp.open(path, 'rb') as source:
        data = source.read(maximum + 1)
    if len(data) != info.st_size or len(data) > maximum:
        raise RuntimeError('music_private_file_size_changed')
    return data


def music_consumer_policy(sftp):
    try:
        raw = private_read(sftp, MUSIC_POLICY, 1024)
    except FileNotFoundError:
        return {'enabled': False, 'reason': 'policy_missing'}
    except (OSError, RuntimeError):
        return {'enabled': False, 'reason': 'policy_invalid'}
    try:
        policy = json.loads(raw)
    except (ValueError, UnicodeError):
        return {'enabled': False, 'reason': 'policy_invalid'}
    expected = {'version': 1, 'enabled': True, 'exactConsumer': MUSIC_EFFECT}
    if (policy != expected or type(policy.get('version')) is not int
            or policy.get('enabled') is not True):
        return {'enabled': False, 'reason': 'policy_not_enabled'}
    return {'enabled': True, 'policySha256': sha(raw)}


def request_music_consumer(key, observed):
    if (type(observed.get('jobId')) is not int or observed['jobId'] < 1
            or observed.get('effect') != 'catalog_observation_only'
            or observed.get('ackEligible') is not False
            or not isinstance(observed.get('eventId'), str)
            or observed.get('correlationId') != observed['eventId']):
        raise RuntimeError('untrusted_observed_music_job')
    raw = compact({'action': 'verify_availability', 'jobId': observed['jobId']})
    timestamp, nonce = str(int(time.time())), secrets.token_hex(16)
    signature = hmac.new(key, ('N80-MUSIC-CONSUME-1\n' + sha(raw) + '\n' + timestamp + '\n' + nonce).encode(), hashlib.sha256).hexdigest()
    request = urllib.request.Request(MUSIC_URL, data=raw, headers={
        'Content-Type': 'application/json', 'X-N80-Timestamp': timestamp,
        'X-N80-Nonce': nonce, 'X-N80-Signature': signature}, method='POST')
    try:
        with urllib.request.build_opener(NoRedirect()).open(request, timeout=125) as response:
            body = response.read(65537)
            signature = response.headers.get('X-N80-Signature', '')
            content_type = response.headers.get('Content-Type', '')
            status = response.status
    except urllib.error.HTTPError as error:
        raise music_http_error(error, key, nonce) from None
    except (OSError, TimeoutError):
        raise RuntimeError('music_consumer_transport_failed') from None
    if status != 200 or len(body) > 65536 or 'application/json' not in content_type:
        raise RuntimeError('music_consumer_response_invalid')
    expected = hmac.new(key, ('N80-MUSIC-CONSUME-RESPONSE-1\n' + nonce + '\n' + sha(body)).encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise RuntimeError('music_consumer_response_authentication_failed')
    response = json.loads(body)
    if response.get('ok') is not True or response.get('nonce') != nonce:
        raise RuntimeError('music_consumer_response_binding_failed')
    result = response.get('result', {})
    receipt, proof = result.get('receipt', {}), result.get('receipt', {}).get('proof', {})
    if (result.get('ok') is not True or result.get('status') not in ('acknowledged', 'already_acknowledged')
            or type(result.get('replayed')) is not bool
            or result['replayed'] != (result['status'] == 'already_acknowledged')
            or receipt.get('eventId') != observed['eventId'] or receipt.get('correlationId') != observed['correlationId']
            or receipt.get('consumer') != 'music' or receipt.get('effect') != MUSIC_EFFECT
            or type(receipt.get('generation')) is not int or receipt['generation'] < 1
            or proof.get('effect') != MUSIC_EFFECT or type(proof.get('jobId')) is not int or proof['jobId'] != observed['jobId']
            or type(proof.get('assetBytes')) is not int or proof['assetBytes'] < 1
            or proof.get('mutation') is not False or proof.get('businessDispatch') is not False
            or any(proof.get(flag) is not True for flag in
                   ('catalogReferenceVerified', 'publicDetailVerified', 'mediaIntegrityVerified'))):
        raise RuntimeError('music_consumer_receipt_contract_failed')
    import re
    if any(not isinstance(value, str) or not re.fullmatch('[a-f0-9]{64}', value) for value in
           [receipt.get('eventSha256'), proof.get('assetSha256'), proof.get('detailSha256'), proof.get('streamPrefixSha256')]):
        raise RuntimeError('music_consumer_digest_invalid')
    return result


def request_music_diagnostic(key, observed):
    if (type(observed.get('jobId')) is not int or observed['jobId'] < 1
            or observed.get('effect') != 'catalog_observation_only' or observed.get('ackEligible') is not False
            or not isinstance(observed.get('eventId'), str) or observed.get('correlationId') != observed['eventId']):
        raise RuntimeError('untrusted_observed_music_job')
    raw = compact({'action': 'diagnose_availability', 'jobId': observed['jobId']})
    timestamp, nonce = str(int(time.time())), secrets.token_hex(16)
    signature = hmac.new(key, ('N80-MUSIC-CONSUME-1\n' + sha(raw) + '\n' + timestamp + '\n' + nonce).encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(MUSIC_URL, data=raw, headers={'Content-Type': 'application/json',
        'X-N80-Timestamp': timestamp, 'X-N80-Nonce': nonce, 'X-N80-Signature': signature}, method='POST')
    try:
        with urllib.request.build_opener(NoRedirect()).open(req, timeout=125) as response:
            body = response.read(65537); actual = response.headers.get('X-N80-Signature', '')
            content_type = response.headers.get('Content-Type', ''); status = response.status
    except urllib.error.HTTPError as error:
        raise music_http_error(error, key, nonce) from None
    except (OSError, TimeoutError):
        raise RuntimeError('music_diagnostic_transport_failed') from None
    expected = hmac.new(key, ('N80-MUSIC-CONSUME-RESPONSE-1\n' + nonce + '\n' + sha(body)).encode(), hashlib.sha256).hexdigest()
    if status != 200 or len(body) > 65536 or 'application/json' not in content_type or not hmac.compare_digest(actual, expected):
        raise RuntimeError('music_diagnostic_response_authentication_failed')
    result = json.loads(body)
    if result.get('ok') is not True or result.get('nonce') != nonce: raise RuntimeError('music_diagnostic_binding_failed')
    out = result.get('result', {})
    if (out.get('ok') is not True or out.get('effect') != 'music_availability_diagnostic_only'
            or type(out.get('jobId')) is not int or out['jobId'] != observed['jobId']
            or type(out.get('available')) is not bool or type(out.get('urlFopenEnabled')) is not bool
            or out.get('reason') not in MUSIC_REASONS or out.get('phase') not in MUSIC_PHASES
            or out['available'] != (out['reason'] == 'verified')
            or type(out.get('httpStatus')) is not int or not 0 <= out['httpStatus'] <= 599
            or any(out.get(k) is not False for k in ('businessAck','automaticDispatch','queueMutation'))
            or type(out.get('databaseWrites')) is not int or out['databaseWrites'] != 0):
        raise RuntimeError('music_diagnostic_scope_failed')
    safe = {k: out[k] for k in ('ok','effect','jobId','available','urlFopenEnabled','reason','phase','httpStatus',
                                'businessAck','automaticDispatch','queueMutation','databaseWrites')}
    if out.get('exceptionClass') in {'PDOException','RuntimeException','TypeError','Error','other'}: safe['exceptionClass'] = out['exceptionClass']
    import re
    if isinstance(out.get('sqlState'), str) and re.fullmatch('[A-Z0-9]{5}', out['sqlState']): safe['sqlState'] = out['sqlState']
    return safe


def music_consumer_readback(sftp, result, observed):
    receipt = result['receipt']
    event_record = json.loads(private_read(sftp, MUSIC_BASE + '/events/' + sha(observed['eventId'].encode()) + '.json', 65536))
    event = event_record.get('event', {})
    if (event.get('id') != observed['eventId'] or event.get('correlationId') != observed['correlationId']
            or event.get('type') != 'audio.ready' or event.get('source') != 'jukebox'
            or event.get('subjectId') != receipt['proof'].get('subjectId')
            or type(event.get('schemaVersion')) is not int or event['schemaVersion'] != 1 or sha(compact(event)) != receipt['eventSha256']):
        raise RuntimeError('music_consumer_event_source_mismatch')
    state_path = MUSIC_BASE + '/leases/' + sha((observed['eventId'] + '|music').encode()) + '.json'
    state_raw = private_read(sftp, state_path, 65536)
    state = json.loads(state_raw)
    if (state.get('eventId') != observed['eventId'] or state.get('consumer') != 'music'
            or state.get('status') != 'succeeded' or state.get('generation') != receipt['generation']
            or state.get('leaseUntil') is not None or state.get('receipt') != receipt):
        raise RuntimeError('music_consumer_durable_ack_mismatch')
    return sha(state_raw)


def run_music_consumer(sftp, key, observation, policy):
    if os.getenv('N80_MUSIC_CONSUMER_DIAGNOSE_ONLY') == '1':
        rows = observation.get('receipts', [])
        if not isinstance(rows, list) or not 0 < len(rows) <= 25: raise RuntimeError('music_consumer_sample_invalid')
        diagnostic = request_music_diagnostic(key, rows[0])
        return {'enabled': False, 'status': 'diagnostic_only', 'acknowledged': 0,
                'businessAck': False, 'queueMutation': False, 'automaticDispatch': False,
                'productionDatabaseWrites': 0, 'diagnostics': [diagnostic]}
    if policy.get('enabled') is not True:
        return {'enabled': False, 'status': 'disabled', 'reason': policy['reason'], 'acknowledged': 0}
    # Recheck the fixed policy after observation, before any consumer call.
    current = music_consumer_policy(sftp)
    if current != policy:
        raise RuntimeError('music_consumer_policy_changed')
    rows = observation.get('receipts', [])
    if not isinstance(rows, list) or not 0 < len(rows) <= 25:
        raise RuntimeError('music_consumer_sample_invalid')
    limit_value = os.getenv('N80_MUSIC_CONSUMER_LIMIT', '25')
    if not limit_value.isdecimal() or not 1 <= int(limit_value) <= 25:
        raise RuntimeError('music_consumer_limit_invalid')
    limit = int(limit_value)
    evidence = []
    seen = set()
    for row in rows[:limit]:
        if music_consumer_policy(sftp) != policy:
            raise RuntimeError('music_consumer_policy_changed')
        if row.get('jobId') in seen:
            raise RuntimeError('duplicate_music_job')
        seen.add(row.get('jobId'))
        first = request_music_consumer(key, row)
        before = music_consumer_readback(sftp, first, row)
        second = request_music_consumer(key, row)
        after = music_consumer_readback(sftp, second, row)
        if second['status'] != 'already_acknowledged' or second['receipt'] != first['receipt'] or before != after:
            raise RuntimeError('music_consumer_replay_changed_state')
        evidence.append({'jobId': row['jobId'], 'eventId': row['eventId'], 'effect': MUSIC_EFFECT,
                         'receipt': second['receipt'], 'readbackVerified': True,
                         'replayVerified': True, 'durableStateSha256': after})
    return {'enabled': True, 'status': 'verified', 'effect': MUSIC_EFFECT, 'acknowledged': len(evidence),
            'observedJobs': len(rows), 'consumerLimit': limit,
            'automaticDispatch': False, 'queueMutation': False, 'productionDatabaseWrites': 0,
            'policySha256': policy['policySha256'], 'receipts': evidence}


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
        transport.set_keepalive(15)
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
            policy = music_consumer_policy(sftp)
            unauthorized_check()
            first, second = request_observation(key), request_observation(key)
            first_by_id = {row['eventId']: row for row in first['receipts']}
            for row in second['receipts']:
                if row['eventId'] in first_by_id and row != first_by_id[row['eventId']]:
                    raise RuntimeError('unstable_observation_receipt')
            if first['observed'] < 1:
                raise RuntimeError('no_live_canary_evidence')
            consumer = run_music_consumer(sftp, key, second, policy)
        finally:
            sftp.close()
    finally:
        transport.close()
    proof = {'commit': os.environ['GITHUB_SHA'], 'runId': os.environ['GITHUB_RUN_ID'],
             'installedFiles': installed, 'verifiedRuntimeFiles': count,
             'unauthorizedRequestsRejected': True, 'repeatObservationVerified': True,
             'hostStagingFiles': 0, 'productionDatabaseWrites': 0,
             'liveObservation': second, 'musicAvailabilityConsumer': consumer}
    output = Path(os.environ['RUNNER_TEMP']) / 'n80-live-observer-result.json'
    output.write_text(json.dumps(proof, indent=2) + '\n')
    summary = os.getenv('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a') as handle:
            handle.write('## N80 live observation\n\n')
            handle.write('Authenticated live jobs observed: ' + str(second['observed']) + '\n\n')
            handle.write('Observation stays read-only; general dispatch disabled; production DB writes: 0; host staging files: 0.\n')
            handle.write('Exact MUSIC availability consumer: ' + consumer['status'] + '; acknowledgements: ' + str(consumer['acknowledged']) + '. General dispatch remains disabled.\n')
    print('N80_LIVE_OBSERVER_VERIFIED', json.dumps(proof))


if __name__ == '__main__':
    main()
