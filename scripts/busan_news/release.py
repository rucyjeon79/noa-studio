import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import socket
import stat
import sys
import urllib.error
import urllib.request

import paramiko
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from busan_readonly_check import configuration, fingerprint, PORT, ROOT

ORIGIN = 'https://skhnslu-busan.com'
PRIVATE = '/hosting/rucyjeon79/busan-assistant-private'
ASSETS = Path('deploy/busan/newsroom')
MODULE = 'busan-assistant/newsroom'
FILES = {MODULE+'/'+name: ASSETS/name for name in ['news.css', 'ticker.js', 'recent.php']}
FILES['extend/busan-news.extend.php'] = ASSETS/'news.extend.php'


def read(s, path, limit):
    try:
        attrs = s.lstat(path)
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(attrs.st_mode) or s.normalize(path) != path or attrs.st_size > limit:
        raise RuntimeError('Unexpected remote file')
    with s.open(path, 'rb') as f:
        return f.read(limit + 1)


def write(s, path, data, mode):
    temp = path+'.'+secrets.token_hex(8)+'.tmp'
    try:
        with s.open(temp, 'wx') as f:
            f.write(data)
        s.chmod(temp, mode)
        try:
            s.posix_rename(temp, path)
        except FileNotFoundError:
            s.rename(temp, path)
        if read(s, path, len(data)) != data:
            raise RuntimeError('Upload verification failed')
    finally:
        try:
            s.remove(temp)
        except FileNotFoundError:
            pass


def main(s):
    if s.normalize(ROOT) != ROOT or s.normalize(PRIVATE) != PRIVATE:
        raise RuntimeError('Unexpected hosting account')
    directory = ROOT+'/'+MODULE
    try:
        s.mkdir(directory, 0o755)
    except OSError:
        if s.normalize(directory) != directory or not stat.S_ISDIR(s.lstat(directory).st_mode):
            raise
    manifest_path = PRIVATE+'/newsroom-manifest.json'
    manifest = json.loads(read(s, manifest_path, 1500000) or b'{}')
    tracked = manifest.setdefault('assets', {})
    receipts = manifest.setdefault('editions', {})
    digest = lambda b: hashlib.sha256(b).hexdigest()
    for name, source in FILES.items():
        data = source.read_bytes()
        dest = ROOT+'/'+name
        old = read(s, dest, 100000)
        if old != data:
            if old is not None and digest(old) != tracked.get(name):
                raise RuntimeError('Unmanaged asset: '+name)
            write(s, dest, data, 0o644)
        tracked[name] = digest(data)
    write(s, manifest_path, json.dumps(manifest).encode(), 0o600)

    sources = {}
    for folder in [Path('newsroom/editions'), Path('editions-copy/newsroom/editions')]:
        for path in sorted(folder.glob('*.json')):
            if path.is_symlink() or not re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}-[a-z0-9-]{1,80}\.json', path.name) or path.stat().st_size > 450000:
                raise RuntimeError('Invalid edition file')
            data = path.read_bytes()
            if path.name in sources and sources[path.name] != data:
                raise RuntimeError('Conflicting edition')
            sources[path.name] = data
    todo = []
    for name, data in sources.items():
        if name in receipts and receipts[name] != digest(data):
            raise RuntimeError('Published editions are immutable: '+name)
        if name not in receipts:
            todo.append((name, data))
    token = secrets.token_hex(32)
    probe = 'news-import-'+secrets.token_hex(16)+'.php'
    dest = ROOT+'/busan-assistant/'+probe
    worker = Path('scripts/busan_news/publish.php').read_text().replace('__TOKEN_HASH__', digest(token.encode())).encode()
    try:
        with s.open(dest, 'wx') as f:
            f.write(worker)
        s.chmod(dest, 0o644)
        for name, data in todo or [(None, b'[]')]:
            req = urllib.request.Request(ORIGIN+'/busan-assistant/'+probe, data=data,
                headers={'X-Busan-News':token, 'Content-Type':'application/json'})
            try:
                with urllib.request.urlopen(req,timeout=90) as response:
                    result=json.load(response)
            except urllib.error.HTTPError as e:
                print('Importer HTTP',e.code,e.read(320).decode(errors='replace'))
                raise RuntimeError('News import failed') from None
            if not result.get('ok'):
                raise RuntimeError('News importer returned an invalid result')
            if name:
                receipts[name]=digest(data)
                write(s, manifest_path, json.dumps(manifest).encode(), 0o600)
                print('Edition verified',name,'new posts',sum(x['created'] for x in result['rows']), 'IDs', [x['id'] for x in result['rows']])
    finally:
        s.remove(dest)


if __name__ == '__main__':
    host,user,password,pin=configuration(os.environ)
    with socket.create_connection((host, PORT), timeout=15) as sock, paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),pin):
            raise RuntimeError('Host key mismatch')
        t.auth_password(user,password,fallback=False)
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            main(s)
