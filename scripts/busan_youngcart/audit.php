<?php
// Temporary authenticated, read-only production inventory. No member or order records.
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||
   !hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_YC_AUDIT']??''))){
    http_response_code(404);exit;
}
ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$root=G5_PATH;
$files=[];
foreach(['shop/index.php','shop/cart.php','shop/cartupdate.php','shop/orderform.php','shop/orderformupdate.php','shop/orderinquiry.php','shop/_common.php','adm/shop_admin/itemlist.php','adm/shop_admin/orderlist.php','lib/shop.lib.php','install/youngcart.sql','theme/UXC_Flarumix/shop/shop.head.php','theme/UXC_Flarumix/shop/shop.tail.php'] as $path){
    $files[$path]=is_file($root.'/'.$path);
}
$tables=[];
foreach(['g5_shop_item_table','g5_shop_cart_table','g5_shop_order_table','g5_shop_default_table','g5_shop_item_option_table','member_table','point_table'] as $key){
    $name=$g5[$key]??'';
    if(!is_string($name)||!preg_match('/^[A-Za-z0-9_]{1,90}$/D',$name)){
        $tables[$key]=['exists'=>false];continue;
    }
    $safe=sql_real_escape_string($name);
    $info=sql_fetch("SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$safe' LIMIT 1",false);
    $cols=[];
    if(!empty($info['engine'])){
        $rs=sql_query("SHOW COLUMNS FROM `$name`",false);
        if($rs)while($c=sql_fetch_array($rs))$cols[]=$c['Field'];
    }
    $tables[$key]=['exists'=>!empty($info['engine']),'engine'=>$info['engine']??null,'columns'=>$cols];
}
// Discover only expected Youngcart table names from the known member-table prefix.
$schemaCandidates=[];
$memberTable=$g5['member_table']??'';
if(is_string($memberTable)&&preg_match('/^([A-Za-z0-9_]+)member$/D',$memberTable,$match)){
    foreach(['item','cart','order','default','item_option'] as $suffix){
        $candidate=$match[1].'shop_'.$suffix;
        $safe=sql_real_escape_string($candidate);
        $info=sql_fetch("SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$safe' LIMIT 1",false);
        $schemaCandidates[$suffix]=['exists'=>!empty($info['engine']),'engine'=>$info['engine']??null];
    }
}
// Official v5.6.4 installer uses yc5_ by default, not g5_shop_.
$nativeCandidates=[];
foreach(['yc5_','g5_shop_'] as $prefix){
    foreach(['category','item','cart','order','default','item_option'] as $suffix){
        $name=$prefix.$suffix;
        $info=sql_fetch("SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".sql_real_escape_string($name)."' LIMIT 1",false);
        $nativeCandidates[$prefix][$suffix]=['exists'=>!empty($info['engine']),'engine'=>$info['engine']??null];
    }
}
$themePaths=[];
foreach(['theme/basic/shop/index.php','theme/basic/shop/shop.head.php','theme/basic/shop/shop.tail.php','theme/basic/mobile/shop/index.php','theme/basic/skin/shop/basic','theme/basic/mobile/skin/shop/basic'] as $p){
    $themePaths[$p]=file_exists($root.'/'.$p);
}
$hookHints=[];
foreach(['common.php','shop.config.php','shop/_common.php','shop/index.php'] as $p){
    $body=is_file($root.'/'.$p)?file_get_contents($root.'/'.$p):'';
    $hookHints[$p]=[
       'theme_shop_constant'=>strpos($body,'G5_THEME_SHOP_PATH')!==false,
       'theme_path_constant'=>strpos($body,'G5_THEME_PATH')!==false,
       'has_replace_hook'=>strpos($body,'run_replace(')!==false,
       'has_event_hook'=>strpos($body,'run_event(')!==false
    ];
}
$flags=[];
if(!empty($tables['g5_shop_default_table']['exists'])){
    $keys=['de_card_use','de_bank_use','de_vbank_use','de_iche_use','de_hp_use','de_easy_pay_use','de_kakaopay_use','de_point_use','de_delivery_use'];
    $valid=array_values(array_intersect($keys,$tables['g5_shop_default_table']['columns']));
    if($valid){
        $row=sql_fetch("SELECT ".implode(',',$valid)." FROM `".$g5['g5_shop_default_table']."` LIMIT 1",false);
        foreach($valid as $k)$flags[$k]=isset($row[$k])?(bool)$row[$k]:null;
    }
}
echo json_encode(['status'=>'verified','gnuboard_version'=>defined('G5_GNUBOARD_VER')?G5_GNUBOARD_VER:null,
 'youngcart_version'=>defined('G5_YOUNGCART_VER')?G5_YOUNGCART_VER:null,
 'shop_enabled'=>defined('G5_USE_SHOP')?(bool)G5_USE_SHOP:null,
 'points_enabled'=>(bool)($config['cf_use_point']??false),'files'=>$files,'tables'=>$tables,'payment_flags'=>$flags,'schema_candidates'=>$schemaCandidates,'native_prefix_candidates'=>$nativeCandidates,'native_theme_files'=>$themePaths,'hook_hints'=>$hookHints,
 'mutations'=>0],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
