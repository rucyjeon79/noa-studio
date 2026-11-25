<?php
// Authenticated one-time schema deployment. Only embedded CREATE statements;
// no request-provided SQL, no core configuration edits, no products or orders.
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||
   !hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_YC_SCHEMA']??''))){
    http_response_code(404);exit;
}
ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function bys_out($body){echo json_encode($body,JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);exit;}
function bys_query($sql){$r=sql_query($sql,false);if($r===false)throw new RuntimeException('database query failed');return $r;}
function bys_info($name){
    return sql_fetch("SELECT ENGINE AS engine FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='".sql_real_escape_string($name)."' LIMIT 1",false);
}
$created=[];$current='preflight';$locked=false;$oldMode=null;
try{
    if(!defined('G5_GNUBOARD_VER')||G5_GNUBOARD_VER!=='5.6.4'||(defined('G5_USE_SHOP')&&G5_USE_SHOP))
        throw new RuntimeException('version or activation state changed');
    if(!empty($g5['g5_shop_item_table'])||!empty($g5['g5_shop_order_table']))
        throw new RuntimeException('existing shop mapping detected');
    $lock=sql_fetch("SELECT GET_LOCK('busan_youngcart_empty_schema_v1',10) AS ok",false);
    if((int)($lock['ok']??0)!==1)throw new RuntimeException('schema lock unavailable');
    $locked=true;
    $sql=base64_decode('__SCHEMA_BASE64__',true);
    if(!is_string($sql)||hash('sha256',$sql)!=='__SCHEMA_HASH__')throw new RuntimeException('schema integrity error');
    $parts=preg_split('/;\s*(?:\r?\n|$)/',preg_replace('/^--[^\r\n]*$/m','',$sql));
    $plan=[];
    foreach($parts as $part){
        $part=trim($part);if($part==='')continue;
        if(!preg_match('/^CREATE TABLE IF NOT EXISTS `g5_shop_([a-z_]+)` \([\s\S]+\) ENGINE=InnoDB DEFAULT CHARSET=utf8$/D',$part,$m)||
           isset($plan[$m[1]])||preg_match('/\b(?:DROP|DELETE|TRUNCATE|ALTER|UPDATE|INSERT)\s+(?:TABLE|INTO|FROM|`)/i',$part))
            throw new RuntimeException('unexpected schema statement');
        $plan[$m[1]]=str_replace('`g5_shop_'.$m[1].'`','`yc5_'.$m[1].'`',$part);
    }
    if(count($plan)!==24)throw new RuntimeException('schema count mismatch');
    $existing=[];
    foreach($plan as $suffix=>$stmt){
        if(!empty(bys_info('g5_shop_'.$suffix)['engine']))throw new RuntimeException('alternate native prefix exists');
        $info=bys_info('yc5_'.$suffix);
        if(!empty($info['engine']))$existing[$suffix]=$info['engine'];
    }
    if($existing&&count($existing)!==count($plan))throw new RuntimeException('partial preexisting schema; inspect before proceeding');
    if(!$existing){
        $mode=sql_fetch("SELECT @@SESSION.sql_mode AS mode",false);
        $oldMode=(string)($mode['mode']??'');
        bys_query("SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION'");
        foreach($plan as $suffix=>$stmt){
            $current=$suffix;
            bys_query($stmt);
            $created[]=$suffix;
        }
        bys_query("SET SESSION sql_mode='".sql_real_escape_string($oldMode)."'");
        $oldMode=null;
    }
    $verified=[];
    foreach($plan as $suffix=>$stmt){
        $current=$suffix;$name='yc5_'.$suffix;
        $info=bys_info($name);
        if(strtoupper((string)($info['engine']??''))!=='INNODB')throw new RuntimeException('engine verification failed');
        $rows=sql_fetch("SELECT COUNT(*) AS n FROM `$name`",false);
        if(!isset($rows['n'])||(int)$rows['n']!==0)throw new RuntimeException('expected empty table');
        preg_match_all('/^\s*`([a-zA-Z0-9_]+)`\s+[a-zA-Z]/m',$stmt,$columns);
        $found=[];$rs=bys_query("SHOW COLUMNS FROM `$name`");
        while($row=sql_fetch_array($rs))$found[]=$row['Field'];
        if($found!==$columns[1])throw new RuntimeException('column verification failed');
        $verified[]=$suffix;
    }
    bys_out(['status'=>$created?'created':'already_empty','tables'=>count($verified),'engine'=>'InnoDB','product_rows'=>0,'order_rows'=>0,'shop_activated'=>false,'member_point_mutations'=>0,'created_count'=>count($created)]);
}catch(Throwable $e){
    if($oldMode!==null)sql_query("SET SESSION sql_mode='".sql_real_escape_string($oldMode)."'",false);
    bys_out(['status'=>'blocked','stage'=>$current,'created_count'=>count($created),'created'=>$created,'reason'=>$e instanceof RuntimeException?$e->getMessage():'runtime error']);
}
