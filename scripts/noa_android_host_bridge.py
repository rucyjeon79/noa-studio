"""N80 JukeBox's bounded Android bridge check on the existing hosting account.

Uses the already verified private Node runtime; never installs Node, npm, Java,
an Android SDK, a scheduler, or a public service on the production host.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import stat
import sys
import time
import zipfile

REPO = Path(__file__).resolve().parents[1]
RUNTIME = '/hosting/noastudio/noa-ai-lab/host-runtime'
NODE_SHA = '904a6d3484241d466989f9df9ba3aab822b1496191bdb28230eb491a55c32a52'
BRIDGE = 'android/app/src/main/assets/noa-native-bridge.js'
PROOF = 'android/host-node-proof.json'
TESTS = ('tests/android/native_bridge_test.mjs', 'tests/android/live_web_contract_test.mjs')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def inputs(root=REPO):
    names = [BRIDGE, *TESTS, 'android/app/build.gradle', '.github/workflows/noa-android.yml']
    # Include the entire native package: absence checks must see real source files.
    names += [p.relative_to(root).as_posix() for p in sorted(
        (root / 'android/app/src/main/java/kr/ai/noastudio').glob('*.java'))]
    result = {}
    for name in names:
        path = root / name
        if path.is_symlink() or not path.is_file():
            raise ValueError('invalid_android_source')
        result[name] = path.read_bytes()
    if not 0 < sum(map(len, result.values())) <= 1_000_000:
        raise ValueError('android_source_limit')
    return result


def parse_tests(output, exit_code):
    text = output.decode('utf-8', errors='replace')
    counts = {}
    for key in ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'):
        matches = re.findall(r'^# ' + key + r' (\d+)\s*$', text, re.M)
        if len(matches) != 1:
            return {'passed': False, 'state': 'host_node_test_result_invalid'}
        counts[key] = int(matches[0])
    passed = (exit_code == 0 and counts['tests'] >= 16 and counts['pass'] == counts['tests']
              and all(counts[k] == 0 for k in ('fail', 'cancelled', 'skipped', 'todo')))
    return {'passed': passed, 'state': 'host_node_tests_passed' if passed else 'host_node_tests_failed',
            'tests': counts, 'exitCode': exit_code}


def validate_proof(proof, source_commit, bridge, source_inputs=None):
    if (not isinstance(proof, dict) or proof.get('schemaVersion') != 1
            or proof.get('authority') != 'N80 Engine' or proof.get('module') != 'jukebox'
            or proof.get('operation') != 'jukebox.android_bridge'
            or proof.get('executionTarget') != 'existing_noa_host'
            or proof.get('sourceCommit') != source_commit
            or not re.fullmatch(r'[a-f0-9]{40}', source_commit or '')
            or proof.get('passed') is not True or proof.get('bridgeSha256') != digest(bridge)
            or proof.get('nodeSha256') != NODE_SHA
            or not re.fullmatch(r'v24\.\d+\.\d+', proof.get('nodeVersion', ''))):
        raise ValueError('invalid_host_node_proof')
    counts = proof.get('tests', {})
    total = counts.get('tests', 0)
    if (not isinstance(total, int) or total < 16 or counts.get('pass') != total
            or any(counts.get(k) != 0 for k in ('fail', 'cancelled', 'skipped', 'todo'))):
        raise ValueError('incomplete_host_node_tests')
    if source_inputs is not None and proof.get('inputs') != {p: digest(b) for p, b in source_inputs.items()}:
        raise ValueError('host_node_source_changed')


def verify_apk(apk, proof, source_commit):
    with zipfile.ZipFile(apk) as archive:
        for name in ('assets/noa-native-bridge.js', 'assets/n80-android-bridge.json'):
            if archive.namelist().count(name) != 1:
                raise ValueError('missing_or_duplicate_host_node_asset')
        bridge = archive.read('assets/noa-native-bridge.js')
        embedded = json.loads(archive.read('assets/n80-android-bridge.json'))
    validate_proof(proof, source_commit, bridge)
    if embedded != proof:
        raise ValueError('apk_host_node_proof_mismatch')


def check_host():
    from noa_full_inventory import connect
    from noa_host_media_runtime import execute, node_result
    import paramiko
    source_commit = os.environ['GITHUB_SHA']
    run_id = os.environ['GITHUB_RUN_ID']
    if not re.fullmatch(r'[a-f0-9]{40}', source_commit) or not re.fullmatch(r'[1-9][0-9]*', run_id):
        raise ValueError('invalid_android_check_identity')
    payload = inputs()
    proof_path = REPO / PROOF
    proof_path.unlink(missing_ok=True)
    transport = connect()
    sftp = None
    created_files, created_dirs = [], []
    folder = RUNTIME + '/android-check-' + run_id + '-' + secrets.token_hex(8)
    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        sftp.get_channel().settimeout(30)

        def regular(path, directory=False):
            info = sftp.lstat(path)
            kind = stat.S_ISDIR if directory else stat.S_ISREG
            if not kind(info.st_mode) or info.st_mode & 0o022 or sftp.normalize(path) != path:
                raise ValueError('unsafe_host_node_path')
            return info

        regular(RUNTIME, directory=True)
        node = RUNTIME + '/node-' + NODE_SHA[:16]
        libs = RUNTIME + '/lib-' + NODE_SHA[:16]
        regular(libs, directory=True)
        regular(node)
        loader = libs + '/ld-linux-x86-64.so.2'
        regular(loader)
        prefix = ' '.join(map(shlex.quote, [loader, '--library-path', libs, node, '--max-old-space-size=128']))
        version = execute(transport, command=prefix + ' --version', parser=node_result, deadline_seconds=10)
        if version.get('started') is not True:
            raise ValueError('host_node_not_available')
        # Hash on the host, avoiding repeated 127 MB transfers to the build runner.
        hash_code = ("const f=require('node:fs'),h=require('node:crypto').createHash('sha256');"
                     "const fd=f.openSync(process.argv[1],'r'),b=Buffer.alloc(65536);let n;"
                     "try{while((n=f.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n));}"
                     "finally{f.closeSync(fd)}console.log(h.digest('hex'))")
        checksum = execute(transport, command=prefix + ' -e ' + shlex.quote(hash_code) + ' ' + shlex.quote(node), deadline_seconds=15,
                           parser=lambda out, code: {'match': code == 0 and out.decode().strip() == NODE_SHA})
        if checksum.get('match') is not True:
            raise ValueError('host_node_checksum_mismatch')
        sftp.mkdir(folder, 0o700)
        created_dirs.append(folder)
        for name, content in payload.items():
            parent = folder
            for part in Path(name).parts[:-1]:
                parent += '/' + part
                if parent not in created_dirs:
                    sftp.mkdir(parent, 0o700)
                    created_dirs.append(parent)
            path = folder + '/' + name
            with sftp.open(path, 'wx') as output:
                created_files.append(path)
                output.write(content)
            sftp.chmod(path, 0o600)
            with sftp.open(path, 'rb') as source:
                if digest(source.read(len(content) + 1)) != digest(content):
                    raise ValueError('host_android_source_mismatch')
        command = 'cd ' + shlex.quote(folder) + ' && ' + prefix + ' ' + ' '.join(map(shlex.quote, [
            '--test', '--test-isolation=none', '--test-timeout=10000', '--test-reporter=tap', *TESTS]))
        result = execute(transport, command=command, parser=parse_tests, deadline_seconds=25)
        if result.get('passed') is not True:
            print('N80_ANDROID_HOST_TESTS', json.dumps(result), flush=True)
            raise ValueError('host_android_bridge_tests_failed')
        proof = {'schemaVersion': 1, 'authority': 'N80 Engine', 'module': 'jukebox',
                 'operation': 'jukebox.android_bridge', 'executionTarget': 'existing_noa_host',
                 'sourceCommit': source_commit, 'runId': run_id,
                 'nodeVersion': version['version'], 'nodeSha256': NODE_SHA,
                 'bridgeSha256': digest(payload[BRIDGE]), 'inputs': {p: digest(b) for p, b in payload.items()},
                 'passed': True, 'tests': result['tests'],
                 'checkedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())}
        validate_proof(proof, source_commit, payload[BRIDGE], payload)
        proof_path.write_text(json.dumps(proof, indent=2) + '\n')
        print('N80_ANDROID_HOST_NODE', json.dumps(proof), flush=True)
    finally:
        try:
            if sftp is not None:
                for path in reversed(created_files):
                    sftp.remove(path)
                for path in reversed(created_dirs):
                    sftp.rmdir(path)
        finally:
            if sftp is not None:
                sftp.close()
            transport.close()


def main():
    if sys.argv[1:] == ['--verify-release']:
        proof = json.loads((REPO / PROOF).read_text())
        validate_proof(proof, os.environ['GITHUB_SHA'], (REPO / BRIDGE).read_bytes(), inputs())
        verify_apk(REPO / 'release-artifact/noa-studio-release.apk', proof, os.environ['GITHUB_SHA'])
        verification = REPO / 'release-artifact/verification.json'
        report = json.loads(verification.read_text())
        report['hostNode'] = proof
        verification.write_text(json.dumps(report, indent=2) + '\n')
        print('N80 Android APK contains the exact host-verified bridge and proof')
    elif not sys.argv[1:]:
        check_host()
    else:
        raise ValueError('unknown_android_host_operation')


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        reason = str(error) if isinstance(error, ValueError) and re.fullmatch('[a-z_]+', str(error)) else type(error).__name__
        print('N80_ANDROID_HOST_FAILED', reason, file=sys.stderr)
        raise SystemExit(1)
