"""Busan account ONLY. No remote writes, command execution, or SQL access."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import socket
import stat

HOST = '112.175.184.79'
USER = 'rucyjeon79'
PORT = 2022
ROOT = '/hosting/rucyjeon79/html'


class CheckError(Exception):
    pass


def configuration(env):
    required = ('BUSAN_SSH_HOST', 'BUSAN_SSH_USER',
                'BUSAN_SSH_PASSWORD', 'BUSAN_SSH_HOST_FINGERPRINT')
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise CheckError('missing_configuration:' + ','.join(missing))
    if env['BUSAN_SSH_HOST'] != HOST or env['BUSAN_SSH_USER'] != USER:
        raise CheckError('busan_target_mismatch')
    fp = env['BUSAN_SSH_HOST_FINGERPRINT']
    if not re.fullmatch(r'SHA256:[A-Za-z0-9+/]{43}', fp):
        raise CheckError('invalid_fingerprint_format')
    return HOST, USER, env['BUSAN_SSH_PASSWORD'], fp


def fingerprint(key):
    return 'SHA256:' + base64.b64encode(hashlib.sha256(key.asbytes()).digest()).decode().rstrip('=')


def perform(env, paramiko, create_connection=socket.create_connection):
    host, user, password, trusted = configuration(env)
    report = {'status': 'pending', 'target': 'busan', 'host': host,
              'port': PORT, 'expected_root': ROOT, 'connected': False,
              'host_key_verified': False, 'authenticated': False,
              'root_verified': False, 'file_list_verified': False,
              'remote_files_modified': 0, 'sql_accessed': False}
    sock = transport = sftp = None
    stage = 'tcp_connect'
    try:
        sock = create_connection((host, PORT), timeout=15)
        report['connected'] = True
        stage = 'host_key'
        transport = paramiko.Transport(sock)
        transport.banner_timeout = 15
        transport.auth_timeout = 15
        transport.use_compression(True)
        # Match the reference algorithm; never copy NOA's host fingerprint.
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        actual = fingerprint(transport.get_remote_server_key())
        if not hmac.compare_digest(actual, trusted):
            raise CheckError('host_key_mismatch')
        report['host_key_verified'] = True
        report['host_key_fingerprint'] = actual
        stage = 'authentication'
        transport.auth_password(user, password, fallback=False)
        if not transport.is_authenticated():
            raise CheckError('authentication_incomplete')
        report['authenticated'] = True
        stage = 'root_check'
        sftp = paramiko.SFTPClient.from_transport(transport)
        sftp.get_channel().settimeout(20)
        actual_root = sftp.normalize(ROOT)
        report['actual_root'] = actual_root
        if actual_root != ROOT:
            raise CheckError('unexpected_root')
        if not stat.S_ISDIR(sftp.lstat(ROOT).st_mode):
            raise CheckError('root_not_directory')
        report['root_verified'] = True
        stage = 'file_listing'
        # Only one directory. No parent traversal, file content, or downloads.
        entries = sftp.listdir_attr(ROOT)
        report['entry_count'] = len(entries)
        report['files'] = sorted([
            {'name': e.filename, 'kind': 'directory' if stat.S_ISDIR(e.st_mode)
             else 'file' if stat.S_ISREG(e.st_mode) else 'other'}
            for e in entries if not e.filename.startswith('.')
        ], key=lambda row: row['name'])
        report['file_list_verified'] = True
        report['status'] = 'passed'
    except Exception as exc:
        report['status'] = 'failed'
        report['failed_stage'] = stage
        # Arbitrary library exception strings can include credentials or server text.
        report['error'] = str(exc) if isinstance(exc, CheckError) else type(exc).__name__
    finally:
        for resource in (sftp, transport, sock):
            if resource is not None:
                try:
                    resource.close()
                except Exception:
                    pass
    return report


def main():
    try:
        configuration(os.environ)  # Stop before any network access if secrets are missing.
        import paramiko
        report = perform(os.environ, paramiko)
    except CheckError as exc:
        report = {'status': 'blocked', 'error': str(exc), 'remote_files_modified': 0,
                  'sql_accessed': False, 'connected': False}
    except ImportError:
        report = {'status': 'blocked', 'error': 'paramiko_not_installed',
                  'remote_files_modified': 0, 'sql_accessed': False, 'connected': False}
    output = Path('busan-check-result')
    output.mkdir(exist_ok=True)
    (output/'result.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'files'}, ensure_ascii=False))
    return 0 if report['status'] == 'passed' else 1


if __name__ == '__main__':
    raise SystemExit(main())
