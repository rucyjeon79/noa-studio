<?php
// One-time authenticated diagnostic, no order/cart/member writes, no login spoof.
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_RELEASE']??''))){http_response_code(404);exit;}
ini_set('display_errors','0');
ob_start();
$bpz_stage='site_common';$bpz_report=[];
function bpz_probe_report($error=null){
    global $bpz_stage,$bpz_report;
    while(ob_get_level())ob_end_clean();
    http_response_code(200);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
    echo json_encode(['stage'=>$bpz_stage,'checks'=>$bpz_report,'error'=>$error],JSON_UNESCAPED_SLASHES);
}
function bpz_probe_error($e){
    $m=$e['message']??'';
    $type='runtime';
    $symbol=null;
    if(preg_match('/(?:undefined constant|undefined function|undefined method|class) ["\x27]?([A-Za-z_][A-Za-z0-9_\\\\:]{0,100})/i',$m,$x)){$type='missing_symbol';$symbol=$x[1];}
    elseif(stripos($m,'division by zero')!==false)$type='division_by_zero';
    elseif(stripos($m,'failed opening required')!==false)$type='missing_include';
    elseif(stripos($m,'must be of type')!==false)$type='type_error';
    elseif(stripos($m,'unknown column')!==false)$type='missing_column';
    return ['type'=>$type,'symbol'=>$symbol,'file'=>basename($e['file']??''),'line'=>(int)($e['line']??0)];
}
$bpz_done=false;
register_shutdown_function(function(){global $bpz_done;if($bpz_done)return;$e=error_get_last();bpz_probe_report($e?bpz_probe_error($e):['type'=>'early_exit']);});
try{
    require_once dirname(__DIR__).'/common.php';
    if(G5_MYSQL_DB!=='rucyjeon79'||!empty($is_member)||(defined('G5_USE_SHOP')&&G5_USE_SHOP))throw new RuntimeException('unexpected probe context');
    $bpz_report['site_common']=true;
    $bpz_stage='native_mapping';
    if(defined('G5_USE_SHOP')||defined('G5_SHOP_TABLE_PREFIX'))throw new RuntimeException('existing shop flag');
    define('G5_USE_SHOP',true);define('G5_SHOP_TABLE_PREFIX','yc5_');
    foreach(['default','banner','cart','category','event','event_item','item','item_option','item_use','item_qa','item_relation','order','order_delete','wish','coupon','coupon_zone','coupon_log','sendcost','personalpay','order_address','item_stocksms','order_data','inicis_log'] as $s)$g5['g5_shop_'.$s.'_table']='yc5_'.$s;
    $g5['g5_shop_post_log_table']='yc5_order_post_log';
    $bpz_stage='native_shop_config';
    require G5_PATH.'/shop.config.php';
    $bpz_report['native_config']=true;
    $bpz_report['default_skin_pc']=($default['de_shop_skin']??'')==='basic'?'basic':(($default['de_shop_skin']??'')==='Busan_PointZone'?'Busan_PointZone':'other');
    $bpz_report['default_skin_mobile']=($default['de_shop_mobile_skin']??'')==='basic'?'basic':(($default['de_shop_mobile_skin']??'')==='Busan_PointZone'?'Busan_PointZone':'other');
    $bpz_stage='native_shop_library';
    require_once G5_LIB_PATH.'/shop.lib.php';
    $bpz_report['shop_library']=function_exists('get_price')&&class_exists('item_list');
    $bpz_stage='native_catalog_schema';
    $r=sql_fetch("SELECT COUNT(*) AS n FROM ".$g5['g5_shop_item_table']." WHERE ca_id='z9' AND it_use=1",false);
    $bpz_report['samples']=(int)($r['n']??-1);
    $bpz_report['native_skin_pc']=defined('G5_SHOP_SKIN_PATH')&&is_dir(G5_SHOP_SKIN_PATH);
    $bpz_report['native_skin_mobile']=defined('G5_MSHOP_SKIN_PATH')&&is_dir(G5_MSHOP_SKIN_PATH);
    $bpz_report['stock_basic_pc']=is_file(G5_PATH.'/skin/shop/basic/list.10.skin.php');
    $bpz_report['stock_basic_mobile']=is_file(G5_PATH.'/mobile/skin/shop/basic/list.10.skin.php');
    $bpz_stage='complete';$bpz_done=true;bpz_probe_report();
}catch(Throwable $e){$bpz_done=true;bpz_probe_report(bpz_probe_error(['message'=>$e->getMessage(),'file'=>$e->getFile(),'line'=>$e->getLine()]));}
