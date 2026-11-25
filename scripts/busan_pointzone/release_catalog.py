"""Release the tested member theme and seed the seven named catalog samples."""
import base64
import json
import secrets
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import release_submenu_fix as remote
from release_shared_layout import FILES as previous_layout

catalog_baseline = {
    'shop/index.php': ('5722aaa8929947222b67851ca01043ac9059893d',),
    'lib/order-views.php': ('c1ef6a3c360e524613d605eb48f9a4e65cb3e451',),
    'css/pointzone.css': ('497ee14fe3283051202f81e06a013cb3be5b4b52',),
}

def install_sample_photos(s):
    data = remote.ROOT + '/data'
    remote.directory(s, data)
    for path in (data + '/item', data + '/item/bpz-samples'):
        try:
            remote.directory(s, path)
        except FileNotFoundError:
            s.mkdir(path, 0o755)
            remote.directory(s, path)
    for number in range(1, 8):
        name = f'sample-{number}.jpg'
        content = (Path(__file__).parent / 'catalog-images' / name).read_bytes()
        target = data + '/item/bpz-samples/' + name
        existing = remote.read(s, target, 500000)
        if existing is None:
            remote.write(s, target, content, 0o644)
        elif existing != content:
            raise RuntimeError('sample photo conflict: ' + name)
        with urlopen('https://skhnslu-busan.com/data/item/bpz-samples/' + name, timeout=15) as response:
            if response.read(500001) != content:
                raise RuntimeError('published photo mismatch: ' + name)
    print('POINTZONE_PUBLIC_SAMPLE_PHOTOS_VERIFIED', 7, flush=True)

def release(s):
    remote.directory(s, remote.THEME)
    remote.directory(s, remote.PRIVATE)
    from order_theme_package_test import stage
    with tempfile.TemporaryDirectory() as tmp:
        package = Path(tmp) / 'theme'
        stage(package)
        plan = {}
        for p in sorted(package.rglob('*')):
            if not p.is_file():
                continue
            rel = p.relative_to(package).as_posix()
            dst = remote.THEME + '/' + rel
            old = remote.read(s, dst, 500000)
            new = p.read_bytes()
            if old == new:
                continue
            allowed = {v for history in (previous_layout, remote.FILES, catalog_baseline) for v in history.get(rel, ())}
            if old is not None and remote.blob(old) not in allowed:
                raise RuntimeError('unrecognized deployed version: ' + rel)
            if old is not None:
                backup = remote.PRIVATE + '/pointzone-layout-' + remote.digest(old) + '.bak'
                if remote.read(s, backup, 500000) is None:
                    remote.write(s, backup, old, 0o600)
                if remote.read(s, backup, 500000) != old:
                    raise RuntimeError('backup verification failed')
            plan[rel] = (dst, old, new)
        engine = remote.THEME + '/lib/engine'
        try:
            remote.directory(s, engine)
        except FileNotFoundError:
            s.mkdir(engine, 0o755)
        install_sample_photos(s)
        changed = []
        try:
            for rel in sorted(plan, key=lambda key: (not key.startswith('lib/'), key=='shop/index.php', key)):
                dst, old, new = plan[rel]
                if remote.read(s, dst, 500000) != old:
                    raise RuntimeError('concurrent change: ' + rel)
                changed.append(rel)
                remote.write(s, dst, new, 0o644)
                if remote.read(s, dst, 500000) != new:
                    raise RuntimeError('write verification failed: ' + rel)
        except Exception:
            for rel in reversed(changed):
                dst, old, new = plan[rel]
                if remote.read(s, dst, 500000) != new:
                    continue
                if old is None:
                    s.remove(dst)
                else:
                    remote.write(s, dst, old, 0o644)
            raise
        print('POINTZONE_THEME_VERIFIED', len(list(package.rglob('*.php'))), 'changed',len(changed),flush=True)
    token=secrets.token_hex(32)
    name='pointzone-release-'+secrets.token_hex(16)+'.php'
    dest=remote.ROOT+'/busan-assistant/'+name
    schema=Path('deploy/busan/youngcart/schema/pointzone-activities.sql').read_bytes()
    code=Path('scripts/busan_pointzone/catalog-release.php').read_text().replace('__TOKEN_HASH__',remote.digest(token.encode())).replace('__ACTIVITY_SCHEMA__',base64.b64encode(schema).decode()).encode()
    with s.open(dest,'wx') as handle:
        handle.write(code)
    try:
        req=Request('https://skhnslu-busan.com/busan-assistant/'+name,data=b'{}',headers={'X-Busan-Release':token})
        try:
            with urlopen(req,timeout=45) as response:
                receipt=json.load(response)
        except HTTPError as error:
            print('HTTP status',error.code,flush=True)
            if error.headers.get_content_type()=='application/json':
                print('release reason:',json.load(error).get('error'))
            raise
        if receipt.get('verified')!=7:
            raise RuntimeError('catalog seed unverified')
        print('POINTZONE_CATALOG_RECEIPT',receipt)
    finally:
        s.remove(dest)

if __name__=='__main__':
    import sys
    sys.path.insert(0,str(Path('scripts/busan_youngcart').resolve()))
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock, remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not remote.hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):
            raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            release(s)
