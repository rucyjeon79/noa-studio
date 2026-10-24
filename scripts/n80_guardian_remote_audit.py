"""Read-only production verification. Reports are ephemeral runner outputs."""
import base64
import hashlib
import json
import os
import stat
from pathlib import Path


ROOT = '/hosting/noastudio/html'
# These libraries are isolated diagnostics, not production entrypoint dependencies.
DIAGNOSTIC_ONLY = {'bridge-flow.php', 'performance.php'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def source_inventory(base=Path('deploy')):
    engine = base / 'noa-app/engine'
    files = sorted(engine.glob('*.php'))
    if not files or not (engine / 'receipt-contract.php').is_file():
        raise RuntimeError('incomplete_engine_source')
    rows = [(p.relative_to(base).as_posix(), p.name not in DIAGNOSTIC_ONLY)
            for p in files]
    cli = base / 'noa-app/jukebox/cli.php'
    if not cli.is_file():
        raise RuntimeError('source_missing:noa-app/jukebox/cli.php')
    return rows + [('noa-app/jukebox/cli.php', True)]


def compare_sources(sftp, base=Path('deploy')):
    if sftp.normalize(ROOT) != ROOT:
        raise RuntimeError('root_mismatch')
    rows = []
    for relative, required in source_inventory(base):
        expected = digest((base / relative).read_bytes())
        actual = None
        try:
            remote = ROOT + '/' + relative
            attrs = sftp.lstat(remote)
            if not stat.S_ISREG(attrs.st_mode):
                state = 'nonregular'
            else:
                with sftp.open(remote, 'rb') as handle:
                    actual = digest(handle.read())
                state = 'match' if actual == expected else 'different'
        except FileNotFoundError:
            state = 'missing'
        rows.append({'module': relative, 'required': required, 'state': state,
                     'expectedSha256': expected, 'actualSha256': actual})
    # Missing diagnostic-only libraries are expected; deployed diagnostics must match.
    ok = all(row['state'] == 'match' or
             (not row['required'] and row['state'] == 'missing') for row in rows)
    return {'engine': 'N80 ENGINE', 'audit': 'remote_source_drift',
            'commit': os.getenv('GITHUB_SHA'), 'mode': 'read_only',
            'rows': rows, 'allMatch': ok,
            'requiredCount': sum(row['required'] for row in rows),
            'automaticDispatch': 'disabled_by_source_contract',
            'operationalReady': False,
            'runtimeExecutionVerified': False,
            'storagePolicy': {'backups': 'google_drive',
                              'workFiles': 'github_actions_runner',
                              'host': 'completed_runtime_only'},
            'hostWrites': 0}


def save_report(summary):
    # Never upload hosting contents or credentials; this report contains hashes only.
    runner = os.getenv('RUNNER_TEMP')
    if runner:
        (Path(runner) / 'n80-production-audit.json').write_text(
            json.dumps(summary, indent=2) + '\n')
    step_summary = os.getenv('GITHUB_STEP_SUMMARY')
    if step_summary:
        with open(step_summary, 'a') as out:
            out.write('## N80 production verification\n\n')
            out.write('| Check | Result |\n|---|---|\n')
            out.write('| Required deployed files | ' + str(summary['requiredCount']) + ' |\n')
            out.write('| Source integrity | ' + ('PASS' if summary['allMatch'] else 'FAIL') + ' |\n')
            out.write('| Host writes | 0 |\n')
            out.write('| Autonomous execution | Disabled; not verified |\n')
            for row in summary['rows']:
                if row['state'] != 'match':
                    out.write('| ' + row['module'] + ' | ' + row['state'] + ' |\n')


def main():
    import paramiko
    keys = ['NOA_SSH_HOST', 'NOA_SSH_USER', 'NOA_SSH_PASSWORD', 'NOA_SSH_HOST_FINGERPRINT']
    if any(not os.getenv(key) for key in keys):
        raise RuntimeError('missing_config')
    transport = paramiko.Transport((os.environ['NOA_SSH_HOST'], 2022))
    try:
        transport.get_security_options().key_types = ('ssh-ed25519',)
        transport.start_client(timeout=20)
        fingerprint = 'SHA256:' + base64.b64encode(hashlib.sha256(
            transport.get_remote_server_key().asbytes()).digest()).decode().rstrip('=')
        if fingerprint != os.environ['NOA_SSH_HOST_FINGERPRINT']:
            raise RuntimeError('host_key_mismatch')
        transport.auth_password(os.environ['NOA_SSH_USER'], os.environ['NOA_SSH_PASSWORD'])
        if not transport.is_authenticated():
            raise RuntimeError('authentication_failed')
        sftp = paramiko.SFTPClient.from_transport(transport)
        try:
            sftp.get_channel().settimeout(30)
            summary = compare_sources(sftp)
        finally:
            sftp.close()
    finally:
        transport.close()
    save_report(summary)
    print('N80_GUARDIAN_REMOTE_AUDIT', json.dumps(summary))
    if not summary['allMatch']:
        raise RuntimeError('production_drift_detected')


if __name__ == '__main__':
    main()
