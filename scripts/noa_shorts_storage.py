"""N80-owned generated media spool, using the existing private Drive connection.

Reserve Drive IDs in N80 before creating anything. Reconcile the same IDs after
timeouts. No source duplication, model approval, publication or deletion here.
"""
import base64
import hashlib
import json
import re
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from noa_shorts_assembly import CHUNK, MAX_BYTES, digest, retry
from noa_upload_drive import UploadDrive

API = 'https://www.googleapis.com/drive/v3/files'
FIELDS = 'id,mimeType,parents,appProperties,size,sha256Checksum,trashed,shared,ownedByMe'
FOLDER = 'application/vnd.google-apps.folder'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, url):
        raise ValueError('drive_redirect_rejected')


class MediaDrive:
    def __init__(self):
        self.login = UploadDrive()
        self.credentials = None
        self.opener = urllib.request.build_opener(NoRedirect())

    def open(self, url, method='GET', data=None, headers=None):
        parsed = urllib.parse.urlsplit(url)
        if (parsed.scheme != 'https' or parsed.netloc != 'www.googleapis.com'
                or not parsed.path.startswith(('/drive/v3/', '/upload/drive/v3/'))):
            raise ValueError('drive_endpoint_rejected')
        if not self.credentials or self.credentials['expires_at'] < time.time() + 120:
            self.credentials = self.login.token()
        request = urllib.request.Request(url, data=data, method=method, headers={
            **(headers or {}), 'Authorization': 'Bearer ' + self.credentials['access_token']})
        return self.opener.open(request, timeout=90)

    def metadata(self, file_id):
        if not re.fullmatch(r'[A-Za-z0-9_-]{10,200}', file_id):
            raise ValueError('invalid_drive_id')
        try:
            with self.open(API + '/' + file_id + '?fields=' + FIELDS) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise

    def ids(self, count):
        with self.open(API + '/generateIds?count=' + str(count) + '&space=drive&type=files') as response:
            ids = json.load(response)['ids']
        if len(ids) != count or len(set(ids)) != count or any(not re.fullmatch(r'[A-Za-z0-9_-]{10,200}', x) for x in ids):
            raise ValueError('drive_ids_invalid')
        return ids

    @staticmethod
    def verify(meta, file_id, parent=None, properties=None, folder=False):
        if (not meta or meta.get('id') != file_id or meta.get('trashed') is not False
                or meta.get('shared') is not False or meta.get('ownedByMe') is not True
                or (folder and meta.get('mimeType') != FOLDER)
                or (parent and meta.get('parents') != [parent])
                or (properties and meta.get('appProperties') != properties)):
            raise ValueError('drive_ownership_mismatch')

    def ensure_folder(self, claim):
        parent, folder = claim['parentFolderId'], claim['folderId']
        self.verify(self.metadata(parent), parent, folder=True)
        properties = {'n80_job': claim['id'], 'n80_source': claim['sourceAudioSha256']}
        meta = self.metadata(folder)
        if meta is None:
            body = {'id': folder, 'name': claim['title'][:100] + '_쇼츠', 'mimeType': FOLDER,
                    'parents': [parent], 'appProperties': properties}
            try:
                with self.open(API, 'POST', json.dumps(body).encode(), {'Content-Type': 'application/json'}) as response:
                    response.read()
            except urllib.error.HTTPError as error:
                if error.code != 409:
                    raise
            meta = self.metadata(folder)
        self.verify(meta, folder, parent, properties, folder=True)

    def store(self, claim, source):
        self.ensure_folder(claim)
        row = claim['asset']; asset = row['asset']; file_id = claim['fileId']
        properties = {'n80_job': claim['id'], 'n80_source': claim['sourceAudioSha256'],
                      'n80_asset': claim['key']}
        mime = {'png': 'image/png', 'jpg': 'image/jpeg', 'webp': 'image/webp', 'mp4': 'video/mp4'}[asset['file'].rsplit('.', 1)[1]]
        meta = self.metadata(file_id)
        if meta is None:
            extension = asset['file'].rsplit('.', 1)[1]
            name = ('완성본' if row['kind'] == 'final' else '장면_' + str(row['scene']).zfill(2)) + '.' + extension
            body = {'id': file_id, 'name': name, 'mimeType': mime,
                    'parents': [claim['folderId']], 'appProperties': properties}
            try:
                with self.open('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
                               'POST', json.dumps(body).encode(), {'Content-Type': 'application/json',
                               'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': str(asset['bytes'])}) as response:
                    location = response.headers['Location']
                offset = 0
                with source.open('rb') as data:
                    while block := data.read(8 * 1048576):
                        end = offset + len(block)
                        try:
                            with self.open(location, 'PUT', block, {'Content-Type': mime,
                                           'Content-Range': f'bytes {offset}-{end-1}/{asset["bytes"]}'}) as response:
                                response.read()
                                if end != asset['bytes']:
                                    raise ValueError('drive_early_completion')
                        except urllib.error.HTTPError as error:
                            if error.code != 308 or end == asset['bytes'] or error.headers.get('Range') != f'bytes=0-{end-1}':
                                raise
                        offset = end
            except urllib.error.HTTPError as error:
                if error.code != 409:
                    raise
            meta = self.metadata(file_id)
        self.verify(meta, file_id, claim['folderId'], properties)
        if (meta.get('mimeType') != mime or meta.get('sha256Checksum') != asset['sha256']
                or int(meta.get('size', -1)) != asset['bytes']):
            raise ValueError('drive_content_mismatch')
        measured = hashlib.sha256(); size = 0
        with self.open(API + '/' + file_id + '?alt=media') as response:
            while block := response.read(1048576):
                size += len(block)
                if size > asset['bytes']:
                    raise ValueError('drive_readback_size_mismatch')
                measured.update(block)
        if size != asset['bytes'] or measured.hexdigest() != asset['sha256']:
            raise ValueError('drive_readback_checksum_mismatch')
        # Check current privacy/ownership again after downloading all bytes.
        self.verify(self.metadata(file_id), file_id, claim['folderId'], properties)
        return {'fileId': file_id, 'folderId': claim['folderId'], 'sha256': asset['sha256'],
                'bytes': size, 'readbackVerified': True, 'privateVerified': True}


