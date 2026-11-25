"""Read-only, scoped native Youngcart compatibility audit on existing Busan host.
No deployment, remote execution, DB connection, secret output, or source dump.
"""
import json,re,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import release_submenu_fix as remote

FILES=(
 'config.php','common.php','shop.config.php','shop/_common.php',
 'adm/_common.php','adm/admin.menu400.php','shop/shop.head.php','shop/shop.tail.php',
 'mobile/shop/shop.head.php','mobile/shop/shop.tail.php','theme/UXC_Flarumix/theme.config.php',
 'lib/hook.lib.php',
 'shop/index.php','shop/list.php','shop/item.php','shop/cart.php','shop/cartupdate.php',
 'shop/orderform.php','shop/orderformupdate.php','shop/orderinquiry.php','shop/orderinquiryview.php','shop/orderinquirycancel.php',
 'shop/itemuse.php','shop/itemqa.php','lib/shop.lib.php','lib/common.lib.php',
 'adm/shop_admin/_common.php','adm/shop_admin/configform.php','adm/shop_admin/itemlist.php',
 'adm/shop_admin/itemform.php','adm/shop_admin/itemformupdate.php','adm/shop_admin/orderlist.php',
 'adm/shop_admin/orderform.php','adm/shop_admin/orderformupdate.php',
 'mobile/shop/cart.php','mobile/shop/orderform.php',
 'theme/UXC_Flarumix/shop/shop.head.php','theme/UXC_Flarumix/shop/shop.tail.php',
 'theme/UXC_Flarumix/mobile/shop/shop.head.php','theme/UXC_Flarumix/mobile/shop/shop.tail.php'
)
HOOK=re.compile(r"\b(run_event|run_replace|add_event|add_replace)\s*\(\s*['\"]([a-zA-Z0-9_.:-]{1,100})['\"]")
MARKERS={
 'shop_flag':r'\bG5_USE_SHOP\b',
 'member_flag':r'\b(?:is_member|is_guest)\b',
 'native_point_debit':r'\binsert_point\s*\(',
 'native_point_delete':r'\bdelete_point\s*\(',
 'native_point_balance':r'\b(?:get_point_sum|mb_point)\b',
 'native_cart_session':r'\bss_cart_id\b',
 'native_order_session':r'\bss_order_id\b',
 'point_payment':r'(?:od_receipt_point|od_temp_point|od_settle_case)',
 'cash_payment':r'(?:od_receipt_price|od_misu|od_cash|od_settle_case)',
 'payment_provider':r'(?:KCP|INICIS|LGD|TOSS|NHN_KCP|KAKAO_PAY)',
 'theme_shop':r'\bG5_(?:MOBILE_)?THEME_SHOP_PATH\b',
 'native_table_mapping':r"\$g5\s*\[\s*['\"]g5_shop_[a-z_]+_table['\"]\s*\]",
 'native_include':r'\b(?:include|require)(?:_once)?\s*',
 'csrf':r'\b(?:check_token|check_admin_token|get_token)\s*\(',
}
def audit(s):
    remote.directory(s,remote.ROOT)
    result={}
    for path in FILES:
        try:
            data=remote.read(s,remote.ROOT+'/'+path,1000000)
        except (OSError,ValueError) as e:
            result[path]={'state':'unavailable','error':type(e).__name__};continue
        if data is None:
            result[path]={'state':'missing'};continue
        src=data.decode('utf-8','replace')
        row={'state':'present','sha256':remote.digest(data),'bytes':len(data),
             'hooks':sorted(set(kind+':'+name for kind,name in HOOK.findall(src))),
             'markers':{k:len(re.findall(v,src)) for k,v in MARKERS.items() if re.search(v,src)}}
        if path=='config.php':
            row['shop_flag_literal']=next(iter(re.findall(r"define\s*\(\s*['\"]G5_USE_SHOP['\"]\s*,\s*(true|false|0|1)\s*\)",src,re.I)),None)
        if path=='shop.config.php':
            # Only constant/table mapping identifiers; never print values of credentials.
            row['mapping_keys']=sorted(set(re.findall(r"\$g5\s*\[\s*['\"](g5_shop_[a-z_]+_table)['\"]\s*\]",src)))
            row['uses_shop_prefix_constant']=bool(re.search(r'\bG5_SHOP_TABLE_PREFIX\b',src))
        result[path]=row
    # dbconfig can contain credentials. Never publish its bytes, full hash or
    # arbitrary lines. Parse only exact, enumerated shop config values.
    cfg=remote.read(s,remote.ROOT+'/data/dbconfig.php',100000)
    if cfg is None:raise RuntimeError('site database configuration missing')
    src=cfg.decode('utf-8','replace')
    flag=re.findall(r"define\s*\(\s*['\"]G5_USE_SHOP['\"]\s*,\s*(true|false|0|1)\s*\)",src,re.I)
    prefix=re.findall(r"define\s*\(\s*['\"]G5_SHOP_TABLE_PREFIX['\"]\s*,\s*['\"](g5_shop_|yc5_)['\"]\s*\)",src)
    keys={}
    for k in ('default','category','item','item_option','cart','order','item_use','item_qa','wish','coupon','coupon_log','sendcost','personalpay','event','event_item'):
        m=re.findall(r"\$g5\s*\[\s*['\"]g5_shop_"+k+r"_table['\"]\s*\]\s*=\s*([^;\r\n]{1,120});",src)
        keys[k]=['yc5_literal' if re.fullmatch(r"['\"]yc5_"+k+r"['\"]",v.strip()) else 'g5_shop_literal' if re.fullmatch(r"['\"]g5_shop_"+k+r"['\"]",v.strip()) else 'prefix_constant' if re.fullmatch(r"G5_SHOP_TABLE_PREFIX\s*\.\s*['\"]"+k+r"['\"]",v.strip()) else 'other_expression' for v in m]
    print('BUSAN_NATIVE_CONFIG_METADATA',json.dumps({'flag':flag,'prefix':prefix,'mapping':keys,'secret_output':False},ensure_ascii=False),flush=True)
    # Non-secret source excerpts only: allowlisted lines establishing load order,
    # native admin authentication, shop guards and theme choice. No raw config.
    snippets={}
    for rel in ('common.php','shop/_common.php','adm/shop_admin/_common.php','adm/_common.php','shop.config.php','shop/shop.head.php','shop/shop.tail.php','shop/index.php','mobile/shop/shop.head.php','mobile/shop/shop.tail.php'):
        data=remote.read(s,remote.ROOT+'/'+rel,1000000)
        if data is None:continue
        src=data.decode('utf-8','replace').splitlines()
        hit=[]
        for i,l in enumerate(src):
            if re.search(r'\bG5_USE_SHOP\b|shop\.config\.php|G5_EXTEND_PATH|common_header|admin_common|G5_(?:MOBILE_)?THEME_SHOP_PATH|auth_check_menu|is_admin|is_guest|G5_SHOP_PATH|G5_MSHOP_PATH',l) and not re.search(r'password|passwd|secret|token|api[_-]?key|G5_MYSQL',l,re.I):
                hit.append({'line':i+1,'text':l.strip()[:240]})
        snippets[rel]=hit[:40]
    print('BUSAN_NATIVE_BOOTSTRAP',json.dumps(snippets,ensure_ascii=False),flush=True)
    print('BUSAN_NATIVE_YOUNGCART_AUDIT',json.dumps({'files':result,'remote_writes':0,'sql_accessed':False,'point_mutations':0},ensure_ascii=False),flush=True)
    required=['shop.config.php','shop/_common.php','shop/cartupdate.php','shop/orderform.php','shop/orderformupdate.php','lib/shop.lib.php','adm/shop_admin/itemformupdate.php','adm/shop_admin/orderformupdate.php']
    if any(result[k]['state']!='present' for k in required):raise RuntimeError('native source inventory incomplete')
if __name__=='__main__':
    host,user,password,pin=remote.configuration(remote.os.environ)
    with remote.socket.create_connection((host,remote.PORT),timeout=15) as sock,remote.paramiko.Transport(sock) as t:
        t.get_security_options().key_types=('ssh-ed25519',)
        t.start_client(timeout=20)
        if not remote.hmac.compare_digest(remote.fingerprint(t.get_remote_server_key()),pin):raise RuntimeError('host identity mismatch')
        t.auth_password(user,password,fallback=False)
        with remote.paramiko.SFTPClient.from_transport(t) as s:
            s.get_channel().settimeout(35)
            audit(s)
