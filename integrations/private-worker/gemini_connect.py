"""One-time Gemini login delivery using GitHub's native sealed secrets API.

Only a GitHub-public-key-encrypted value can enter this private repository.
The GitHub secrets service decrypts it; this setup step never sees plaintext.
The existing private worker, not another scheduler, owns connection maintenance.
"""
import base64
import json
import os
from pathlib import Path
import re
import urllib.request

REPOSITORY = 'rucyjeon79/noa-private-worker'
SECRET = 'NOA_GEMINI_OAUTH'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None

def github(token, method, suffix, data=None):
    if suffix not in ('public-key', SECRET):
        raise ValueError('secret_scope_rejected')
    body = None if data is None else json.dumps(data).encode()
    request = urllib.request.Request('https://api.github.com/repos/' + REPOSITORY + '/actions/secrets/' + suffix,
        data=body, method=method, headers={'Authorization': 'Bearer ' + token,
        'Accept': 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json'})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        if response.status not in (200, 201, 204):
            raise RuntimeError('github_secret_operation_failed')
        raw = response.read(100000)
        return json.loads(raw) if raw else {}

def connect(request, call):
    mode = request.get('mode')
    if mode not in ('prepare', 'connect'):
        raise ValueError('invalid_connection_mode')
    fields = {'mode'} if mode == 'prepare' else {'mode', 'key_id', 'encrypted_value'}
    if set(request) != fields:
        raise ValueError('invalid_connection_fields')
    if mode == 'connect':
        if not isinstance(request['key_id'], str) or not re.fullmatch(r'[0-9]{1,40}', request['key_id']):
            raise ValueError('invalid_recipient_key')
        value = request['encrypted_value']
        if not isinstance(value, str) or not 64 <= len(value) <= 64000:
            raise ValueError('invalid_sealed_value')
        decoded = base64.b64decode(value, validate=True)
        if len(decoded) < 49 or base64.b64encode(decoded).decode() != value:
            raise ValueError('invalid_sealed_value')
    recipient = call('GET', 'public-key')
    if (not isinstance(recipient.get('key_id'), str) or not re.fullmatch(r'[0-9]{1,40}', recipient['key_id'])
            or len(base64.b64decode(recipient.get('key', ''), validate=True)) != 32):
        raise ValueError('github_recipient_invalid')
    if mode == 'prepare':
        # A public encryption key, not a login token or a credential.
        return {'state': 'recipient_ready', 'repository': REPOSITORY,
                'key_id': recipient['key_id'], 'key': recipient['key']}
    if request['key_id'] != recipient['key_id']:
        raise ValueError('recipient_key_changed')
    call('PUT', SECRET, {'key_id': request['key_id'], 'encrypted_value': request['encrypted_value']})
    return {'state': 'secret_written', 'connected': False, 'next': 'fresh_worker_verification_required'}

def main():
    try:
        if (os.environ.get('GITHUB_REPOSITORY') != REPOSITORY or
                os.environ.get('GITHUB_REF') != 'refs/heads/main' or os.environ.get('GITHUB_EVENT_NAME') != 'push'):
            raise ValueError('connection_owner_required')
        token = os.environ.pop('GH_TOKEN', '')
        if not token:
            raise ValueError('secret_rotation_connection_required')
        path = Path('gemini-connection.json')
        if path.is_symlink() or path.stat().st_size > 65000:
            raise ValueError('connection_request_rejected')
        request = json.loads(path.read_text())
        result = connect(request, lambda method, suffix, data=None: github(token, method, suffix, data))
        print('N80_GEMINI_CONNECTION', json.dumps(result))
    except Exception as error:
        # HTTP exception text may contain provider bodies; never echo it.
        print('N80_GEMINI_CONNECTION', json.dumps({'state':'connection_failed','errorType':type(error).__name__}))
        raise SystemExit(1)

if __name__ == '__main__': main()
