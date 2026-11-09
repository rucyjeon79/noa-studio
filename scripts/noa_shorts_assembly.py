"""Automatic N80 editing of already accepted clips; never invent review receipts."""
import base64
import hashlib
import json
import os
import subprocess
import tempfile
import time
import urllib.error
from pathlib import Path

CHUNK = 524288
MAX_BYTES = 512 * 1048576


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as source:
        for block in iter(lambda: source.read(1048576), b''):
            result.update(block)
    return result.hexdigest()


def retry(call, command, **fields):
    # Same operation, offset and bytes after a lost response; never re-plan/generate.
    for attempt in range(3):
        try:
            return call(command, **fields)
        except urllib.error.HTTPError as error:
            if error.code not in (502, 503, 504) or attempt == 2:
                raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if attempt == 2:
                raise
        time.sleep(attempt + 1)


def download(call, kind, scene, sha, target):
    offset, total = 0, None
    with target.open('xb') as output:
        target.chmod(0o600)
        while True:
            row = retry(call, 'assembly_read', kind=kind, scene=scene, offset=offset)
            block = base64.b64decode(row['data'], validate=True)
            size = row['bytes']
            if (row['sha256'] != sha or type(size) is not int or not 1 <= size <= MAX_BYTES
                    or row['offset'] != offset or not 1 <= len(block) <= CHUNK
                    or row['nextOffset'] != offset + len(block) or row['nextOffset'] > size
                    or (total is not None and total != size)
                    or row['done'] is not (row['nextOffset'] == size)):
                raise ValueError('assembly_input_invalid')
            total = size
            output.write(block)
            offset += len(block)
            if row['done']:
                break
    if digest(target) != sha:
        raise ValueError('assembly_input_checksum_mismatch')


def render(manifest, folder):
    root = Path(__file__).resolve().parents[1]
    file = folder / 'manifest.json'
    output = folder / 'final.mp4'
    file.write_text(json.dumps(manifest, ensure_ascii=False))
    # Media processes do not need the hosting/GitHub credentials from this runner.
    environment = {key: os.environ[key] for key in ('PATH', 'LANG', 'LC_ALL', 'TMPDIR') if key in os.environ}
    subprocess.run(['node', str(root / 'lab/session-assemble.mjs'), str(file), str(output)],
                   check=True, timeout=600, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                   env=environment)
    return output, json.loads(Path(str(output) + '.receipt.json').read_text())


def assemble_claim(dispatch, claim, renderer=render):
    auth = {key: claim[key] for key in ('id', 'lease', 'operationId')}

    def call(command, **fields):
        return dispatch(command, **auth, **fields)

    stage = 'assembly_input'
    try:
        with tempfile.TemporaryDirectory(prefix='n80-shorts-') as name:
            folder = Path(name)
            manifest = json.loads(json.dumps(claim['manifest']))
            audio = folder / 'source.audio'
            download(call, 'audio', 0, manifest['audio']['sha256'], audio)
            manifest['audio']['path'] = str(audio)
            for row in manifest['scenes']:
                if type(row['n']) is not int or not 1 <= row['n'] <= 3600:
                    raise ValueError('assembly_scene_invalid')
                target = folder / ('scene-' + str(row['n']) + '.mp4')
                download(call, 'video', row['n'], row['sha256'], target)
                row['path'] = str(target)
            stage = 'assembly_render'
            output, receipt = renderer(manifest, folder)
            if (output != folder / 'final.mp4' or output.is_symlink()
                    or not 256 <= output.stat().st_size <= MAX_BYTES
                    or receipt['bytes'] != output.stat().st_size or receipt['sha256'] != digest(output)):
                raise ValueError('assembly_output_invalid')
            stage = 'assembly_transfer'
            offset = 0
            with output.open('rb') as source:
                while block := source.read(CHUNK):
                    result = retry(call, 'assembly_write', offset=offset, data=base64.b64encode(block).decode(),
                                   bytes=receipt['bytes'], sha256=receipt['sha256'], verification=receipt['verification'])
                    next_offset = result.get('nextOffset')
                    if (type(next_offset) is not int or not offset + len(block) <= next_offset <= receipt['bytes']
                            or result.get('done') is not (next_offset == receipt['bytes'])):
                        raise ValueError('assembly_transfer_invalid')
                    offset = next_offset
                    source.seek(offset)  # An identical previous transfer may be farther ahead.
            if not result.get('done') or result.get('asset', {}).get('sha256') != receipt['sha256']:
                raise ValueError('assembly_receipt_missing')
        return {'state': 'final_review_required', 'sha256': receipt['sha256'], 'publicationReady': False}
    except Exception as error:
        reason = stage + ('_timeout' if isinstance(error, subprocess.TimeoutExpired) else '_failed')
        try:
            call('assembly_fail', reason=reason)
        except Exception:
            pass  # Never overwrite a newer executor or a completed receipt.
        return {'state': 'assembly_failed', 'reason': reason, 'errorType': type(error).__name__, 'publicationReady': False}


def run_assembly(dispatch):
    try:
        claim = dispatch('assembly_claim')
        result = assemble_claim(dispatch, claim) if claim.get('claimed') else {'state': claim['state']}
    except Exception as error:
        result = {'state': 'assembly_dependency_failed', 'errorType': type(error).__name__}
    print('N80_SHORTS_ASSEMBLY', json.dumps(result), flush=True)
    return result
