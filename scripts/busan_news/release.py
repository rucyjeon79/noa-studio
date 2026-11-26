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
FILES = {MODULE+'/'+name: ASSETS/name for name in ['news.css', 'ticker.js', 'share.js', 'recent.php', 'index.php', 'reporter.js', 'reporter-logo.svg']}
FILES['extend/busan-news.extend.php'] = ASSETS/'news.extend.php'
FILES['busan-assistant/newsroom-account-import.php'] = Path('scripts/busan_news/publish.php')
FILES['busan-assistant/newsroom-account.php'] = ASSETS/'account.php'


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


def ensure_managed_directory(s, path):
    # Only known public news-module directories may be created. Never traverse
    # symlinks or create arbitrary remote directories from input.
    permitted = (ROOT+'/busan-assistant', ROOT+'/'+MODULE, ROOT+'/extend')
    if path not in permitted:
        raise RuntimeError('Unexpected newsroom directory')
    try:
        info = s.lstat(path)
    except FileNotFoundError:
        s.mkdir(path, 0o755)
        info = s.lstat(path)
    if not stat.S_ISDIR(info.st_mode) or s.normalize(path) != path:
        raise RuntimeError('Unexpected newsroom directory state')


def main(s):
    if s.normalize(ROOT) != ROOT or s.normalize(PRIVATE) != PRIVATE:
        raise RuntimeError('Unexpected hosting account')
    # The previous release tried mkdir(parent/child) before the parent existed.
    # Verify/create the parent first, then the module and native extend dir.
    for directory in (ROOT+'/busan-assistant', ROOT+'/'+MODULE, ROOT+'/extend'):
        ensure_managed_directory(s, directory)
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
        # Diagnose the exact schema and normalize navigation before the historic
        # reward/import phase. No points or article rows are changed by these calls.
        for mode in ('preflight','menu','split'):
            req = urllib.request.Request(ORIGIN+'/busan-assistant/'+probe, data=b'[]',
                headers={'X-Busan-News':token,'Content-Type':'application/json',
                         'X-Busan-News-Deploy-Mode':mode})
            try:
                with urllib.request.urlopen(req,timeout=90) as response:
                    result=json.load(response)
            except urllib.error.HTTPError as e:
                print('BUSAN_NEWS_DEPLOY_ERROR',mode,e.code,e.headers.get('X-Busan-News-Stage'),e.headers.get('X-Busan-News-Reason'))
                raise RuntimeError('News '+mode+' failed') from None
            if not result.get('ok') or not isinstance(result.get('inventory'),dict):
                raise RuntimeError('News '+mode+' receipt invalid')
            print('BUSAN_NEWS_'+mode.upper(),json.dumps(result['inventory'],ensure_ascii=False,sort_keys=True))
            if mode=='split': print('BUSAN_NEWS_MIGRATION_RECEIPT',json.dumps(result.get('split'),ensure_ascii=False,sort_keys=True))
        for name, data in todo or [(None, b'[]')]:
            req = urllib.request.Request(ORIGIN+'/busan-assistant/'+probe, data=data,
                headers={'X-Busan-News':token, 'Content-Type':'application/json'})
            try:
                with urllib.request.urlopen(req,timeout=90) as response:
                    result=json.load(response)
            except urllib.error.HTTPError as e:
                print('Importer HTTP',e.code,'stage',e.headers.get('X-Busan-News-Stage'),'reason',e.headers.get('X-Busan-News-Reason'))
                raise RuntimeError('News import failed') from None
            if not result.get('ok'):
                raise RuntimeError('News importer returned an invalid result')
            if result.get('historical_points') is not None:
                print('BUSAN_REPORTER_RETRO_POINTS', json.dumps(result['historical_points'], sort_keys=True))
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

