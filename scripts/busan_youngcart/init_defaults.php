<?php
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||
    !hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_YC_DEFAULTS']??''))){
    http_response_code(404);exit;
}
ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
// __DEFAULTS_SOURCE__
function bdy_out($result){echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function bdy_q($s){$r=sql_query($s,false);if($r===false)throw new RuntimeException('query failed');return $r;}
try{
    if(!defined('G5_GNUBOARD_VER')||G5_GNUBOARD_VER!=='5.6.4'||(defined('G5_USE_SHOP')&&G5_USE_SHOP))throw new RuntimeException('activation or version mismatch');
    $lock=sql_fetch("SELECT GET_LOCK('busan_youngcart_defaults_v1',10) AS ok",false);
    if((int)($lock['ok']??0)!==1)throw new RuntimeException('defaults lock unavailable');
    foreach(['default','item','order','cart','category','item_option'] as $suffix){
        $table='yc5_'.$suffix;
        $info=sql_fetch("SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='$table' LIMIT 1",false);
        if(strtoupper((string)($info['engine']??''))!=='INNODB')throw new RuntimeException('native table engine mismatch');
        if($suffix!=='default'){
            $n=sql_fetch("SELECT COUNT(*) AS n FROM `$table`",false);
            if(!isset($n['n'])||(int)$n['n']!==0)throw new RuntimeException('unexpected shop content');
        }
    }
    $settings=busan_yc_default_values();
    $cols=[];$rs=bdy_q("SHOW COLUMNS FROM yc5_default");while($r=sql_fetch_array($rs))$cols[]=$r['Field'];
    if(array_diff(array_keys($settings),$cols))throw new RuntimeException('schema mismatch');
    $n=sql_fetch("SELECT COUNT(*) AS n FROM yc5_default",false);
    if(!isset($n['n'])||(int)$n['n']>1)throw new RuntimeException('defaults cardinality mismatch');
    $created=0;
    if((int)$n['n']===0){
        $pairs=[];foreach($settings as $k=>$v)$pairs[]="`$k`='".sql_real_escape_string((string)$v)."'";
        bdy_q("INSERT INTO yc5_default SET ".implode(',',$pairs));$created=1;
    }
    $r=sql_fetch("SELECT ".implode(',',array_keys($settings))." FROM yc5_default LIMIT 1",false);
    foreach($settings as $k=>$v)if(!isset($r[$k])||(string)$r[$k]!== (string)$v)throw new RuntimeException('existing settings conflict: '.$k);
    bdy_out(['status'=>$created?'initialized':'already_current','settings_rows'=>1,'cash_methods_enabled'=>0,'guest_cart_enabled'=>false,'shop_activated'=>false,'product_rows'=>0,'order_rows'=>0,'member_point_mutations'=>0]);
}catch(Throwable $e){bdy_out(['status'=>'blocked','reason'=>$e instanceof RuntimeException?$e->getMessage():'runtime error']);}
