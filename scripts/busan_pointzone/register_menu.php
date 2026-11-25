<?php
// One-time, deployment-only registration of the approved menu. The temporary
// endpoint is removed by the release script after the verified response.
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||
   !hash_equals('__TOKEN_HASH__',hash('sha256',$_SERVER['HTTP_X_BUSAN_POINTZONE']??''))){
    http_response_code(404);exit;
}
ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
function pzm_out($status,$body){http_response_code($status);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES);exit;}
function pzm_q($s){$r=sql_query($s,false);if(!$r)throw new RuntimeException('menu query failed');return $r;}
function pzm_v($s){return "'".sql_real_escape_string((string)$s)."'";}
try{
    $mt=$g5['menu_table']??'';
    if(!preg_match('/^[A-Za-z0-9_]{1,90}$/D',$mt))throw new RuntimeException('invalid menu table');
    $path='/theme/UXC_Flarumix/pointzone.php';
    if(!is_file(G5_PATH.$path))throw new RuntimeException('point zone page missing');
    $url=G5_URL.$path;
    $lock=sql_fetch("SELECT GET_LOCK('busan_pointzone_menu_v1',10) AS ok",false);
    if((int)($lock['ok']??0)!==1)throw new RuntimeException('menu busy');
    $all=pzm_q("SELECT me_id,me_code,me_name,me_link,me_target,me_order,me_use,me_mobile_use FROM $mt ORDER BY me_order,me_id");
    $roots=[];$used=[];$matches=[];$etc=[];
    while($row=sql_fetch_array($all)){
        $code=(string)$row['me_code'];$used[substr($code,0,2)]=true;
        if(strlen($code)!==2)continue;
        $roots[]=$row;
        if(strtoupper(trim($row['me_name']))==='ETC')$etc[]=$row;
        if(strtoupper(trim($row['me_name']))==='POINT ZONE'||$row['me_link']===$url)$matches[]=$row;
    }
    if(count($etc)!==1||count($matches)>1)throw new RuntimeException('menu identity conflict');
    $parent=$etc[0];$changed=0;
    if(!$matches){
        // ETC is the final existing section in the approved layout; fail closed
        // if it has moved rather than reorder unrelated menu rows.
        $last=end($roots);
        if((int)$last['me_id']!==(int)$parent['me_id'])throw new RuntimeException('ETC is no longer last');
        $code='';
        for($n=10;$n<1296;$n++){
            $c=str_pad(base_convert((string)$n,10,36),2,'0',STR_PAD_LEFT);
            if(!isset($used[$c])){$code=$c;break;}
        }
        if($code==='')throw new RuntimeException('menu code unavailable');
        $order=(int)$parent['me_order']+1;
        $fields="(me_code,me_name,me_link,me_target,me_order,me_use,me_mobile_use)";
        $root="(".pzm_v($code).",'POINT ZONE',".pzm_v($url).",'self',$order,1,1)";
        $child="(".pzm_v($code.'10').",'포인트 상점',".pzm_v($url).",'self',0,1,1)";
        pzm_q("INSERT INTO $mt $fields VALUES $root,$child");
        $changed=2;
    }else{
        $existing=$matches[0];$code=$existing['me_code'];
        if($existing['me_link']!==$url||$existing['me_name']!=='POINT ZONE')
            throw new RuntimeException('unrelated point zone menu');
    }
    $top=pzm_q("SELECT me_id,me_code,me_name,me_link,me_use,me_mobile_use FROM $mt WHERE LENGTH(me_code)=2 ORDER BY me_order,me_id");
    $ordered=[];while($v=sql_fetch_array($top))$ordered[]=$v;
    $pos=null;foreach($ordered as $i=>$v)if($v['me_code']===$code)$pos=$i;
    $child=sql_fetch("SELECT me_name,me_link,me_use,me_mobile_use FROM $mt WHERE me_code=".pzm_v($code.'10')." LIMIT 1",false);
    if($pos===null||$pos===0||strtoupper(trim($ordered[$pos-1]['me_name']))!=='ETC'||
       $ordered[$pos]['me_link']!==$url||(int)$ordered[$pos]['me_use']!==1||(int)$ordered[$pos]['me_mobile_use']!==1||
       ($child['me_name']??'')!=='포인트 상점'||($child['me_link']??'')!==$url||(int)$child['me_use']!==1||(int)$child['me_mobile_use']!==1)
        throw new RuntimeException('menu verification failed');
    if($changed&&function_exists('run_event'))run_event('admin_menu_list_update');
    pzm_out(200,['status'=>$changed?'applied':'already_current','after'=>'ETC','menu'=>'POINT ZONE','submenu'=>'포인트 상점','url'=>$url,'desktop'=>true,'mobile'=>true,'mutations'=>$changed]);
}catch(Throwable $e){pzm_out(409,['status'=>'blocked','reason'=>$e instanceof RuntimeException?$e->getMessage():'runtime error']);}
