"""Restore only exact failed member-catalog release assets, retain native admin configuration."""
import hmac,hashlib
from pathlib import Path
import release_submenu_fix as remote
from release_native_catalog_admin import response,lint
BASE=Path('deploy/busan/youngcart')
OLD_CONFIG=b'''<?php
// Loaded by the existing dbconfig.php; no separate authentication or order engine.
if (!defined('_GNUBOARD_')) exit;
if (!defined('G5_IS_SHOP_ADMIN_PAGE') || G5_IS_SHOP_ADMIN_PAGE !== true) return;
$bpz_native_script = realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? ''));
$bpz_native_admin = realpath(__DIR__.'/../adm/shop_admin');
if ($bpz_native_script === false || $bpz_native_admin === false || dirname($bpz_native_script) !== $bpz_native_admin) return;
// Phase 1: existing native catalogue views only; no checkout, payment or order changes.
if (!in_array(basename($bpz_native_script), ['itemlist.php','itemform.php','categorylist.php','categoryform.php'], true)) return;
if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET','HEAD'], true)) return;
if (defined('G5_USE_SHOP') || defined('G5_SHOP_TABLE_PREFIX')) return;
define('G5_USE_SHOP', true);
define('G5_SHOP_TABLE_PREFIX', 'yc5_');
foreach (['default','banner','cart','category','event','event_item','item','item_option','item_use','item_qa','item_relation','order','order_delete','wish','coupon','coupon_zone','coupon_log','sendcost','personalpay','order_address','item_stocksms','order_data','inicis_log'] as $bpz_native_suffix) {
    $g5['g5_shop_'.$bpz_native_suffix.'_table'] = G5_SHOP_TABLE_PREFIX.$bpz_native_suffix;
}
$g5['g5_shop_post_log_table'] = G5_SHOP_TABLE_PREFIX.'order_post_log';
unset($bpz_native_script,$bpz_native_admin,$bpz_native_suffix);
'''
def blob(data):
    return hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
def recover(s):
    remote.directory(s,remote.ROOT);remote.directory(s,remote.PRIVATE)
    old_entry=Path('scripts/busan_pointzone/native-catalog-last-good-entry.php').read_bytes()
    if blob(old_entry)!='e09b76e699497f3cdaa12dbe03894c590b15d024' or blob(OLD_CONFIG)!='f68c3c273918b68d33caa2a18b925f3b2f0300f2':raise RuntimeError('baseline mismatch')
    targets=[('theme/Busan_PointZone/pointzone.php',old_entry,BASE/'theme/Busan_PointZone/pointzone.php'),('data/bpz-native-catalog-config.php',OLD_CONFIG,BASE/'native-catalog-config.php')]
    # Restore the last working member entry first; do not touch shared session settings.
    restored=[]
    for rel,good,failed in targets:
        dest=remote.ROOT+'/'+rel
        current=remote.read(s,dest,100000)
        if current==good:continue
        if blob(current or b'') not in {'theme/Busan_PointZone/pointzone.php':('e1e4cd0b44b9685756cc0447ffb44623a40c888b',),'data/bpz-native-catalog-config.php':('2525ba658b7e87658f8b3dc6f0b4ee173e52b53e',)}[rel]:raise RuntimeError('unknown live version: '+rel)
        backup=remote.PRIVATE+'/pointzone-native-'+remote.digest(good)+'.bak'
        if remote.read(s,backup,100000)!=good:raise RuntimeError('verified recovery backup missing: '+rel)
        lint(good);remote.write(s,dest,good,0o644);restored.append(rel)
    for rel,source in [('extend/bpz-native-catalog-guard.extend.php','native-catalog-guard.extend.php'),('theme/UXC_Flarumix/shop/shop.head.php','native-catalog-theme-head.php'),('theme/UXC_Flarumix/shop/shop.tail.php','native-catalog-theme-tail.php'),('theme/UXC_Flarumix/mobile/shop/shop.head.php','native-catalog-theme-head.php'),('theme/UXC_Flarumix/mobile/shop/shop.tail.php','native-catalog-theme-tail.php')]:
        dest=remote.ROOT+'/'+rel;current=remote.read(s,dest,100000)
        if current is None:continue
        if blob(current) not in {'native-catalog-guard.extend.php':('8acce018273339bea7862797b04f7f03af124128',),'native-catalog-theme-head.php':('782d0a44984cea64efef0dcdda09f4e096f0ea71',),'native-catalog-theme-tail.php':('9a54a7611b8cef782b14b5a7531daef6369bfe02',)}[source]:raise RuntimeError('unknown live asset: '+rel)
        s.remove(dest);restored.append(rel)
    for path in ('','theme/Busan_PointZone/pointzone.php?section=shop','adm/shop_admin/itemlist.php','shop/list.php?ca_id=z9','shop/orderform.php'):
        status,body,url=response(path)
        mode='disabled' if '쇼핑몰 설치 후 이용해 주십시오' in body else 'login' if '로그인' in body or 'login.php' in url or status in (401,403) else 'other'
        print('BUSAN_NATIVE_RECOVERY_HTTP',path or '/',status,mode,flush=True)
        if status>=500 or 'Fatal error' in body:raise RuntimeError('HTTP recovery failed: '+path)
        if path.startswith('shop/') and mode!='disabled':raise RuntimeError('native transaction gate not verified')
    print('BUSAN_NATIVE_RECOVERY_OK',{'restored':restored,'checkout_locked':True,'authenticated_screen':'unverified','point_mutations':0},flush=True)
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',);t.start_client(timeout=20)
        if not hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35);recover(s)
