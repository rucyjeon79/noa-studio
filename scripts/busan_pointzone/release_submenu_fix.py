"""Apply only the verified, locked POINT ZONE screen files via existing Busan SFTP.
No SQL, menu writes, engine upload, core changes, or NOA assets.
"""
import hashlib,hmac,json,os,re,socket,stat,sys
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
 'shop/index.php':('83079b43443f7afc8d990ad21ff8553de8d73fba','4b5a0fa48f2c61a375983a364412d6bfa4bceace'),
 'checkout.php':('dbf09feac9f34c78c986819d16c9532426fa4dd0','1ed230a348dffd30767f7ceca8359ce2bead12ca'),
 'catalog-admin.php':('d27a15906a15d74a9c10dc83f88c60f7e9c66674','49c2c764ff93f98b10613c4f41c9417593e63e27')
}

def blob(data):
    if data is None:return None
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def digest(data):return hashlib.sha256(data).hexdigest()
def directory(s,path):
    if s.normalize(path)!=path or not stat.S_ISDIR(s.lstat(path).st_mode):raise RuntimeError('unexpected directory')
def release(s):
    locations={'site_root':ROOT,'theme':THEME,'shop':THEME+'/shop','css':THEME+'/css','lib':THEME+'/lib','private_backup':PRIVATE}
    checks={}
    for label,p in locations.items():
        try:directory(s,p);checks[label]='present'
        except FileNotFoundError:checks[label]='missing'
        except Exception as e:checks[label]=type(e).__name__
    print('BUSAN_POINTZONE_DIRECTORY_AUDIT',json.dumps(checks,sort_keys=True),flush=True)
    # Report only scoped guest URL behavior, never authenticated session contents.
    for section in ('shop','auction','sharing','events','profile','honor','my'):
        try:
            req=Request('https://skhnslu-busan.com/theme/Busan_PointZone/pointzone.php?section='+section,headers={'User-Agent':'Busan-Pointzone-Healthcheck/1.0'})
            with urlopen(req,timeout=8) as response:
                body=response.read(100000).decode('utf-8','replace')
                print('BUSAN_POINTZONE_GUEST_ROUTE',section,response.status,'login' if '로그인' in body or 'login.php' in response.url else 'other',flush=True)
        except HTTPError as e:print('BUSAN_POINTZONE_GUEST_ROUTE',section,e.code,flush=True)
        except Exception as e:print('BUSAN_POINTZONE_GUEST_ROUTE',section,type(e).__name__,flush=True)
    if any(v!='present' for v in checks.values()):raise RuntimeError('verified directory unavailable; do not overwrite or recreate without evidence')
    # Native site layout and active theme must already exist; never edit them.
    for p in (ROOT+'/head.php',ROOT+'/tail.php',ROOT+'/theme/UXC_Flarumix/head.php',ROOT+'/theme/UXC_Flarumix/tail.php'):
        if read(s,p,500000) is None:raise RuntimeError('native site layout missing')
    # Read-only evidence of shared scope collisions; no raw site source in logs.
    collisions={}
    for rel in ('head.php','theme/UXC_Flarumix/head.php','theme/UXC_Flarumix/head.sub.php','theme/UXC_Flarumix/tail.php','theme/UXC_Flarumix/mobile/head.php'):
        body=read(s,ROOT+'/'+rel,500000)
        if body is None:continue
        names=sorted(set(m.decode() for m in re.findall(rb'\$(section|sections|base|key|item|r|rows|ready|enabled|error|csrf|viewRows|viewError)\s*=',body)))
        if names:collisions[rel]=names
    print('BUSAN_POINTZONE_SHARED_SCOPE_AUDIT',json.dumps(collisions,sort_keys=True),flush=True)
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
