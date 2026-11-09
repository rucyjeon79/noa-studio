"""Existing N80 Auto runner is a bounded browser peripheral, never the state owner."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import selectors
import shutil
import signal
import stat
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = '/hosting/noastudio/noa-ai-lab'
AAD = b'N80_BROWSER_PROFILE_v1'
LIMIT = 4 * 1024 * 1024


def connection_summary(state, now):
    """Operational evidence only: never emit the owner, lease, input, frame or profile."""
    row = state.get('browserControl') or {}
    allowed = {'queued', 'active', 'closing', 'closed', 'saved', 'failed'}
    phase = row.get('state') if row.get('state') in allowed else 'disconnected'
    if phase in {'queued', 'active', 'closing'} and row.get('expiresAt', 0) <= now:
        phase = 'expired'
    return {'state': phase, 'hasFrame': bool(row.get('frame')),
            'framesObserved': isinstance(row.get('frameSeq'), int) and row['frameSeq'] > 0,
            'leaseLive': row.get('leaseUntil', 0) > now,
            'profileStored': bool(state.get('browserProfile'))}


def observe_connection():
    import paramiko
    from noa_full_inventory import connect
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            data = read_private(sftp, PRIVATE + '/state.json', 16 * 1024 * 1024)
            return connection_summary(json.loads(data), int(time.time()))
    finally:
        transport.close()


def encode_profile(key, value):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    data = json.dumps(value, separators=(',', ':')).encode()
    if not isinstance(value, dict) or not isinstance(value.get('cookies'), list) or not isinstance(value.get('origins'), list) or len(data) > LIMIT - 28:
        raise ValueError('profile_shape')
    iv = secrets.token_bytes(12)
    return iv + AESGCM(hmac.digest(key, AAD, 'sha256')).encrypt(iv, data, AAD)


def decode_profile(key, data):
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    if not 28 <= len(data) <= LIMIT:
        raise ValueError('profile_size')
    value = json.loads(AESGCM(hmac.digest(key, AAD, 'sha256')).decrypt(data[:12], data[12:], AAD))
    if not isinstance(value, dict) or not isinstance(value.get('cookies'), list) or not isinstance(value.get('origins'), list):
        raise ValueError('profile_shape')
    return value


def read_private(sftp, path, limit=LIMIT):
    a = sftp.lstat(path)
    if not stat.S_ISREG(a.st_mode) or a.st_mode & 0o077 or a.st_size > limit or sftp.normalize(path) != path:
        raise ValueError('unsafe_private_file')
    with sftp.open(path, 'rb') as stream:
        data = stream.read(limit + 1)
    if len(data) != a.st_size or len(data) > limit:
        raise ValueError('private_file_changed')
    return data


def transfer_private(data=None, pointer=None, proof=False):
    import paramiko
    from noa_full_inventory import connect
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            if pointer is not None:
                sha, size = pointer.get('sha256', ''), pointer.get('bytes')
                if not re.fullmatch('[a-f0-9]{64}', sha) or type(size) is not int or not 28 <= size <= LIMIT:
                    raise ValueError('profile_pointer')
                data = read_private(sftp, PRIVATE + '/browser-profile-' + sha + '.enc')
                if len(data) != size or hashlib.sha256(data).hexdigest() != sha:
                    raise ValueError('profile_checksum')
                return data
            if not data or len(data) > LIMIT:
                raise ValueError('private_file_size')
            sha = hashlib.sha256(data).hexdigest()
            path = PRIVATE + ('/host-runtime/browser-relay-proof-' if proof else '/browser-profile-') + sha + ('.json' if proof else '.enc')
            staging = path + '.' + secrets.token_hex(8) + '.upload'
            try:
                with sftp.open(staging, 'wx') as stream:
                    stream.write(data)
                sftp.chmod(staging, 0o600)
                if read_private(sftp, staging) != data:
                    raise ValueError('private_readback')
                try:
                    existing = read_private(sftp, path)
                except FileNotFoundError:
                    sftp.rename(staging, path)
                    existing = read_private(sftp, path)
                if existing != data:
                    raise ValueError('private_readback')
            finally:
                try:
                    sftp.remove(staging)
                except FileNotFoundError:
                    pass
            return {'sha256': sha, 'bytes': len(data)}
    finally:
        transport.close()


def child_env(directory):
    # Browser and npm receive no SSH, GitHub or N80 credentials.
    env = {k: os.environ[k] for k in ('PATH', 'LANG', 'LC_ALL', 'HOME') if k in os.environ}
    env['N80_BROWSER_PACKAGE'] = str(directory)
    env['TMPDIR'] = str(directory)
    return env


def browser_ready(directory):
    if not shutil.which('google-chrome') or not shutil.which('xvfb-run'):
        raise RuntimeError('runner_browser_dependency_missing')
    subprocess.run(['npm', 'install', '--prefix', str(directory), '--ignore-scripts', '--no-save', '--package-lock=false', 'playwright@1.62.0'],
                   check=True, timeout=120, env=child_env(directory), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def run_browser(directory, initial, exchange=None, store=None):
    process = subprocess.Popen(['xvfb-run', '-a', 'node', str(ROOT / 'runtime/browser/relay.mjs')],
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               env=child_env(directory), start_new_session=True)
    deadline = time.monotonic() + (150 if initial['mode'] == 'probe' else 940)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    buffer = b''
    result = None
    try:
        process.stdin.write(json.dumps(initial).encode() + b'\n')
        process.stdin.flush()
        while time.monotonic() < deadline:
            if not selector.select(50):
                raise RuntimeError('browser_response_timeout')
            chunk = os.read(process.stdout.fileno(), 65536)
            if not chunk:
                break
            buffer += chunk
            if len(buffer) > 6_000_000:
                raise RuntimeError('browser_message_limit')
            while b'\n' in buffer:
                line, buffer = buffer.split(b'\n', 1)
                message = json.loads(line)
                kind = message.get('type')
                if kind == 'exchange' and exchange:
                    reply = exchange({'command': 'exchange', 'ack': message['ack'], 'frame': message['frame']})
                    process.stdin.write(json.dumps(reply).encode() + b'\n')
                    process.stdin.flush()
                elif kind == 'profile' and store:
                    result = store(message['storageState'])
                elif kind in ('proof', 'closed'):
                    result = message
                else:
                    raise RuntimeError('browser_connection_failed')
        if result is None:
            raise RuntimeError('browser_result_missing')
        if process.wait(timeout=20) != 0:
            raise RuntimeError('browser_exit_failed')
        return result
    finally:
        selector.close()
        # Kill the process group even after the wrapper exits; no orphan browser.
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait(timeout=10)
        process.stdin.close()
        process.stdout.close()


def main(probe=False):
    from n80_auto import plan
    plan('ai.browser_probe' if probe else 'ai.browser_session', os.environ)
    from noa_n80_ai_worker import worker_key, signed_tick
    key = worker_key()
    session = None
    if not probe:
        session = signed_tick(key, 'n80_browser_tick', b'{"command":"claim"}')
        if not session.get('claimed'):
            print('N80_BROWSER_IDLE')
            return
    frame_logged = False
    def exchange(body):
        nonlocal frame_logged
        payload = {**body, 'id': session['id'], 'lease': session['lease']}
        result = signed_tick(key, 'n80_browser_tick', json.dumps(payload, separators=(',', ':')).encode(), timeout=40)
        if body.get('frame') and not frame_logged and not result.get('stop'):
            frame_logged = True
            print('N80_BROWSER_FIRST_FRAME_ACCEPTED', json.dumps({'host': urlparse(body['frame']['url']).hostname}), flush=True)
        return result
    def store(value):
        pointer = transfer_private(data=encode_profile(key, value))
        return exchange({'command': 'finish', 'profile': pointer})
    try:
        with tempfile.TemporaryDirectory(prefix='n80-browser-') as tmp:
            directory = Path(tmp)
            browser_ready(directory)
            initial = {'mode': 'probe' if probe else 'connect'}
            if session:
                initial['expiresAt'] = session['expiresAt']
                if session.get('profile'):
                    initial['storageState'] = decode_profile(key, transfer_private(pointer=session['profile']))
            result = run_browser(directory, initial, exchange if session else None, store if session else None)
        if probe:
            result.update(authority='N80 Engine', operation='ai.browser_probe', sourceCommit=os.environ['GITHUB_SHA'],
                          runId=os.environ['GITHUB_RUN_ID'], stateOwner='existing_noa_host', renderer='host_ffmpeg')
            result['connectionObservation'] = observe_connection()
            receipt = transfer_private(data=json.dumps(result, sort_keys=True).encode(), proof=True)
            print('N80_BROWSER_PROOF', json.dumps({**result, 'hostReceipt': receipt}))
            if not all(result['providers'][p]['reachable'] for p in ('gemini', 'flow')):
                raise RuntimeError('provider_page_unreachable')
        else:
            print('N80_BROWSER_CONNECTION', json.dumps({'state': result.get('state', 'closed'), 'productionReady': False}))
    except Exception:
        # Child termination above is confirmed before reporting failure; no retry/reclaim.
        if session:
            try:
                exchange({'command': 'fail'})
            except Exception:
                pass
        raise RuntimeError('n80_browser_connection_failed') from None


if __name__ == '__main__':
    main('--probe' in sys.argv)
