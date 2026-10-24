"""Pinned SFTP + temporary HMAC control for bounded backup migration evidence."""
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
import paramiko
from noa_jukebox_recovery import signed_service

ROOT = '/hosting/noastudio/html'
REMOTE = ROOT + '/noa-bridge/backup-migration-20261024.php'
URL = 'https://noastudio.ai.kr/noa-bridge/backup-migration-20261024.php'


def main():
    code = Path('scripts/noa_backup_migration_control.php').read_bytes()
    expected = hashlib.sha256(code).hexdigest()
    t = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    installed = False
    s = None
    try:
        t.get_security_options().key_types = ('ssh-ed25519',)
        t.start_client(timeout=30)
        fp = 'SHA256:' + base64.b64encode(hashlib.sha256(t.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fp != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        t.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        s = paramiko.SFTPClient.from_transport(t)
        s.get_channel().settimeout(60)
        if s.normalize(ROOT) != ROOT:
            raise RuntimeError('unexpected_root')
        with s.open('/hosting/noastudio/noa-ai-lab/worker.key', 'rb') as f:
            key = f.read(256).decode().strip()
        if len(key) != 64:
            raise RuntimeError('invalid_private_service_key')
        try:
            attr = s.lstat(REMOTE)
        except FileNotFoundError:
            attr = None
        if attr:
            if not stat.S_ISREG(attr.st_mode):
                raise RuntimeError('unknown_helper_preserved')
            with s.open(REMOTE, 'rb') as f:
                if hashlib.sha256(f.read()).hexdigest() != expected:
                    raise RuntimeError('unknown_helper_preserved')
        else:
            with s.open(REMOTE, 'wx') as f:
                f.write(code)
            s.chmod(REMOTE, 0o644)
        installed = True
        with s.open(REMOTE, 'rb') as f:
            if hashlib.sha256(f.read()).hexdigest() != expected:
                raise RuntimeError('helper_upload_mismatch')
        cli = signed_service(key)
        before = {}
        for action in ['integrity_snapshot', 'queue_snapshot', 'audit']:
            try:
                result = cli(action)
                if action == 'queue_snapshot':
                    rows = result.get('rows', [])
                    result = {'row_count': len(rows), 'states': {state: sum(r.get('status') == state for r in rows) for state in sorted({str(r.get('status')) for r in rows})}}
                if action == 'audit':result={k:result.get(k) for k in ['assets','covers','audio','audio_bytes','qa_assets','temporary_inputs']}
                before[action] = result
            except Exception:
                before[action] = {'unavailable': True}
        mode = os.environ.get('NOA_BACKUP_MIGRATION_MODE', 'inspect')
        payload = {'mode': mode}
        if mode == 'cleanup':
            payload['receipts'] = json.loads(Path('scripts/noa_backup_cleanup_receipts.json').read_text())['receipts']
        body = json.dumps(payload, separators=(',', ':')).encode()
        ts, nonce = str(int(time.time())), secrets.token_hex(16)
        message = 'NOA-BACKUP-MIGRATION-1\n' + ts + '\n' + nonce + '\n' + hashlib.sha256(body).hexdigest()
        req = urllib.request.Request(URL, data=body, method='POST', headers={
            'Content-Type': 'application/json', 'X-NOA-Timestamp': ts,
            'X-NOA-Nonce': nonce,
            'X-NOA-Signature': hmac.new(key.encode(), message.encode(), hashlib.sha256).hexdigest(),
        })
        try:
            with urllib.request.urlopen(req, timeout=180) as response:
                report = json.load(response)
        except urllib.error.HTTPError as error:
            raw = error.read(1048576)
            try:
                reason = json.loads(raw).get('error', 'invalid_control_response')
            except Exception:
                reason = 'invalid_control_response'
            raise RuntimeError('migration_control_blocked:' + reason) from None
        if not report.get('ok'):
            raise RuntimeError('migration_control_unsuccessful')
        after = {}
        for action in ['integrity_snapshot', 'audit']:
            try:
                result=cli(action)
                if action == 'audit':result={k:result.get(k) for k in ['assets','covers','audio','audio_bytes','qa_assets','temporary_inputs']}
                after[action] = result
            except Exception:
                after[action] = {'unavailable': True}
        report['jukebox_before'] = before
        report['jukebox_after'] = after
        proof = Path('backup-migration-proof')
        proof.mkdir(exist_ok=True)
        (proof / (mode + '.json')).write_text(json.dumps(report, indent=2))
        print('NOA_BACKUP_MIGRATION_RESULT ' + json.dumps(report), flush=True)
    finally:
        if installed and s:
            with s.open(REMOTE, 'rb') as f:
                current = hashlib.sha256(f.read()).hexdigest()
            if current != expected:
                raise RuntimeError('helper_concurrent_change_preserved')
            s.remove(REMOTE)
            print('TEMPORARY_MIGRATION_HELPER_REMOVED', flush=True)
        t.close()


if __name__ == '__main__':
    main()
