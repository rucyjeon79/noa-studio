"""N80's private host media runtime and existing Shorts renderer adapter.

GitHub supplies verified OS packages and transport only. Encoding, transitions,
subtitle burning and complete decoding run on the existing NOA host.
"""
from contextlib import contextmanager
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import shutil
import stat
import subprocess
import sys
import tempfile

SOURCE = Path(__file__).resolve().parents[1]
ROOT = '/hosting/noastudio/noa-ai-lab/host-runtime'
CURRENT = ROOT + '/media-runtime-current.json'
SOURCES = ('runtime/media/host-runner.mjs', 'lab/session-assemble.mjs', 'lab/subtitles.mjs')
TOOLS = ('ffmpeg', 'ffprobe', 'fc-match')
MAX_FILE = 512 * 1048576
STOPPED = ('host_media_rendered', 'host_media_verified', 'media_process_failed', 'media_process_timeout', 'media_output_limit')


class HostRenderUnconfirmed(RuntimeError):
    """Keep the existing lease; do not start a local or concurrent renderer."""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(sftp, path, limit=65536):
    info = sftp.lstat(path)
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o022 or info.st_size > limit or sftp.normalize(path) != path:
        raise ValueError('unsafe_host_media_file')
    with sftp.open(path, 'rb') as source:
        result = source.read(limit + 1)
    if len(result) > limit:
        raise ValueError('host_media_read_limit')
    return result


def mkdir(sftp, path):
    try:
        info = sftp.lstat(path)
    except FileNotFoundError:
        sftp.mkdir(path, 0o700)
        info = sftp.lstat(path)
    if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o022 or sftp.normalize(path) != path:
        raise ValueError('unsafe_host_media_directory')


def node_args(sftp):
    from n80_node_runtime import bundle, validate_manifest
    value = validate_manifest(json.loads(read(sftp, ROOT + '/node-current.json', 4096)), bundle()[1])
    binary = ROOT + '/node-' + value['nodeSha256'][:16]
    libs = ROOT + '/lib-' + value['nodeSha256'][:16]
    args = [libs + '/ld-linux-x86-64.so.2', '--library-path', libs, binary] if value['privateLibraries'] else [binary]
    return args + ['--max-old-space-size=128']


def source_hashes():
    return {name: sha((SOURCE / name).read_bytes()) for name in SOURCES}


def media_manifest(value):
    if (not isinstance(value, dict) or value.get('schemaVersion') != 1
            or value.get('authority') != 'N80 Engine' or value.get('module') != 'ai_lab'
            or value.get('state') != 'host_media_verified'
            or not re.fullmatch('[a-f0-9]{64}', value.get('bundleId', ''))
            or not re.fullmatch('[a-f0-9]{64}', value.get('manifestSha256', ''))
            or value.get('sourceHashes') != source_hashes()):
        raise ValueError('host_media_runtime_not_current')
    return value


def result(output, code):
    try:
        value = json.loads(output)
    except (ValueError, UnicodeError):
        return {'ok': False, 'state': 'media_response_unconfirmed'}
    if not isinstance(value, dict):
        return {'ok': False, 'state': 'media_response_unconfirmed'}
    value['ok'] = code == 0 and value.get('ok', value.get('verified')) is True
    return value


def execute(transport, args, seconds=60):
    from noa_host_media_runtime import execute as host_execute
    return host_execute(transport, command=shlex.join(args), parser=result, deadline_seconds=seconds)


def put(sftp, target, *, data=None, local=None):
    temporary = target + '.' + secrets.token_hex(8) + '.upload'
    try:
        with sftp.open(temporary, 'wx') as output:
            output.set_pipelined(True)
            if local is not None:
                with local.open('rb') as source:
                    shutil.copyfileobj(source, output, length=262144)
            else:
                output.write(data)
        sftp.chmod(temporary, 0o700)
        sftp.rename(temporary, target)
    finally:
        try:
            sftp.remove(temporary)
        except FileNotFoundError:
            pass


