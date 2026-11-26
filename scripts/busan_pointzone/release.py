import hashlib, hmac, json, os, secrets, socket, stat, sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import paramiko
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from busan_readonly_check import configuration, fingerprint, PORT, ROOT
from busan_news.release import read, write

ORIGIN = 'https://skhnslu-busan.com'
TARGET = ROOT + '/theme/Busan_PointZone/pointzone.php'
SOURCE = Path('deploy/busan/youngcart/theme/Busan_PointZone')
def release(s):
    if s.normalize(ROOT)!=ROOT or s.normalize(ROOT+'/theme')!=ROOT+'/theme':
        raise RuntimeError('unexpected site root')
    if not stat.S_ISDIR(s.lstat(ROOT+'/busan-assistant').st_mode):
        raise RuntimeError('unexpected assistant directory')
    theme=ROOT+'/theme/Busan_PointZone'
    paths=['pointzone.php','theme.txt','css/pointzone.css','shop/index.php','shop/shop.head.php','shop/shop.tail.php','mobile/shop/index.php','mobile/shop/shop.head.php','mobile/shop/shop.tail.php','lib/catalog.php','catalog-admin.php']
    for folder in ('','/css','/shop','/mobile','/mobile/shop','/lib'):
        dest=theme+folder
        try: s.mkdir(dest,0o755)
        except OSError: pass
        if s.normalize(dest)!=dest or not stat.S_ISDIR(s.lstat(dest).st_mode):
            raise RuntimeError('unexpected independent theme directory')
    # Check every existing file before writing any. No unrelated assets touched.
    for rel in paths:
        data=(SOURCE/rel).read_bytes()
        old=read(s,theme+'/'+rel,100000)
        if old is not None and old!=data:
            if rel!='shop/index.php' or old!=Path('scripts/busan_pointzone/previous-shop-index.php.txt').read_bytes():
                raise RuntimeError('independent theme asset conflict: '+rel)
            private='/hosting/rucyjeon79/busan-assistant-private'
            if s.normalize(private)!=private or not stat.S_ISDIR(s.lstat(private).st_mode):
                raise RuntimeError('private asset backup unavailable')
            backup=private+'/pointzone-shop-index-'+hashlib.sha256(old).hexdigest()+'.bak'
            saved=read(s,backup,100000)
            if saved is None: write(s,backup,old,0o600)
            elif saved!=old: raise RuntimeError('asset backup conflict')
            if read(s,backup,100000)!=old: raise RuntimeError('backup verification failed')
    for rel in paths:
        data=(SOURCE/rel).read_bytes()
        dest=theme+'/'+rel
        existing=read(s,dest,100000)
        if existing is None or (rel=='shop/index.php' and existing==Path('scripts/busan_pointzone/previous-shop-index.php.txt').read_bytes()):
            write(s,dest,data,0o644)
        if read(s,dest,100000)!=data: raise RuntimeError('theme asset verification failed')
    print('BUSAN_POINTZONE_CATALOG_FILES_VERIFIED',len(paths))
    page=(SOURCE/'pointzone.php').read_bytes()
    token=secrets.token_hex(32)
    source=Path('scripts/busan_pointzone/register_menu.php').read_text().replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).encode()
    name='pointzone-menu-'+secrets.token_hex(16)+'.php'
    dest=ROOT+'/busan-assistant/'+name
    try:
        with s.open(dest,'wx') as f: f.write(source)
        s.chmod(dest,0o644)
        def call(payload):
            req=Request(ORIGIN+'/busan-assistant/'+name,data=json.dumps(payload).encode(),headers={'X-Busan-Pointzone':token,'Content-Type':'application/json'})
            with urlopen(req,timeout=40) as res: return json.load(res)
        snapshot=call({'mode':'snapshot'})
        if snapshot.get('status')!='snapshot' or not isinstance(snapshot.get('snapshot'),dict):
            raise RuntimeError('menu snapshot rejected: '+str(snapshot.get('reason','unknown'))+' '+json.dumps(snapshot.get('root_order',[]),ensure_ascii=False))
        digest=snapshot.get('sha256','')
        if len(digest)!=64 or any(c not in '0123456789abcdef' for c in digest):
            raise RuntimeError('invalid menu snapshot hash')
        private='/hosting/rucyjeon79/busan-assistant-private'
        if s.normalize(private)!=private or not stat.S_ISDIR(s.lstat(private).st_mode):
            raise RuntimeError('private menu backup unavailable')
        backup=private+'/pointzone-menu-'+digest+'.json'
        data=json.dumps(snapshot['snapshot'],ensure_ascii=False,separators=(',',':')).encode()
        old=read(s,backup,100000)
        if old is None: write(s,backup,data,0o600)
        elif old!=data: raise RuntimeError('menu backup conflict')
        if read(s,backup,100000)!=data: raise RuntimeError('menu backup verification failed')
        result=call({'mode':'apply','expected_sha256':digest})
        if result.get('status')=='blocked':
            raise RuntimeError('menu migration blocked: '+str(result.get('reason','unknown')))
        if result.get('status') not in ('applied','already_current') or result.get('after')!='ETC' or result.get('menu')!='POINT ZONE' or result.get('submenus')!=['포인트 상점','지부장 이벤트','프로필 꾸미기','나의 포인트존'] or not result.get('desktop') or not result.get('mobile'):
            raise RuntimeError('unverified menu result')
        print('BUSAN_POINTZONE_MENU',json.dumps(result,ensure_ascii=False))
    finally:
        s.remove(dest)
    if read(s,TARGET,100000)!=page:
        raise RuntimeError('theme page verification failed')
    print('BUSAN_POINTZONE_THEME_VERIFIED',hashlib.sha256(page).hexdigest())

if __name__=='__main__':
    host,user,password,pin=configuration(os.environ)
    with socket.create_connection((host,PORT),timeout=15) as sock,paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),pin):
            raise RuntimeError('host key mismatch')
        t.auth_password(user,password,fallback=False)
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            release(s)
