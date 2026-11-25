import hashlib, hmac, json, os, secrets, socket, stat, sys
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError
import paramiko
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from busan_readonly_check import configuration, fingerprint, PORT, ROOT
from busan_news.release import read, write

ORIGIN = 'https://skhnslu-busan.com'
TARGET = ROOT + '/theme/UXC_Flarumix/pointzone.php'
def release(s):
    if s.normalize(ROOT) != ROOT or s.normalize(str(Path(TARGET).parent)) != str(Path(TARGET).parent):
        raise RuntimeError('unexpected site root')
    if not stat.S_ISDIR(s.lstat(ROOT+'/busan-assistant').st_mode):
        raise RuntimeError('unexpected assistant directory')
    page = Path('deploy/busan/pointzone/pointzone.php').read_bytes()
    old = read(s, TARGET, 100000)
    if old is None:
        write(s, TARGET, page, 0o644)
    elif old != page:
        raise RuntimeError('point zone page already exists with different content')
    token=secrets.token_hex(32)
    source=Path('scripts/busan_pointzone/register_menu.php').read_text().replace('__TOKEN_HASH__',hashlib.sha256(token.encode()).hexdigest()).encode()
    name='pointzone-menu-'+secrets.token_hex(16)+'.php'
    dest=ROOT+'/busan-assistant/'+name
    try:
        with s.open(dest,'wx') as f: f.write(source)
        s.chmod(dest,0o644)
        req=Request(ORIGIN+'/busan-assistant/'+name,data=b'{}',headers={'X-Busan-Pointzone':token,'Content-Type':'application/json'})
        try:
            with urlopen(req,timeout=40) as res: result=json.load(res)
        except HTTPError as error:
            print('POINTZONE_MENU_BLOCKED',error.code,error.read(300).decode(errors='replace'))
            raise RuntimeError('menu registration rejected') from None
        if result.get('status') not in ('applied','already_current') or result.get('after')!='ETC' or result.get('menu')!='POINT ZONE' or not result.get('desktop') or not result.get('mobile'):
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