def package(staging):
    from noa_host_media_runtime import runtime_libraries
    files = {}
    for name in TOOLS:
        command = shutil.which(name)
        if not command or not str(Path(command).resolve()).startswith('/usr/bin/'):
            raise ValueError('system_media_package_required')
        binary = Path(command).resolve()
        files['bin/' + name] = binary
        for library, path in runtime_libraries(binary).items():
            key = 'lib/' + library
            if key in files and files[key] != path:
                raise ValueError('media_library_conflict')
            files[key] = path
    font = Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc')
    if not font.is_file():
        raise ValueError('korean_subtitle_font_required')
    files['fonts/NotoSansCJK-Regular.ttc'] = font
    for name in SOURCES:
        files[name] = SOURCE / name
    original = {name: sha(file.read_bytes()) for name, file in sorted(files.items())}
    bundle_id = sha(json.dumps({'version': 1, 'files': original}, sort_keys=True).encode())
    folder = ROOT + '/ffmpeg-' + bundle_id
    for name in TOOLS:
        key = 'bin/' + name
        target = staging / name
        shutil.copyfile(files[key], target)
        subprocess.run(['patchelf', '--set-interpreter', folder + '/lib/ld-linux-x86-64.so.2',
                        '--force-rpath', '--set-rpath', folder + '/lib', str(target)],
                       check=True, timeout=30, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        files[key] = target
    entries = {name: {'bytes': file.stat().st_size, 'sha256': sha(file.read_bytes())}
               for name, file in sorted(files.items())}
    if len(entries) > 350 or sum(row['bytes'] for row in entries.values()) > MAX_FILE:
        raise ValueError('media_runtime_package_limit')
    return folder, bundle_id, files, entries


@contextmanager
def connection():
    from noa_full_inventory import connect
    import paramiko
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(45)
            yield transport, sftp
    finally:
        transport.close()


def verify(transport, sftp, node, folder, manifest_sha):
    # Verify the executable verifier against this checked-out source before use.
    runner = folder + '/runtime/media/host-runner.mjs'
    for name in SOURCES:
        if read(sftp, folder + '/' + name) != (SOURCE / name).read_bytes():
            raise ValueError('host_media_source_drift')
    checked = execute(transport, node + [runner, 'verify', folder, folder + '/package.json', manifest_sha], 90)
    if checked.get('ok') is not True or checked.get('verified') is not True:
        raise ValueError('host_media_package_unverified')


def invoke(transport, sftp, node, folder, job, settings):
    settings_path = job + '/request.json'
    data = json.dumps(settings, ensure_ascii=False).encode()
    put(sftp, settings_path, data=data)
    if read(sftp, settings_path, 200000) != data:
        raise ValueError('media_request_readback_failed')
    return execute(transport, node + [folder + '/runtime/media/host-runner.mjs', 'run', settings_path], 640)


def capacity(transport, node, required):
    available = execute(transport, node + ['-e',
        "const s=require('node:fs').statfsSync('/hosting/noastudio/noa-ai-lab/host-runtime');console.log(JSON.stringify({ok:true,available:s.bavail*s.bsize}));"], 15)
    if available.get('ok') is not True or available.get('available', 0) < required:
        raise ValueError('host_media_space_unverified_or_insufficient')


def install():
    from n80_auto import plan
    from noa_host_browser_runtime import remove_profile
    plan('ai.media_install', os.environ)
    with tempfile.TemporaryDirectory(prefix='n80-media-package-') as name:
        folder, bundle_id, files, entries = package(Path(name))
        raw = json.dumps(entries, sort_keys=True).encode()
        manifest_sha = sha(raw)
        total = sum(row['bytes'] for row in entries.values())
        print('N80_MEDIA_PACKAGE', json.dumps({'files': len(files), 'bytes': total}), flush=True)
        with connection() as (transport, sftp):
            node = node_args(sftp)
            capacity(transport, node, total + 128 * 1048576)
            try:
                before = read(sftp, CURRENT, 16384)
            except FileNotFoundError:
                before = None
            mkdir(sftp, folder)
            for index, (name, local) in enumerate(sorted(files.items()), 1):
                parent = folder
                for part in Path(name).parts[:-1]:
                    parent += '/' + part
                    mkdir(sftp, parent)
                target = folder + '/' + name
                try:
                    info = sftp.lstat(target)
                    if not stat.S_ISREG(info.st_mode) or info.st_size != entries[name]['bytes'] or sftp.normalize(target) != target:
                        raise ValueError('existing_media_package_mismatch')
                except FileNotFoundError:
                    put(sftp, target, local=local)
                if index % 25 == 0 or index == len(files):
                    print('N80_MEDIA_FILES_STAGED', index, len(files), flush=True)
            try:
                existing = read(sftp, folder + '/package.json')
            except FileNotFoundError:
                put(sftp, folder + '/package.json', data=raw)
                existing = read(sftp, folder + '/package.json')
            if existing != raw:
                raise ValueError('host_media_manifest_mismatch')
            verify(transport, sftp, node, folder, manifest_sha)
            print('N80_MEDIA_PACKAGE_VERIFIED', flush=True)
            job = ROOT + '/media-job-' + secrets.token_hex(16)
            mkdir(sftp, job)
            check = {}
            try:
                check = invoke(transport, sftp, node, folder, job, {'kind': 'check'})
                print('N80_MEDIA_HOST_CHECK', json.dumps(check), flush=True)
                if not check.get('ok') or check.get('state') != 'host_media_verified' or check.get('subtitlesBurned') is not True:
                    raise ValueError('host_media_execution_unverified')
            finally:
                if check.get('state') in STOPPED:
                    remove_profile(sftp, job, job)
            value = {'schemaVersion': 1, 'authority': 'N80 Engine', 'module': 'ai_lab',
                     'state': 'host_media_verified', 'bundleId': bundle_id, 'manifestSha256': manifest_sha,
                     'sourceHashes': source_hashes(), 'sourceCommit': os.environ['GITHUB_SHA'],
                     'executionTarget': 'existing_noa_host', 'check': check,
                     'authenticatedBrowser': False, 'productionMovieVerified': False}
            media_manifest(value)
            try:
                current = read(sftp, CURRENT, 16384)
            except FileNotFoundError:
                current = None
            if current != before:
                raise ValueError('concurrent_media_activation_preserved')
            data = (json.dumps(value, sort_keys=True) + '\n').encode()
            temporary = CURRENT + '.' + secrets.token_hex(8)
            put(sftp, temporary, data=data)
            if read(sftp, temporary, 16384) != data:
                raise ValueError('media_activation_readback_failed')
            sftp.posix_rename(temporary, CURRENT)
            if read(sftp, CURRENT, 16384) != data:
                raise ValueError('media_activation_unconfirmed')
            proof = SOURCE / 'host-media-proof/media-runtime.json'
            proof.parent.mkdir(exist_ok=True)
            proof.write_text(json.dumps(value, indent=2) + '\n')
            print('N80_MEDIA_ACTIVATED', json.dumps(value), flush=True)


def render(manifest, local_folder):
    from noa_host_browser_runtime import remove_profile
    with connection() as (transport, sftp):
        node = node_args(sftp)
        active = media_manifest(json.loads(read(sftp, CURRENT, 16384)))
        folder = ROOT + '/ffmpeg-' + active['bundleId']
        verify(transport, sftp, node, folder, active['manifestSha256'])
        scenes = manifest.get('scenes', [])
        if not 1 <= len(scenes) <= 64 or any(type(s.get('n')) is not int or not 1 <= s['n'] <= 3600 for s in scenes):
            raise ValueError('host_media_scene_scope')
        capacity(transport, node, sum(Path(row['path']).stat().st_size for row in [manifest['audio'], *scenes]) + 1024 * 1048576)
        job = ROOT + '/media-job-' + secrets.token_hex(16)
        mkdir(sftp, job)
        confirmed = True
        try:
            copied = json.loads(json.dumps(manifest))
            for row, name in [(copied['audio'], 'source.audio'), *[(s, 'scene-' + str(s['n']) + '.mp4') for s in copied['scenes']]]:
                local = Path(row['path'])
                if local.is_symlink() or not local.is_file() or local.parent != local_folder or not 0 < local.stat().st_size <= MAX_FILE:
                    raise ValueError('host_media_input_rejected')
                target = job + '/' + name
                put(sftp, target, local=local)
                row['path'] = target
            confirmed = False
            try:
                response = invoke(transport, sftp, node, folder, job, {'kind': 'render', 'manifest': copied})
            except Exception:
                raise HostRenderUnconfirmed('host_media_response_unconfirmed') from None
            print('N80_HOST_RENDER_RESULT', json.dumps(response), flush=True)
            confirmed = response.get('state') in STOPPED
            if not confirmed:
                raise HostRenderUnconfirmed('host_media_response_unconfirmed')
            if response.get('ok') is not True or response.get('state') != 'host_media_rendered':
                raise ValueError('host_media_render_failed')
            receipt = json.loads(read(sftp, job + '/result.json', 65536))
            if receipt.get('n80Execution') != manifest.get('n80Execution'):
                raise ValueError('host_media_output_identity_invalid')
            if not re.fullmatch('[a-f0-9]{64}', receipt.get('sha256', '')) or type(receipt.get('bytes')) is not int or not 256 <= receipt['bytes'] <= MAX_FILE:
                raise ValueError('host_media_output_receipt_invalid')
            output = local_folder / 'final.mp4'
            info = sftp.lstat(job + '/final.mp4')
            if not stat.S_ISREG(info.st_mode) or info.st_size != receipt['bytes']:
                raise ValueError('host_media_output_size_invalid')
            h = hashlib.sha256()
            with sftp.open(job + '/final.mp4', 'rb') as source, output.open('xb') as destination:
                output.chmod(0o600)
                source.prefetch(file_size=info.st_size, max_concurrent_requests=8)
                while chunk := source.read(262144):
                    h.update(chunk)
                    destination.write(chunk)
            if output.stat().st_size != receipt['bytes'] or h.hexdigest() != receipt['sha256'] or response.get('sha256') != receipt['sha256']:
                raise ValueError('host_media_output_checksum_invalid')
            receipt['file'] = str(output)
            receipt['executionTarget'] = 'existing_noa_host'
            return output, receipt
        finally:
            if confirmed:
                remove_profile(sftp, job, job)


if __name__ == '__main__':
    if sys.argv[1:] != ['install']:
        raise SystemExit('fixed_media_operation_required')
    install()
