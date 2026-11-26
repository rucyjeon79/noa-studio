<?php
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||!hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_POINTZONE']??''))){http_response_code(404);exit;}
ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function bh_out($x){echo json_encode($x,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);exit;}
function bh_q($s){$r=sql_query($s,false);if(!$r)throw new RuntimeException('menu query failed');return $r;}
function bh_v($s){return "'".sql_real_escape_string((string)$s)."'";}
function bh_rows($mt){$a=[];$r=bh_q("SELECT me_id,me_code,me_name,me_link,me_target,me_order,me_use,me_mobile_use FROM $mt ORDER BY me_order,me_id");while($x=sql_fetch_array($r))$a[]=$x;return $a;}
function bh_name($s){return strtoupper(trim(preg_replace('/\s+/u',' ',$s)));}
try{
    $mt=$g5['menu_table']??'';if(!preg_match('/^[A-Za-z0-9_]{1,90}$/D',$mt))throw new RuntimeException('menu table');
    if(!is_file(G5_PATH.'/theme/Busan_PointZone/honor.php'))throw new RuntimeException('honor page missing');
    if((int)(sql_fetch("SELECT GET_LOCK('busan_pointzone_menu_v1',10) AS ok",false)['ok']??0)!==1)throw new RuntimeException('menu busy');
    $rows=bh_rows($mt);$hash=hash('sha256',json_encode($rows,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    $input=json_decode(file_get_contents('php://input'),true);
    if(($input['mode']??'')==='snapshot')bh_out(['status'=>'snapshot','rows'=>$rows,'sha256'=>$hash]);
    if(($input['mode']??'')!=='apply'||!hash_equals($hash,(string)($input['expected_sha256']??'')))throw new RuntimeException('menu snapshot conflict');
    $base=G5_URL.'/theme/Busan_PointZone/honor.php';
    $roots=array_values(array_filter($rows,static function($r)use($base){return strlen($r['me_code'])===2&&$r['me_name']==='명예의 전당'&&$r['me_link']===$base;}));
    if(count($roots)!==1)throw new RuntimeException('honor root identity conflict');
    $root=$roots[0];$changed=0;$expected=$rows;$children=[];
    foreach($rows as $i=>$r){
        if(strlen($r['me_code'])!==4||substr($r['me_code'],0,2)!==$root['me_code'])continue;
        $children[]=$r['me_name'];
        if($r['me_link']!==$base.'?section=home')continue;
        if(!in_array($r['me_name'],['명예의 전당','수상자 소개'],true))throw new RuntimeException('unexpected home label');
        $targets[]=$i;
    }
    if(count($targets??[])!==1)throw new RuntimeException('home identity conflict');
    $i=$targets[0];$r=$rows[$i];
    if($r['me_name']!=='수상자 소개'){
        bh_q("UPDATE $mt SET me_name='수상자 소개' WHERE me_id=".(int)$r['me_id']." AND me_name=".bh_v($r['me_name'])." AND me_link=".bh_v($r['me_link']));
        $expected[$i]['me_name']='수상자 소개';$changed++;
    }
    $after=bh_rows($mt);
    if($after!==$expected)throw new RuntimeException('unexpected menu change or concurrent edit');
    if($changed&&function_exists('run_event'))run_event('admin_menu_list_update');
    $verified=[];foreach(['me_use','me_mobile_use'] as $flag){
        $names=[];foreach($after as $r)if((int)$r[$flag]===1&&strlen($r['me_code'])===4&&substr($r['me_code'],0,2)===$root['me_code'])$names[]=$r['me_name'];
        if(in_array('명예의 전당',$names,true)||!in_array('수상자 소개',$names,true))throw new RuntimeException('duplicate label still visible');
        $verified[$flag]=$names;
    }
    bh_out(['status'=>'applied','changed'=>$changed,'verified'=>$verified]);
}catch(Throwable $e){bh_out(['status'=>'blocked','reason'=>$e instanceof RuntimeException?$e->getMessage():'runtime error']);}
