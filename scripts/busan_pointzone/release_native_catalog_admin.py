"""Enable existing Youngcart catalog admin views only, with verified backup.
Never enable checkout, public shop routes, payment or write requests.
"""
import hmac,re,stat,subprocess,tempfile
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import release_submenu_fix as remote

FRAGMENT=Path('deploy/busan/youngcart/native-catalog-config.php').read_bytes()
INCLUDE=b"\n// Busan native Youngcart catalog admin integration.\nrequire_once __DIR__.'/bpz-native-catalog-config.php';\n"
def lint(data):
    with tempfile.TemporaryDirectory() as tmp:
        f=Path(tmp)/'config.php'
        f.write_bytes(data);f.chmod(0o600)
        if subprocess.run(['php','-l',str(f)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
            raise RuntimeError('PHP syntax validation failed')
def patch_config(old):
    if INCLUDE in old:return old
    if not old.lstrip().startswith(b'<?php') or re.search(rb'G5_USE_SHOP|G5_SHOP_TABLE_PREFIX|g5_shop_[A-Za-z_]+_table',old):
        raise RuntimeError('unexpected shop configuration; no overwrite')
    if old.rstrip().endswith(b'?>'):
        end=old.rfind(b'?>')
        return old[:end]+INCLUDE+old[end:]
    if b'?>' in old:raise RuntimeError('ambiguous configuration structure')
    return old+INCLUDE
def test_scope():
    lint(FRAGMENT)
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp);data=root/'data';data.mkdir()
        admin=root/'adm'/'shop_admin';admin.mkdir(parents=True)
        shop=root/'shop';shop.mkdir()
        (data/'bpz-native-catalog-config.php').write_bytes(FRAGMENT)
        config=data/'dbconfig.php';config.write_bytes(patch_config(b"<?php\n$g5=[];\n?>"))
        for folder,name,method,expected in ((admin,'itemlist.php','GET',True),(admin,'itemform.php','GET',True),(admin,'itemform.php','POST',False),(admin,'itemformupdate.php','POST',False),(admin,'orderform.php','GET',False),(shop,'item.php','GET',False),(shop,'orderformupdate.php','POST',False)):
            f=folder/name
            f.write_text("<?php define('_GNUBOARD_',true);define('G5_IS_SHOP_ADMIN_PAGE',"+('true' if folder==admin else 'false')+");$_SERVER['SCRIPT_FILENAME']=__FILE__;$_SERVER['REQUEST_METHOD']='"+method+"';require '"+str(config)+"';echo defined('G5_USE_SHOP')&&G5_USE_SHOP&&($g5['g5_shop_item_table']??'')==='yc5_item'?'enabled':'disabled';")
            result=subprocess.check_output(['php',str(f)]).decode().strip()
            if result!=('enabled' if expected else 'disabled'):raise RuntimeError('route scope test failed')
    print('BUSAN_NATIVE_CATALOG_SCOPE_TEST_OK',flush=True)
def response(path):
    try:
        with urlopen(Request('https://skhnslu-busan.com/'+path,headers={'User-Agent':'Busan-native-catalog-check/1.0'}),timeout=15) as r:
            return r.status,r.read(150000).decode('utf-8','replace'),r.url
    except HTTPError as e:
        return e.code,e.read(150000).decode('utf-8','replace'),e.url
def release(s):
    for p in (remote.ROOT,remote.ROOT+'/data',remote.ROOT+'/adm/shop_admin',remote.PRIVATE):remote.directory(s,p)
    # Reuse existing official files; never alter admin authentication.
    for name in ('_common.php','itemlist.php','itemform.php'):
        if remote.read(s,remote.ROOT+'/adm/shop_admin/'+name,500000) is None:raise RuntimeError('native catalog path unavailable')
    conf=remote.ROOT+'/data/dbconfig.php';fragment=remote.ROOT+'/data/bpz-native-catalog-config.php'
    old=remote.read(s,conf,100000)
    if old is None:raise RuntimeError('configuration unavailable')
    old_fragment=remote.read(s,fragment,100000)
    if old_fragment not in (None,FRAGMENT):raise RuntimeError('configuration fragment conflict')
    new=patch_config(old);lint(new)
    mode=stat.S_IMODE(s.lstat(conf).st_mode)
    backup=remote.PRIVATE+'/pointzone-native-config-'+remote.digest(old)+'.bak'
    if old!=new:
        if remote.read(s,backup,100000) is None:remote.write(s,backup,old,0o600)
        if remote.read(s,backup,100000)!=old:raise RuntimeError('config backup mismatch')
    changed=[]
    try:
        if old_fragment is None:
            remote.write(s,fragment,FRAGMENT,0o644);changed.append((fragment,None,FRAGMENT,0o644))
        if remote.read(s,fragment,100000)!=FRAGMENT:raise RuntimeError('fragment verification')
        if new!=old:
            if remote.read(s,conf,100000)!=old:raise RuntimeError('configuration changed concurrently')
            remote.write(s,conf,new,mode);changed.append((conf,old,new,mode))
        if remote.read(s,conf,100000)!=new:raise RuntimeError('config verification')
        # A guest may only see denial/login. Do not print private page bodies.
        status,body,url=response('adm/shop_admin/itemlist.php')
        denied=(status in (401,403) or 'login.php' in url or '로그인' in body or '권한' in body)
        if status>=500 or not denied or '쇼핑몰 설치 후 이용해 주십시오' in body:
            raise RuntimeError('native admin access verification failed')
        status2,body2,_=response('shop/orderform.php')
        if status2>=500 or '쇼핑몰 설치 후 이용해 주십시오' not in body2:
            raise RuntimeError('checkout gate verification failed')
        status3,body3,_=response('')
        if status3>=400 or 'Fatal error' in body3:raise RuntimeError('homepage verification failed')
        print('BUSAN_NATIVE_CATALOG_ADMIN_RELEASE',{'config_verified':True,'native_admin_guest_denied':True,'checkout_disabled':True,'homepage_http':status3,'authenticated_product_view':'unverified','changed':len(changed),'point_mutations':0},flush=True)
    except Exception:
        for path,before,after,permissions in reversed(changed):
            if remote.read(s,path,100000)!=after:raise RuntimeError('rollback conflict')
            if before is None:s.remove(path)
            else:remote.write(s,path,before,permissions)
        raise
if __name__=='__main__':
    test_scope()
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            release(s)
