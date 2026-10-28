"""Use the existing Drive account for a bounded private audio spool.
Only expiring access tokens reach hosting; the refresh credential stays in Actions.
"""
import configparser
import datetime
import hashlib
import json
import re
import time
import urllib.request
from pathlib import Path
from noa_drive_snapshot import DriveStore

FOLDER = '1hR8n8sH7d7ekoWqiwK11bAIYY3m9C6-l'
TOKEN_PATH = '/hosting/noastudio/noa-jukebox-private/drive-token.json'

class UploadDrive:
    def __init__(self):
        self.store = DriveStore()

    def token(self):
        self.store.require()
        # Forces rclone's existing OAuth refresh, without exporting its refresh token.
        self.store.command('lsf', 'noa-backup:', '--max-depth', '1')
        cfg = configparser.ConfigParser(interpolation=None)
        cfg.read(self.store.config)
        token = json.loads(cfg.get('noa-backup', 'token'))
        expires = int(datetime.datetime.fromisoformat(token['expiry'].replace('Z', '+00:00')).timestamp())
        if expires < time.time() + 120 or not token.get('access_token'):
            raise RuntimeError('drive_access_token_unavailable')
        return {'access_token': token['access_token'], 'expires_at': expires, 'folder_id': FOLDER}

    def request(self, path, token):
        request = urllib.request.Request('https://www.googleapis.com/drive/v3/files/' + path,
                                        headers={'Authorization': 'Bearer ' + token['access_token']})
        return urllib.request.urlopen(request, timeout=60)

    def provision(self, sftp):
        token = self.token()
        with self.request(FOLDER + '?fields=id,mimeType,capabilities', token) as response:
            folder = json.load(response)
        if folder.get('id') != FOLDER or folder.get('mimeType') != 'application/vnd.google-apps.folder' or not folder.get('capabilities', {}).get('canAddChildren'):
            raise RuntimeError('drive_upload_folder_not_writable')
        data = json.dumps(token).encode()
        temp = TOKEN_PATH + '.' + __import__('secrets').token_hex(8)
        # Create private from the first byte; never a public path or log payload.
        with sftp.open(temp, 'wx') as output:
            sftp.chmod(temp, 0o600)
            output.write(data)
        with sftp.open(temp, 'rb') as saved:
            if saved.read() != data:
                raise RuntimeError('drive_token_write_mismatch')
        sftp.posix_rename(temp, TOKEN_PATH)
        return {'folder_id': FOLDER, 'token_expires_at': token['expires_at'], 'refresh_credential_on_host': False}

    def read(self, job, destination):
        source = job['drive_source']; file_id = source.get('file_id', '')
        if not re.fullmatch(r'[A-Za-z0-9_-]{10,200}', file_id):
            raise ValueError('invalid_drive_file_id')
        token = self.token()
        with self.request(file_id + '?fields=id,size,sha256Checksum,parents,appProperties,trashed', token) as response:
            meta = json.load(response)
        if (meta.get('id') != file_id or int(meta.get('size', -1)) != job['bytes']
                or meta.get('sha256Checksum') != job['sha256'] or FOLDER not in meta.get('parents', [])
                or meta.get('appProperties', {}).get('noa_upload_id') != job['id'] or meta.get('trashed')):
            raise ValueError('drive_source_verification_failed')
        size = 0; digest = hashlib.sha256()
        with self.request(file_id + '?alt=media', token) as response, destination.open('xb') as output:
            while True:
                block = response.read(1024 * 1024)
                if not block: break
                size += len(block)
                if size > job['bytes']: raise ValueError('uploaded_input_grew')
                digest.update(block); output.write(block)
        if size != job['bytes'] or digest.hexdigest() != job['sha256']:
            raise ValueError('uploaded_input_hash_changed')
        return True