def transfer(dispatch, claim, drive):
    auth = {k: claim[k] for k in ('id', 'key', 'lease')}

    def call(command, **fields):
        return dispatch(command, **auth, **fields)

    stage = 'storage_reserve'
    try:
        missing = [k for k in ('folderId', 'fileId') if not claim.get(k)]
        if missing:
            claim.update(dict(zip(missing, drive.ids(len(missing)))))
        # Persist all external identities BEFORE any Drive creation/upload.
        reserved = retry(call, 'storage_reserve', folderId=claim['folderId'], fileId=claim['fileId'])
        if any(reserved.get(k) != claim[k] for k in ('folderId', 'fileId')):
            raise ValueError('storage_reservation_mismatch')
        stage = 'storage_download'; asset = claim['asset']['asset']
        with tempfile.TemporaryDirectory(prefix='n80-generated-') as name:
            path = Path(name) / 'asset'; offset = 0
            with path.open('xb') as output:
                path.chmod(0o600)
                while True:
                    row = retry(call, 'storage_read', offset=offset)
                    block = base64.b64decode(row['data'], validate=True)
                    if (row['sha256'] != asset['sha256'] or row['bytes'] != asset['bytes']
                            or not 1 <= row['bytes'] <= MAX_BYTES or row['offset'] != offset
                            or not 1 <= len(block) <= CHUNK or row['nextOffset'] != offset + len(block)
                            or row['nextOffset'] > row['bytes'] or row['done'] is not (row['nextOffset'] == row['bytes'])):
                        raise ValueError('storage_input_invalid')
                    output.write(block); offset += len(block)
                    if row['done']:
                        break
            if digest(path) != asset['sha256']:
                raise ValueError('storage_input_checksum_mismatch')
            stage = 'storage_drive'
            receipt = drive.store(claim, path)
            stage = 'storage_receipt'
            result = retry(call, 'storage_complete', receipt=receipt)
            if result.get('state') != 'stored' or result.get('fileId') != claim['fileId']:
                raise ValueError('storage_receipt_missing')
        # Original N80 media is retained on every path; only this disposable
        # transfer copy is removed. Drive media is retained until verified public.
        return {'state': 'stored', 'kind': claim['asset']['kind'], 'scene': claim['asset']['scene']}
    except Exception as error:
        reason = stage + '_failed'
        try:
            call('storage_fail', reason=reason)
        except Exception:
            pass
        return {'state': 'storage_failed', 'reason': reason, 'errorType': type(error).__name__,
                'httpStatus': getattr(error, 'code', None)}


def run_storage(dispatch, drive=None):
    results = []
    try:
        # Existing worker invocation owns this bounded loop, never another timer.
        for _ in range(3):
            claim = dispatch('storage_claim')
            if not claim.get('claimed'):
                results.append({'state': claim['state']}); break
            drive = drive or MediaDrive()
            result = transfer(dispatch, claim, drive); results.append(result)
            if result['state'] != 'stored':
                break
    except Exception as error:
        results.append({'state': 'storage_dependency_failed', 'errorType': type(error).__name__})
    print('N80_SHORTS_STORAGE', json.dumps(results), flush=True)
    return results
