"""Deploy native Youngcart member catalogue only, keeping all transactions locked."""
import hashlib,hmac,json,secrets,stat
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import release_submenu_fix as remote
from release_native_catalog_admin import lint,response,INCLUDE
BASE=Path('deploy/busan/youngcart')
CONFIG='data/bpz-native-catalog-config.php'
ENTRY='theme/Busan_PointZone/pointzone.php'
FILES={
 'extend/bpz-native-catalog-guard.extend.php':BASE/'native-catalog-guard.extend.php',
 'theme/UXC_Flarumix/shop/shop.head.php':BASE/'native-catalog-theme-head.php',
 'theme/UXC_Flarumix/shop/shop.tail.php':BASE/'native-catalog-theme-tail.php',
 'theme/UXC_Flarumix/mobile/shop/shop.head.php':BASE/'native-catalog-theme-head.php',
 'theme/UXC_Flarumix/mobile/shop/shop.tail.php':BASE/'native-catalog-theme-tail.php',
 CONFIG:BASE/'native-catalog-config.php',
 ENTRY:BASE/'theme/Busan_PointZone/pointzone.php',
}
BASELINES={CONFIG:'f68c3c273918b68d33caa2a18b925f3b2f0300f2',ENTRY:'e09b76e699497f3cdaa12dbe03894c590b15d024'}
def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def check_guest(path,kind):
    status,body,url=response(path)
    if status>=500 or 'Fatal error' in body:raise RuntimeError('route failed: '+path)
    if kind=='login':
        if not(status in (401,403) or 'login.php' in url or '로그인' in body or '권한' in body):raise RuntimeError('guest access not denied: '+path)
        if '쇼핑몰 설치 후 이용해 주십시오' in body:raise RuntimeError('native route still disabled: '+path)
    elif kind=='locked':
        if '쇼핑몰 설치 후 이용해 주십시오' not in body:raise RuntimeError('order route not locked: '+path)
    print('BUSAN_NATIVE_ROUTE',path,status,kind,flush=True)
def release(s):
    for rel in ('data','extend','theme/UXC_Flarumix','theme/UXC_Flarumix/mobile','theme/Busan_PointZone','shop','mobile/shop','skin/shop/basic','mobile/skin/shop/basic','busan-assistant'):
        remote.directory(s,remote.ROOT+'/'+rel)
    remote.directory(s,remote.PRIVATE)
    # Validate original installed skin files, including the actual catalogue and detail skins.
    for prefix in ('skin/shop/basic','mobile/skin/shop/basic'):
        for filename in ('list.10.skin.php','item.form.skin.php','style.css'):
            if remote.read(s,remote.ROOT+'/'+prefix+'/'+filename,1000000) is None:raise RuntimeError('stock skin missing: '+prefix+'/'+filename)
    dbconfig=remote.read(s,remote.ROOT+'/data/dbconfig.php',100000)
    if dbconfig is None or INCLUDE not in dbconfig:raise RuntimeError('native config include missing')
    plan={}
    for rel,source in FILES.items():
        new=source.read_bytes();lint(new)
        old=remote.read(s,remote.ROOT+'/'+rel,100000)
        if old==new:continue
        if rel in BASELINES:
            if old is None or blob(old)!=BASELINES[rel]:raise RuntimeError('unrecognized existing version: '+rel)
        elif old is not None:raise RuntimeError('theme/guard conflict: '+rel)
        if old is not None:
            backup=remote.PRIVATE+'/pointzone-native-'+remote.digest(old)+'.bak'
            if remote.read(s,backup,100000) is None:remote.write(s,backup,old,0o600)
            if remote.read(s,backup,100000)!=old:raise RuntimeError('backup failed')
        plan[rel]=(old,new)
    for rel in ('theme/UXC_Flarumix/shop','theme/UXC_Flarumix/mobile/shop'):
        try:remote.directory(s,remote.ROOT+'/'+rel)
        except FileNotFoundError:
            s.mkdir(remote.ROOT+'/'+rel,0o755);remote.directory(s,remote.ROOT+'/'+rel)
    token=secrets.token_hex(32);name='native-catalog-settings-'+secrets.token_hex(16)+'.php'
    dest=remote.ROOT+'/busan-assistant/'+name
    worker=Path('scripts/busan_pointzone/native_catalog_settings.php').read_text().replace('__TOKEN_HASH__',remote.digest(token.encode())).encode()
    lint(worker)
    changed=[];before=None;settings_changed=False
    def settings(action,data=None):
        req=Request('https://skhnslu-busan.com/busan-assistant/'+name,data=json.dumps(data or {}).encode(),headers={'X-Busan-Release':token,'X-Busan-Action':action,'Content-Type':'application/json'})
        try:
            with urlopen(req,timeout=30) as r:res=json.load(r)
        except HTTPError as e:
            try:reason=json.load(e).get('error','unknown')
            except Exception:reason='unavailable'
            raise RuntimeError('catalog settings '+action+': '+str(reason)) from None
        if res.get('ok') is not True:raise RuntimeError('catalog settings failed')
        return res
    try:
        with s.open(dest,'wx') as f:f.write(worker)
        s.chmod(dest,0o644)
        report=settings('inspect')
        before=report['before']
        snapshot=json.dumps(before,ensure_ascii=False,sort_keys=True).encode()
        bk=remote.PRIVATE+'/pointzone-native-catalog-settings-'+remote.digest(snapshot)+'.json'
        if remote.read(s,bk,100000) is None:remote.write(s,bk,snapshot,0o600)
        if remote.read(s,bk,100000)!=snapshot:raise RuntimeError('settings backup failed')
        result=settings('apply')
        settings_changed=True
        if result['before']!=before:raise RuntimeError('settings changed concurrently')
        for rel,(old,new) in plan.items():
            target=remote.ROOT+'/'+rel
            if remote.read(s,target,100000)!=old:raise RuntimeError('file changed concurrently: '+rel)
            changed.append(rel);remote.write(s,target,new,0o644)
            if remote.read(s,target,100000)!=new:raise RuntimeError('verify failed: '+rel)
        for path in ('shop/list.php?ca_id=z9&device=pc','shop/list.php?ca_id=z9&device=mobile','shop/item.php?it_id=f1000000000000000001&device=pc','shop/item.php?it_id=f1000000000000000001&device=mobile','adm/shop_admin/itemlist.php'):
            check_guest(path,'login')
        for path in ('shop/orderform.php','shop/orderformupdate.php','shop/cartupdate.php'):
            check_guest(path,'locked')
        status,body,_=response('')
        if status>=400 or 'Fatal error' in body:raise RuntimeError('homepage verification failed')
        print('BUSAN_NATIVE_MEMBER_CATALOG_RELEASE',{'sample_rows':result['samples'],'files_verified':len(FILES),'changed':len(changed),'native_catalog_enabled':True,'authenticated_render':'unverified','checkout_locked':True,'homepage_http':status,'point_mutations':0},flush=True)
    except Exception:
        for rel in reversed(changed):
            old,new=plan[rel];target=remote.ROOT+'/'+rel
            if remote.read(s,target,100000)!=new:raise RuntimeError('rollback conflict: '+rel)
            if old is None:s.remove(target)
            else:remote.write(s,target,old,0o644)
        if settings_changed:settings('restore',before)
        print('BUSAN_NATIVE_MEMBER_ROLLBACK_VERIFIED',len(changed),flush=True)
        raise
    finally:
        try:s.remove(dest)
        except FileNotFoundError:pass
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            release(s)
