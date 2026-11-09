"""N80 Node runtime: immutable private bundle, signed existing queues, no daemon.

Installation belongs to the existing AI worker's installation lane. Normal ticks
only read the active manifest and run one approved operation; they never install
or fall back to a second executor after an uncertain host response.
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

SOURCE = Path(__file__).resolve().parents[1]
ROOT = '/hosting/noastudio/noa-ai-lab/host-runtime'
MANIFEST = ROOT + '/node-current.json'
FILES = ('runtime/node/worker.mjs', 'lab/client.mjs', 'lab/muvy.mjs')
OPERATIONS = {'engine.status', 'ai.muvy'}


def bundle():
    files = {name: (SOURCE / name).read_bytes() for name in FILES}
    hashes = {name: hashlib.sha256(data).hexdigest() for name, data in files.items()}
    digest = hashlib.sha256(json.dumps(hashes, sort_keys=True).encode()).hexdigest()
    return files, digest


def read_file(sftp, path, limit):
    info = sftp.lstat(path)
    if not stat.S_ISREG(info.st_mode) or info.st_size > limit or sftp.normalize(path) != path:
        raise RuntimeError('unsafe_node_file')
    with sftp.open(path, 'rb') as source:
        return source.read(limit + 1)


def validate_manifest(value, expected_bundle):
    if not isinstance(value, dict) or value.get('version') != 1 or value.get('authority') != 'N80 Engine':
        raise RuntimeError('invalid_node_manifest')
    if not re.fullmatch('[a-f0-9]{64}', value.get('bundleSha256', '')) or value.get('bundleSha256') != expected_bundle or not re.fullmatch('[a-f0-9]{64}', value.get('nodeSha256', '')):
        raise RuntimeError('node_runtime_release_mismatch')
    if not re.fullmatch(r'v24\.\d+\.\d+', value.get('nodeVersion', '')) or type(value.get('privateLibraries')) is not bool:
        raise RuntimeError('invalid_node_manifest')
    return value


def command_for(manifest):
    # Every path is derived from validated digests, never supplied by a job/browser.
    node = ROOT + '/node-' + manifest['nodeSha256'][:16]
    lib = ROOT + '/lib-' + manifest['nodeSha256'][:16]
    args = [node]
    if manifest['privateLibraries']:
        args = [lib + '/ld-linux-x86-64.so.2', '--library-path', lib, node]
    args += ['--max-old-space-size=128', '--use-env-proxy', '--dns-result-order=ipv4first', '--no-network-family-autoselection',
             ROOT + '/n80-' + manifest['bundleSha256'][:16] + '/runtime/node/worker.mjs']
    return 'exec ' + shlex.join(args)


def parse_receipt(data, code, operation, invocation, manifest):
    try:
        value = json.loads(data)
    except (ValueError, UnicodeError):
        raise RuntimeError('invalid_node_receipt') from None
    if isinstance(value, dict) and value.get('ok') is False:
        probes = value.get('networkProbe', {})
        if isinstance(probes, dict):
            safe = {name: state for name, state in probes.items()
                    if name in ('ipv4', 'ipv6', 'loopback_tls') and state in ('connected', 'timeout', 'failed')}
            if safe: print('N80_NODE_NETWORK_PROBE', json.dumps(safe), flush=True)
        error = value.get('error', '')
        if isinstance(error, str) and re.fullmatch(r'(?:node_[a-z_]{1,70}|invalid_[a-z_]{1,50}|lab_api_http_[1-5][0-9]{2}|muvy_result_delivery_unconfirmed)', error):
            raise RuntimeError(error)
    if not isinstance(value, dict) or code != 0 or value.get('ok') is not True:
        raise RuntimeError('node_execution_failed')
    if (value.get('version') != 1 or value.get('authority') != 'N80 Engine' or value.get('runtime') != 'node'
            or value.get('invocation') != invocation or value.get('operation') != operation
            or value.get('nodeVersion') != manifest['nodeVersion'] or not isinstance(value.get('result'), dict)):
        raise RuntimeError('invalid_node_receipt')
    result = value['result']
    if operation == 'engine.status':
        if result.get('state') != 'verified' or result.get('engine') != 'N80 Engine' or result.get('generationRequests') != 0:
            raise RuntimeError('invalid_node_status_receipt')
        result = {key: result[key] for key in ('state', 'engine', 'generationRequests')}
    elif result.get('state') not in ('idle', 'disabled', 'bounded_turn_complete') or type(result.get('processed')) is not int or not 0 <= result['processed'] <= 1:
        raise RuntimeError('invalid_node_muvy_receipt')
    else:
        result = {key: result[key] for key in ('state', 'processed')}
    return {'authority':'N80 Engine', 'runtime':'node', 'executionTarget':'existing_noa_host',
            'operation':operation, 'invocation':invocation, 'nodeVersion':manifest['nodeVersion'],
            'bundleSha256':manifest['bundleSha256'], 'result':result}


def invoke(transport, manifest, operation, key, *, deadline_seconds=260):
    if operation not in OPERATIONS or not re.fullmatch('[a-f0-9]{64}', key):
        raise RuntimeError('invalid_node_operation')
    invocation = secrets.token_hex(16)
    request = {'version':1, 'operation':operation, 'invocation':invocation, 'key':key}
    channel = transport.open_session(timeout=15)
    started = time.monotonic()
    try:
        channel.settimeout(20)
        channel.exec_command(command_for(manifest))
        # Credentials travel in SSH stdin, not argv, environment, source or disk.
        channel.sendall(json.dumps(request).encode())
        channel.shutdown_write()
        data, errors = bytearray(), bytearray()
        while True:
            if channel.recv_ready(): data.extend(channel.recv(4096))
            if channel.recv_stderr_ready(): errors.extend(channel.recv_stderr(4096))
            if len(data) + len(errors) > 16384:
                raise RuntimeError('node_output_limit')
            if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
                receipt = parse_receipt(bytes(data), channel.recv_exit_status(), operation, invocation, manifest)
                receipt['elapsedMs'] = round((time.monotonic() - started) * 1000)
                return receipt
            if time.monotonic() - started > deadline_seconds:
                raise RuntimeError('node_response_unconfirmed')
            time.sleep(.05)
    finally:
        request.pop('key', None)
        channel.close()


def execute_operation(operation, key):
    from noa_full_inventory import connect
    import paramiko
    _, digest = bundle()
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(20)
            manifest = validate_manifest(json.loads(read_file(sftp, MANIFEST, 4096)), digest)
            files, _ = bundle()
            for name, expected in files.items():
                if read_file(sftp, ROOT + '/n80-' + digest[:16] + '/' + name, 65536) != expected:
                    raise RuntimeError('node_runtime_source_drift')
        receipt = invoke(transport, manifest, operation, key)
        print('N80_NODE_EXECUTED', json.dumps(receipt), flush=True)
        return receipt
    finally:
        transport.close()


def execute_muvy(key):
    """Drain the existing queue on one SSH connection without crossing a task deadline."""
    from noa_full_inventory import connect
    import paramiko
    files, digest = bundle()
    transport = connect()
    started, processed = time.monotonic(), 0
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(20)
            manifest = validate_manifest(json.loads(read_file(sftp, MANIFEST, 4096)), digest)
            for name, expected in files.items():
                if read_file(sftp, ROOT + '/n80-' + digest[:16] + '/' + name, 65536) != expected:
                    raise RuntimeError('node_runtime_source_drift')
        for _ in range(24):
            if time.monotonic() - started >= 1200: break
            receipt = invoke(transport, manifest, 'ai.muvy', key)
            print('N80_NODE_EXECUTED', json.dumps(receipt), flush=True)
            processed += receipt['result']['processed']
            if receipt['result']['state'] != 'bounded_turn_complete': break
        return {'processed':processed, 'runtime':'node', 'executionTarget':'existing_noa_host'}
    finally:
        transport.close()


def install():
    from noa_ainoa_deploy import check_current_candidate
    from noa_full_inventory import connect
    from noa_host_media_runtime import install_node
    from noa_n80_ai_worker import worker_key
    import paramiko
    check_current_candidate()
    key = worker_key().decode()
    files, digest = bundle()
    folder = ROOT + '/n80-' + digest[:16]
    transport = connect()
    added, directories = [], []
    activated = False
    temporary = None
    try:
        node = install_node(transport)
        if node.get('started') is not True:
            raise RuntimeError('host_node_unavailable')
        print('N80_NODE_BINARY_VERIFIED', node['version'], flush=True)
        manifest = {'version':1, 'authority':'N80 Engine', 'nodeSha256':node['sha256'],
                    'nodeVersion':node['version'], 'privateLibraries':bool(node.get('privateLibraries')),
                    'bundleSha256':digest, 'sourceCommit':os.environ['GITHUB_SHA']}
        validate_manifest(manifest, digest)
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            try: before = read_file(sftp, MANIFEST, 4096)
            except FileNotFoundError: before = None
            if before is not None:
                previous = json.loads(before)
                validate_manifest(previous, previous.get('bundleSha256'))
            def mkdir(path):
                try:
                    info = sftp.lstat(path)
                    if not stat.S_ISDIR(info.st_mode) or sftp.normalize(path) != path:
                        raise RuntimeError('unsafe_node_directory')
                except FileNotFoundError:
                    sftp.mkdir(path, 0o700); directories.append(path)
            try:
                mkdir(folder)
                for name, data in files.items():
                    parent = folder
                    for part in Path(name).parts[:-1]:
                        parent += '/' + part; mkdir(parent)
                    target = folder + '/' + name
                    try: existing = read_file(sftp, target, 65536)
                    except FileNotFoundError: existing = None
                    if existing is None:
                        with sftp.open(target, 'wx') as output:
                            added.append(target); output.write(data)
                        sftp.chmod(target, 0o600)
                    if read_file(sftp, target, 65536) != data:
                        raise RuntimeError('node_source_readback_mismatch')
                # Read-only authenticated roundtrip before activation; no paid generation.
                print('N80_NODE_SOURCE_VERIFIED', digest, flush=True)
                receipt = invoke(transport, manifest, 'engine.status', key, deadline_seconds=80)
                check_current_candidate()
                try: current = read_file(sftp, MANIFEST, 4096)
                except FileNotFoundError: current = None
                if current != before:
                    raise RuntimeError('concurrent_node_activation_preserved')
                temporary = MANIFEST + '.' + secrets.token_hex(8) + '.tmp'
                data = (json.dumps(manifest, sort_keys=True) + '\n').encode()
                with sftp.open(temporary, 'wx') as output: output.write(data)
                sftp.chmod(temporary, 0o600)
                if read_file(sftp, temporary, 4096) != data:
                    raise RuntimeError('node_manifest_readback_mismatch')
                sftp.posix_rename(temporary, MANIFEST)
                activated = True
                if read_file(sftp, MANIFEST, 4096) != data:
                    raise RuntimeError('node_activation_readback_mismatch')
                proof = {'installed':True, 'manifest':manifest, 'verification':receipt,
                         'newScheduler':False, 'newQueue':False, 'providerGenerationRequested':False}
                path = Path('host-media-proof/node.json');path.parent.mkdir(exist_ok=True)
                path.write_text(json.dumps(proof, indent=2) + '\n')
                print('N80_NODE_ACTIVATED', json.dumps(proof), flush=True)
            finally:
                if temporary:
                    try: sftp.remove(temporary)
                    except FileNotFoundError: pass
                if not activated:
                    for path in reversed(added): sftp.remove(path)
                    for path in sorted(set(directories), key=len, reverse=True): sftp.rmdir(path)
    finally:
        transport.close()


if __name__ == '__main__':
    if sys.argv[1:] == ['install']:
        install()
    elif sys.argv[1:] == ['verify']:
        from noa_n80_ai_worker import worker_key
        execute_operation('engine.status', worker_key().decode())
    else:
        raise SystemExit('fixed_node_operation_required')
