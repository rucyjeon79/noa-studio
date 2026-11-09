"""Encrypted, readback-verified artifact spool owned by the existing N80 tick."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import subprocess
import tempfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from noa_shorts_storage import retry, MAX_BYTES, CHUNK

MAGIC = b'N80GH1'

def context(claim):
    asset = claim['asset']['asset']
    return json.dumps([claim['id'], claim['key'], claim['sourceAudioSha256'],
                       asset['sha256'], asset['bytes']], separators=(',', ':')).encode()

def seal(data, claim, worker_key):
    if not isinstance(worker_key, bytes) or len(worker_key) < 32:
        raise ValueError('storage_key_required')
    aad = context(claim)
    key = hmac.digest(worker_key, b'n80-github-media-v1\0' + aad, 'sha256')
    nonce = os.urandom(12)
    return MAGIC + nonce + AESGCM(key).encrypt(nonce, data, aad)

def unseal(data, claim, worker_key):
    if not data.startswith(MAGIC):
        raise ValueError('storage_envelope_invalid')
    aad = context(claim)
    key = hmac.digest(worker_key, b'n80-github-media-v1\0' + aad, 'sha256')
    return AESGCM(key).decrypt(data[6:18], data[18:], aad)

class Artifacts:
    def call(self, op, run, **fields):
        helper = Path(__file__).resolve().parents[1] / '.github/actions/n80-daily-shorts/artifact.mjs'
        with tempfile.TemporaryDirectory(prefix='n80-artifact-receipt-') as folder:
            result = Path(folder) / 'result.json'
            subprocess.run(['node', str(helper)], input=json.dumps({'op': op, 'run': run,
                'result': str(result), **fields}), text=True, check=True, timeout=600,
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return json.loads(result.read_text())

def transfer(dispatch, claim, worker_key, artifacts, current_run):
    auth = {k: claim[k] for k in ('id', 'key', 'lease')}
    def call(command, **fields):
        return dispatch(command, **auth, **fields)
    stage = 'artifact_reserve'
    try:
        run = dict(current_run, name=claim['artifactName'])
        reserved = retry(call, 'storage_reserve', run=run)
        # Reconcile all persisted run identities before creating another artifact.
        found = []
        for previous in reserved['artifactRuns']:
            item = artifacts.call('find', previous)
            if item.get('id'):
                found.append((previous, item['id']))
        if len(found) > 1:
            raise ValueError('artifact_identity_ambiguous')
        asset = claim['asset']['asset']
        if not 1 <= asset['bytes'] <= MAX_BYTES:
            raise ValueError('asset_size_invalid')
        with tempfile.TemporaryDirectory(prefix='n80-encrypted-media-') as folder:
            folder = Path(folder)
            if found:
                run, artifact_id = found[0]
            else:
                stage = 'artifact_source'
                data = bytearray(); offset = 0
                while offset < asset['bytes']:
                    row = retry(call, 'storage_read', offset=offset)
                    block = base64.b64decode(row['data'], validate=True)
                    if (row['offset'] != offset or row['bytes'] != asset['bytes'] or row['sha256'] != asset['sha256']
                        or not 1 <= len(block) <= CHUNK or row['nextOffset'] != offset + len(block)
                        or row['nextOffset'] > asset['bytes'] or row['done'] is not (row['nextOffset'] == asset['bytes'])):
                        raise ValueError('storage_input_invalid')
                    data.extend(block); offset += len(block)
                if hashlib.sha256(data).hexdigest() != asset['sha256']:
                    raise ValueError('storage_input_checksum_mismatch')
                encrypted = folder / 'media.n80'
                encrypted.write_bytes(seal(bytes(data), claim, worker_key)); encrypted.chmod(0o600)
                del data
                stage = 'artifact_upload'
                artifact_id = artifacts.call('upload', run, path=str(encrypted))['id']
            stage = 'artifact_readback'
            target = folder / 'readback'; target.mkdir(mode=0o700)
            artifacts.call('download', run, id=artifact_id, path=str(target))
            files = list(target.iterdir())
            if len(files) != 1 or files[0].name != 'media.n80' or files[0].is_symlink() or files[0].stat().st_size != asset['bytes'] + 34:
                raise ValueError('artifact_content_invalid')
            envelope = files[0].read_bytes()
            data = unseal(envelope, claim, worker_key)
            if len(data) != asset['bytes'] or hashlib.sha256(data).hexdigest() != asset['sha256']:
                raise ValueError('artifact_readback_mismatch')
            receipt = {'run': run, 'artifactId': artifact_id, 'sha256': asset['sha256'], 'bytes': len(data),
                'readbackVerified': True, 'encryption': 'AES-256-GCM', 'ciphertextSha256': hashlib.sha256(envelope).hexdigest()}
            stage = 'artifact_receipt'
            result = retry(call, 'storage_complete', receipt=receipt)
            if result.get('state') != 'stored' or result.get('artifactId') != artifact_id:
                raise ValueError('artifact_receipt_unconfirmed')
        return {'state': 'stored', 'provider': 'github_actions_artifact', 'artifactId': artifact_id,
                'readbackVerified': True, 'encrypted': True}
    except Exception as error:
        try: call('storage_fail', reason=stage + '_failed')
        except Exception: pass
        return {'state': 'storage_failed', 'reason': stage + '_failed', 'errorType': type(error).__name__}

def run_github_storage(dispatch, worker_key):
    required = ('ACTIONS_RUNTIME_TOKEN', 'ACTIONS_RESULTS_URL', 'GH_TOKEN', 'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT')
    if (not all(os.environ.get(k) for k in required) or not worker_key
            or os.environ.get('GITHUB_REPOSITORY') != 'rucyjeon79/noa-studio'):
        results = [{'state': 'storage_connection_required', 'reason': 'github_runtime_required'}]
    else:
        current = {'repository': 'rucyjeon79/noa-studio', 'runId': int(os.environ['GITHUB_RUN_ID']),
                   'attempt': int(os.environ['GITHUB_RUN_ATTEMPT'])}
        results = []
        for _ in range(3):
            claim = dispatch('storage_claim')
            if not claim.get('claimed'):
                results.append({'state': claim['state']}); break
            result = transfer(dispatch, claim, worker_key, Artifacts(), current)
            results.append(result)
            if result['state'] != 'stored': break
    print('N80_SHORTS_STORAGE', json.dumps(results), flush=True)
    return results
