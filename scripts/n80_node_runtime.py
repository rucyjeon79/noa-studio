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
FILES = ('runtime/node/worker.mjs', 'lab/muvy.mjs')
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
    args += ['--max-old-space-size=128',
             ROOT + '/n80-' + manifest['bundleSha256'][:16] + '/runtime/node/worker.mjs']
    return 'exec ' + shlex.join(args)


def parse_receipt(data, code, operation, invocation, manifest):
    try:
        value = json.loads(data)
    except (ValueError, UnicodeError):
        raise RuntimeError('invalid_node_receipt') from None
    if isinstance(value, dict) and value.get('ok') is False:
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


class NodeTools:
    """Fixed N80 tool transport. No URL, command or provider selection from Node."""
    def __init__(self, operation, key, service=None, provider=None):
        self.operation, self.key = operation, key
        self.service = service or self.signed_service
        self.provider = provider or self.provider_request
        self.task = None
        self.credential = None
        self.provider_used = False
        self.sequence = 0
        self.counts = {}
        self.completion = None

    def signed_service(self, action, body):
        from noa_n80_ai_worker import signed_tick
        return signed_tick(self.key.encode(), action, json.dumps(body,ensure_ascii=False).encode(), timeout=20)

    def provider_request(self):
        import urllib.request
        import urllib.error
        task = self.task
        body = {'model':task['model'], 'temperature':.6, 'max_tokens':task['tokens'],
                'response_format':{'type':'json_object'}, 'messages':[
                    {'role':'system','content':task['system']}, {'role':'user','content':task['user']}]}
        request = urllib.request.Request('https://api.x.ai/v1/chat/completions',
            data=json.dumps(body,ensure_ascii=False).encode(), headers={
                'Content-Type':'application/json', 'Authorization':'Bearer '+self.credential})
        class NoRedirect(urllib.request.HTTPRedirectHandler):
            def redirect_request(self, *args, **kwargs): return None
        try:
            response = urllib.request.build_opener(NoRedirect).open(request,timeout=95)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            status = response.code
            if status != 200: return {'status':status, 'body':''}
            data = response.read(2097153)
        if len(data)>2097152: raise RuntimeError('node_provider_output_limit')
        return {'status':status,'body':data.decode('utf-8')}

    def handle(self, message):
        if not isinstance(message,dict) or message.get('type')!='tool' or type(message.get('id')) is not int \
                or message['id']!=self.sequence+1 or message['id']>8 or not isinstance(message.get('body'),dict):
            raise RuntimeError('invalid_node_tool')
        self.sequence=message['id']
        action, body = message.get('action'), message['body']
        limits = {'n80_status':1} if self.operation=='engine.status' else {'muvy_claim':1,'muvy_provider':1,'muvy_complete':3,'muvy_failed':1}
        if action not in limits: raise RuntimeError('node_tool_not_allowed')
        self.counts[action]=self.counts.get(action,0)+1
        if self.counts[action]>limits[action]: raise RuntimeError('node_tool_limit')
        if action in ('n80_status','muvy_claim'):
            if body: raise RuntimeError('invalid_node_tool_body')
            result = self.service(action,body)
            if action=='muvy_claim' and result.get('task'):
                self.task=result['task'];self.credential=result['credential']
                result={**result,'credential':'n80_tool_transport'}
            return result
        if not self.task: raise RuntimeError('node_claim_required')
        if action=='muvy_provider':
            if body or self.provider_used: raise RuntimeError('node_provider_replay_blocked')
            self.provider_used=True
            return self.provider()
        if not self.provider_used or any(body.get(name)!=self.task.get(name) for name in ('id','request','lease')):
            raise RuntimeError('node_task_identity_mismatch')
        if action=='muvy_complete':
            digest=hashlib.sha256(json.dumps(body,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
            if self.completion is not None and self.completion!=digest: raise RuntimeError('node_completion_changed')
            self.completion=digest
        return self.service(action,body)


def invoke(transport, manifest, operation, key, *, deadline_seconds=260):
    if operation not in OPERATIONS or not re.fullmatch('[a-f0-9]{64}', key):
        raise RuntimeError('invalid_node_operation')
    invocation = secrets.token_hex(16)
    request = {'version':1, 'operation':operation, 'invocation':invocation, 'transport':'n80_auto'}
    relay = NodeTools(operation,key)
    channel = transport.open_session(timeout=15)
    started = time.monotonic()
    try:
        channel.settimeout(20)
        channel.exec_command(command_for(manifest))
        channel.sendall(json.dumps(request).encode()+b'\n')
        data, errors = bytearray(), bytearray()
        total, final = 0, None
        while True:
            if channel.recv_ready():
                block=channel.recv(32768);data.extend(block);total+=len(block)
            if channel.recv_stderr_ready(): errors.extend(channel.recv_stderr(4096))
            if len(data)>4194304 or total>16777216 or len(errors)>16384:
                raise RuntimeError('node_output_limit')
            while b'\n' in data:
                line, _, rest=data.partition(b'\n');data=bytearray(rest)
                message=json.loads(line)
                if isinstance(message,dict) and message.get('type')=='tool':
                    if final is not None: raise RuntimeError('node_tool_after_receipt')
                    try:
                        result=relay.handle(message)
                        reply={'type':'tool_result','id':message['id'],'ok':True,'result':result}
                        wire=json.dumps(reply,ensure_ascii=False).encode()+b'\n'
                        if len(wire)>4194304: raise RuntimeError('node_tool_output_limit')
                    except Exception as error:
                        # Ambiguous provider execution is never retried; Node records the existing failed/unconfirmed state.
                        from urllib.error import HTTPError
                        code='lab_api_http_'+str(error.code) if isinstance(error,HTTPError) and 100<=error.code<=599 else 'node_transport_failed'
                        wire=json.dumps({'type':'tool_result','id':message.get('id'),'ok':False,'error':code}).encode()+b'\n'
                    channel.sendall(wire)
                else:
                    if final is not None: raise RuntimeError('duplicate_node_receipt')
                    final=line
            if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
                receipt=parse_receipt(final or b'',channel.recv_exit_status(),operation,invocation,manifest)
                if data: raise RuntimeError('invalid_node_trailing_output')
                receipt.update(elapsedMs=round((time.monotonic()-started)*1000),transport='N80 Auto',toolCalls=relay.sequence)
                return receipt
            if time.monotonic()-started>deadline_seconds:
                if final: parse_receipt(final,1,operation,invocation,manifest)
                raise RuntimeError('node_response_unconfirmed')
            time.sleep(.05)
    finally:
        relay.credential=None
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
    import noa_ainoa_deploy as release
    from noa_release_freshness import BUSAN_ONLY_PATH_PREFIXES
    # Browser-only changes share this repo but do not change the Node bundle or
    # installer. Node, shared media-runtime, manifest and workflow changes still block.
    release.UNRELATED_PATH_PREFIXES = BUSAN_ONLY_PATH_PREFIXES + (
        'scripts/noa_host_browser_runtime.py', 'docs/operations/n80-host-runtime.md',
        'tests/engine/test_host_media_runtime.py',
    )
    check_current_candidate = release.check_current_candidate
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
