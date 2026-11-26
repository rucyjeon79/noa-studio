"""Enable native catalog editing only; no order, deletion, or point mutation."""
import hmac,hashlib,subprocess,tempfile
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import release_submenu_fix as remote
from release_native_catalog_admin import lint,response
BASE=Path('deploy/busan/youngcart')
FILES=[
 ('extend/bpz-native-catalog-guard.extend.php',BASE/'native-catalog-guard.extend.php','8acce018273339bea7862797b04f7f03af124128'),
 ('data/bpz-native-catalog-config.php',BASE/'native-catalog-config.php','2525ba658b7e87658f8b3dc6f0b4ee173e52b53e')]
STOCK={'itemformupdate.php':'9543b568f98a9e5362b5c42bc8f2f4fe69a46b56','itemlistupdate.php':'0bb4d393b53016b7c23152df39ac9c1944e3b797','categoryformupdate.php':'7409eb9d48444e137e6a22dbf3a0975fdfcf1c8a','categorylistupdate.php':'dbf5571b5c876c6666677f029a8710a7fd740f17','ajax.it_id.php':'8259a317e55185db99982e184c21b564ba1e1e55','ajax.ca_id.php':'972eafed4864dafc06b253d8677186efce4d2a19','ajax.skinfile.php':'608c1d6f87393d017736dd5ccc8650f9d9795459'}
def blob(data):return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def test_scope():
    with tempfile.TemporaryDirectory() as tmp:
        root=Path(tmp);data=root/'data';data.mkdir();admin=root/'adm/shop_admin';admin.mkdir(parents=True);shop=root/'shop';shop.mkdir()
        config=data/'config.php';config.write_bytes(FILES[1][1].read_bytes())
        for folder,name,method,expected in [(admin,'itemlist.php','GET','view'),(admin,'itemformupdate.php','POST','edit'),(admin,'itemformupdate.php','GET','off'),(admin,'orderformupdate.php','POST','off'),(shop,'list.php','GET','view'),(shop,'cartupdate.php','POST','off'),(shop,'orderformupdate.php','POST','off')]:
            p=folder/name;p.write_text("<?php define('_GNUBOARD_',true);define('G5_IS_SHOP_ADMIN_PAGE',"+('true' if folder==admin else 'false')+");$_SERVER['SCRIPT_FILENAME']=__FILE__;$_SERVER['REQUEST_METHOD']='"+method+"';require '"+str(config)+"';echo defined('BPZ_NATIVE_CATALOG_ADMIN_EDIT')?'edit':(defined('G5_USE_SHOP')?'view':'off');")
            if subprocess.check_output(['php',str(p)]).decode()!=expected:raise RuntimeError('scope test failed')
    print('BUSAN_NATIVE_EDIT_SCOPE_OK',flush=True)
def release(s):
    for directory in ('data','extend','adm/shop_admin'):remote.directory(s,remote.ROOT+'/'+directory)
    remote.directory(s,remote.PRIVATE)
    for name,expected in STOCK.items():
        data=remote.read(s,remote.ROOT+'/adm/shop_admin/'+name,500000)
        if data is None or blob(data)!=expected:raise RuntimeError('installed stock route differs: '+name)
    plan=[]
    for rel,source,expected in FILES:
        new=source.read_bytes();lint(new)
        target=remote.ROOT+'/'+rel;old=remote.read(s,target,100000)
        if old==new:continue
        if old is None or blob(old)!=expected:raise RuntimeError('live version conflict: '+rel)
        backup=remote.PRIVATE+'/pointzone-native-'+remote.digest(old)+'.bak'
        if remote.read(s,backup,100000) is None:remote.write(s,backup,old,0o600)
        if remote.read(s,backup,100000)!=old:raise RuntimeError('backup verification failed')
        plan.append((target,old,new))
    changed=[]
    try:
        for target,old,new in plan:
            if remote.read(s,target,100000)!=old:raise RuntimeError('concurrent edit')
            changed.append((target,old,new));remote.write(s,target,new,0o644)
        for name in STOCK:
            req=Request('https://skhnslu-busan.com/adm/shop_admin/'+name,data=b'',headers={'Content-Type':'application/x-www-form-urlencoded'})
            try:
                with urlopen(req,timeout=15) as r:status=r.status
            except HTTPError as e:status=e.code
            if status!=403:raise RuntimeError('guest write route not denied: '+name+' '+str(status))
        for path in ('','shop/list.php?ca_id=z9','adm/shop_admin/itemlist.php','shop/orderform.php','shop/orderformupdate.php','shop/cartupdate.php'):
            status,body,url=response(path)
            if status>=500 or 'Fatal error' in body:raise RuntimeError('route failed: '+path)
            if path.startswith(('shop/order','shop/cartupdate')) and '쇼핑몰 설치 후 이용해 주십시오' not in body:raise RuntimeError('transaction route unlocked')
        print('BUSAN_NATIVE_CATALOG_EDIT_RELEASE',{'stock_routes_verified':len(STOCK),'guest_posts_denied':len(STOCK),'changed':len(changed),'authenticated_save':'unverified','delete_enabled':False,'point_mutations':0},flush=True)
    except Exception:
        for target,old,new in reversed(changed):
            if remote.read(s,target,100000)!=new:raise RuntimeError('rollback conflict')
            remote.write(s,target,old,0o644)
        raise
if __name__=='__main__':
    test_scope()
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);release(s)
