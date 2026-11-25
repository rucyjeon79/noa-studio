"""Apply only the verified, locked POINT ZONE screen files via existing Busan SFTP.
No SQL, menu writes, engine upload, core changes, or NOA assets.
"""
import hashlib,hmac,json,os,socket,stat,sys
from pathlib import Path
from urllib.request import urlopen,Request
from urllib.error import HTTPError
import paramiko
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from busan_readonly_check import configuration,fingerprint,PORT,ROOT
from busan_news.release import read,write

SOURCE=Path('deploy/busan/youngcart/theme/Busan_PointZone')
PRIVATE='/hosting/rucyjeon79/busan-assistant-private'
THEME=ROOT+'/theme/Busan_PointZone'
# Git blob IDs of deployed main baseline and verified development files.
FILES={
 'lib/order-views.php':(None,'c1ef6a3c360e524613d605eb48f9a4e65cb3e451'),
 'checkout.php':(None,'dbf09feac9f34c78c986819d16c9532426fa4dd0'),
 'css/pointzone.css':('e8f683c9d672ec98cc4765b0fe7db4aba551a79f','497ee14fe3283051202f81e06a013cb3be5b4b52'),
 'shop/shop.head.php':('b3a3a05d3763d9845dc1922c16e9cc8699c7bd81','ac2e180077073fef325d9b908ec768ffc45baba9'),
 'shop/shop.tail.php':('44f60663474f2721afc4cd29d94d5cc11aff110b','d872870c6dd592cc07aceca299de2c6492061f17'),
 'shop/index.php':('73a85a4221fe3bc62bb99fdce2601edc7ef799c6','83079b43443f7afc8d990ad21ff8553de8d73fba')
}
def blob(data):
    if data is None:return None
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def digest(data):return hashlib.sha256(data).hexdigest()
def directory(s,path):
    if s.normalize(path)!=path or not stat.S_ISDIR(s.lstat(path).st_mode):raise RuntimeError('unexpected directory')
def release(s):
    for p in (ROOT,THEME,THEME+'/shop',THEME+'/css',THEME+'/lib',PRIVATE):directory(s,p)
    # Native site layout and active theme must already exist; never edit them.
    for p in (ROOT+'/head.php',ROOT+'/tail.php',ROOT+'/theme/UXC_Flarumix/head.php',ROOT+'/theme/UXC_Flarumix/tail.php'):
        if read(s,p,500000) is None:raise RuntimeError('native site layout missing')
    # This screen-only package must not enable any transaction.
    if read(s,THEME+'/lib/engine/checkout-readiness.php',100000) is not None:
        raise RuntimeError('existing checkout engine: separate review required')
    old={};new={}
    for rel,(expected,verified) in FILES.items():
        data=(SOURCE/rel).read_bytes()
        if blob(data)!=verified:raise RuntimeError('unverified source '+rel)
        before=read(s,THEME+'/'+rel,100000)
        if blob(before) not in (expected,verified):raise RuntimeError('live baseline conflict '+rel)
        old[rel]=before;new[rel]=data
    # All pre-existing changed files backed up and read back before any write.
    backups={}
    for rel,data in old.items():
        if data is None or data==new[rel]:continue
        target=PRIVATE+'/pointzone-layout-'+digest(data)+'.bak'
        saved=read(s,target,100000)
        if saved is None:write(s,target,data,0o600)
        if read(s,target,100000)!=data:raise RuntimeError('backup mismatch '+rel)
        backups[rel]=target.rsplit('/',1)[-1]
    changed=[]
    try:
        for rel,data in new.items():
            if old[rel]==data:continue
            if read(s,THEME+'/'+rel,100000)!=old[rel]:raise RuntimeError('concurrent change '+rel)
            changed.append(rel)
            write(s,THEME+'/'+rel,data,0o644)
        for rel,data in new.items():
            if read(s,THEME+'/'+rel,100000)!=data:raise RuntimeError('verification failed '+rel)
    except Exception:
        for rel in reversed(changed):
            current=read(s,THEME+'/'+rel,100000)
            if current==old[rel]:continue
            if current!=new[rel]:raise RuntimeError('rollback conflict '+rel)
            if old[rel] is None:s.remove(THEME+'/'+rel)
            else:write(s,THEME+'/'+rel,old[rel],0o644)
        raise
    print('BUSAN_POINTZONE_LAYOUT_DEPLOYED',json.dumps({'changed':changed,'backups':backups,'verified':len(new),'database_mutations':0,'engine_uploaded':False},sort_keys=True),flush=True)
if __name__=='__main__':
    host,user,password,pin=configuration(os.environ)
    with socket.create_connection((host,PORT),timeout=15) as sock,paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not hmac.compare_digest(fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host key mismatch')
        t.auth_password(user,password,fallback=False)
        with paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            release(s)
