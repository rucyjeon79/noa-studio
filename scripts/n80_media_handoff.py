"""Hand the existing media implementation to the host's private N80 runtime.

This transfers code, not a second worker. Dependencies and actual execution are
separate gates; the existing task/lease store remains authoritative.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import stat

SOURCE = Path(__file__).resolve().parents[1]
ROOT = '/hosting/noastudio/noa-ai-lab/host-runtime'
POINTER = ROOT + '/media-source-current.json'
FILES = (
    'lab/analysis.mjs', 'lab/analyze.py', 'lab/client.mjs', 'lab/creation.mjs',
    'lab/daily_shorts.py', 'lab/mastering.mjs', 'lab/media.mjs', 'lab/muvy.mjs',
    'lab/providers.mjs', 'lab/session-assemble.mjs', 'lab/session-subtitles.py',
    'lab/subtitle-requirements.txt', 'lab/subtitles.mjs', 'lab/usage.mjs',
    'lab/worker.mjs', 'lab/youtube.mjs',
    'integrations/chatgpt-assistant/worker.mjs', 'integrations/chatgpt-assistant/provenance.json',
)


def payload(root=SOURCE):
    files = {}
    for name in FILES:
        path = root / name
        if path.is_symlink() or not path.is_file() or path.resolve() != root.resolve() / name:
            raise ValueError('invalid_media_source')
        files[name] = path.read_bytes()
    if not 0 < sum(map(len, files.values())) < 1_000_000:
        raise ValueError('media_source_size_limit')
    return files


def digest(data):
    return hashlib.sha256(data).hexdigest()


def read(sftp, path, limit=1_000_000):
    info = sftp.lstat(path)
    if (not stat.S_ISREG(info.st_mode) or info.st_mode & 0o022
            or info.st_size > limit or sftp.normalize(path) != path):
        raise ValueError('unsafe_media_handoff_file')
    with sftp.open(path, 'rb') as stream:
        data = stream.read(limit + 1)
    if len(data) > limit:
        raise ValueError('media_handoff_read_limit')
    return data


def transfer(sftp, files, commit, run_id):
    if not re.fullmatch('[a-f0-9]{40}', commit or '') or not re.fullmatch('[1-9][0-9]*', run_id or ''):
        raise ValueError('invalid_media_handoff_identity')
    if set(files) != set(FILES):
        raise ValueError('unregistered_media_source')
    hashes = {name: digest(data) for name, data in sorted(files.items())}
    bundle = digest(json.dumps(hashes, sort_keys=True).encode())
    directory = ROOT + '/media-' + bundle
    def mkdir(path):
        try:
            info = sftp.lstat(path)
        except FileNotFoundError:
            sftp.mkdir(path, 0o700)
            info = sftp.lstat(path)
        if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o022 or sftp.normalize(path) != path:
            raise ValueError('unsafe_media_handoff_directory')
    # The verified Node installation owns ROOT; do not manufacture a host runtime.
    info = sftp.lstat(ROOT)
    if not stat.S_ISDIR(info.st_mode) or info.st_mode & 0o022 or sftp.normalize(ROOT) != ROOT:
        raise ValueError('verified_host_runtime_required')
    try:
        before = read(sftp, POINTER, 16384)
    except FileNotFoundError:
        before = None
    if before is not None:
        previous = json.loads(before)
        if (previous.get('authority') != 'N80 Engine' or previous.get('operation') != 'ai.media_handoff'
                or not re.fullmatch('[1-9][0-9]*', previous.get('runId', ''))):
            raise ValueError('unknown_media_handoff_preserved')
        if int(previous['runId']) > int(run_id):
            raise ValueError('stale_media_handoff')
        if previous['runId'] == run_id and (previous.get('sourceCommit') != commit or previous.get('bundleSha256') != bundle):
            raise ValueError('conflicting_media_handoff')
    mkdir(directory)
    for name, data in files.items():
        parent = directory
        for part in Path(name).parts[:-1]:
            parent += '/' + part
            mkdir(parent)
        path = directory + '/' + name
        try:
            installed = read(sftp, path)
        except FileNotFoundError:
            staging = path + '.' + secrets.token_hex(8) + '.upload'
            try:
                with sftp.open(staging, 'wx') as target:
                    target.write(data)
                sftp.chmod(staging, 0o600)
                if read(sftp, staging) != data:
                    raise ValueError('media_source_readback_mismatch')
                sftp.rename(staging, path)
                installed = read(sftp, path)
            finally:
                try:
                    sftp.remove(staging)
                except FileNotFoundError:
                    pass
        if installed != data:
            raise ValueError('media_source_readback_mismatch')
    receipt = {'schemaVersion': 1, 'authority': 'N80 Engine', 'module': 'ai_lab',
               'operation': 'ai.media_handoff', 'destination': 'existing_noa_host',
               'sourceCommit': commit, 'runId': run_id, 'bundleSha256': bundle,
               'files': hashes, 'fileCount': len(files), 'bytes': sum(map(len, files.values())),
               'state': 'source_verified_on_host', 'executionReady': False,
               'newWorker': False, 'newScheduler': False, 'newQueue': False,
               'pending': ['host_media_dependencies', 'host_media_adapter_execution',
                           'authenticated_browser_executor', 'end_to_end_movie_verification']}
    data = (json.dumps(receipt, sort_keys=True) + '\n').encode()
    temporary = POINTER + '.' + secrets.token_hex(8) + '.tmp'
    try:
        with sftp.open(temporary, 'wx') as target:
            target.write(data)
        sftp.chmod(temporary, 0o600)
        if read(sftp, temporary, 16384) != data:
            raise ValueError('media_receipt_readback_mismatch')
        try:
            current = read(sftp, POINTER, 16384)
        except FileNotFoundError:
            current = None
        if current != before:
            raise ValueError('concurrent_media_handoff_preserved')
        sftp.posix_rename(temporary, POINTER)
        if read(sftp, POINTER, 16384) != data:
            raise ValueError('media_handoff_confirmation_failed')
    finally:
        try:
            sftp.remove(temporary)
        except FileNotFoundError:
            pass
    return receipt


def main():
    from n80_auto import plan
    plan('ai.media_handoff', os.environ)
    from noa_full_inventory import connect
    import paramiko
    transport = connect()
    try:
        with paramiko.SFTPClient.from_transport(transport) as sftp:
            sftp.get_channel().settimeout(30)
            receipt = transfer(sftp, payload(), os.environ['GITHUB_SHA'], os.environ['GITHUB_RUN_ID'])
    finally:
        transport.close()
    path = Path('host-media-proof/media-handoff.json')
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(receipt, indent=2) + '\n')
    print('N80_MEDIA_HANDOFF', json.dumps(receipt), flush=True)


if __name__ == '__main__':
    main()
