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
    $base=G5_URL.'/theme/Busan_PointZone/honor.php';$pz=G5_URL.'/theme/Busan_PointZone/pointzone.php';
    $roots=[];$used=[];$byCode=[];$run=[];$ins=[];$hon=[];$point=[];
    foreach($rows as $r){
        $c=(string)$r['me_code'];$used[substr($c,0,2)]=true;
        if(isset($byCode[$c]))throw new RuntimeException('duplicate menu code');$byCode[$c]=$r;
        if(strlen($c)!==2)continue;
        $roots[]=$r;$n=bh_name($r['me_name']);
        if($n==='WE RUN TOGETHER')$run[]=$r;
        if(in_array($n,['INSIGHT','INSIGHTS','인사이트','INSIGHT (인사이트)','인사이트 (INSIGHT)'],true))$ins[]=$r;
        if($n==='명예의 전당')$hon[]=$r;
        if($n==='POINT ZONE')$point[]=$r;
    }
    if(count($run)!==1||count($ins)!==1||count($point)!==1||count($hon)>1)throw new RuntimeException('root identity not unique: WE RUN TOGETHER / INSIGHT / POINT ZONE / honor');
    foreach([$run[0],$ins[0],$point[0]] as $r)if((int)$r['me_use']!==1||(int)$r['me_mobile_use']!==1)throw new RuntimeException('required root not visible');
    if($hon&&$hon[0]['me_link']!==$base)throw new RuntimeException('existing honor root conflict');
    $hc=$hon[0]['me_code']??null;
    if(!$hc){for($i=10;$i<1296;$i++){$c=str_pad(base_convert((string)$i,10,36),2,'0',STR_PAD_LEFT);if(!isset($used[$c])){$hc=$c;break;}}}
    if(!$hc)throw new RuntimeException('menu code unavailable');
    $oldHonor=$byCode[$point[0]['me_code'].'60']??null;
    if($oldHonor&&($oldHonor['me_name']!=='명예의 전당'||$oldHonor['me_link']!==$pz.'?section=honor'))throw new RuntimeException('point zone honor identity conflict');
    $labels=['home'=>'명예의 전당','rules'=>'선정 기준 및 운영 규정','review'=>'간부 심사','vote'=>'조합원 투표','history'=>'역대 수상 기록'];
    $children=[];$i=0;
    foreach($labels as $key=>$label){$c=$hc.(string)(10+10*$i);$link=$base.'?section='.$key;$old=$byCode[$c]??null;if($old&&($old['me_name']!==$label||$old['me_link']!==$link))throw new RuntimeException('honor child conflict');$children[]=[$c,$label,$link,$i++,$old];}
    $ordered=[];
    foreach($roots as $r){$c=$r['me_code'];if($c===$hc||$c===$ins[0]['me_code'])continue;$ordered[]=$r;if($c===$run[0]['me_code'])$ordered[]=$hon[0]??['me_code'=>$hc,'me_name'=>'명예의 전당'];}
    $ordered[]=$ins[0];$changed=0;
    $orderByCode=[];foreach($ordered as $i=>$r)$orderByCode[$r['me_code']]=($i+1)*10;
    // Preserve every other root's relative order. Only root ordering, the new
    // honor tree, and the old Point Zone honor visibility are changed.
    $fields="(me_code,me_name,me_link,me_target,me_order,me_use,me_mobile_use)";
    if(!$hon){bh_q("INSERT INTO $mt $fields VALUES (".bh_v($hc).",'명예의 전당',".bh_v($base).",'self',".$orderByCode[$hc].",1,1)");$changed++;}
    else{bh_q("UPDATE $mt SET me_use=1,me_mobile_use=1,me_target='self' WHERE me_id=".(int)$hon[0]['me_id']);}
    $cases=[];$ids=[];foreach($roots as $r){$n=$orderByCode[$r['me_code']];if((int)$r['me_order']===$n)continue;$id=(int)$r['me_id'];$cases[]="WHEN $id THEN $n";$ids[]=$id;}
    if($ids){bh_q("UPDATE $mt SET me_order=CASE me_id ".implode(' ',$cases)." END WHERE me_id IN (".implode(',',$ids).")");$changed+=count($ids);}
    foreach($children as [$c,$label,$link,$i,$old]){
        if(!$old){bh_q("INSERT INTO $mt $fields VALUES (".bh_v($c).",".bh_v($label).",".bh_v($link).",'self',$i,1,1)");$changed++;}
        elseif((int)$old['me_order']!==$i||(int)$old['me_use']!==1||(int)$old['me_mobile_use']!==1||$old['me_target']!=='self'){bh_q("UPDATE $mt SET me_order=$i,me_use=1,me_mobile_use=1,me_target='self' WHERE me_id=".(int)$old['me_id']);$changed++;}
    }
    if($oldHonor&&((int)$oldHonor['me_use']!==0||(int)$oldHonor['me_mobile_use']!==0)){bh_q("UPDATE $mt SET me_use=0,me_mobile_use=0 WHERE me_id=".(int)$oldHonor['me_id']);$changed++;}
    $after=bh_rows($mt);$verified=[];
    foreach(['me_use','me_mobile_use'] as $flag){
        $names=[];$childNames=[];$pointNames=[];
        foreach($after as $r){if((int)$r[$flag]!==1)continue;$c=$r['me_code'];if(strlen($c)===2)$names[]=$r['me_name'];elseif(strlen($c)===4&&substr($c,0,2)===$hc)$childNames[]=$r['me_name'];elseif(strlen($c)===4&&substr($c,0,2)===$point[0]['me_code'])$pointNames[]=$r['me_name'];}
        $runIndex=array_search($run[0]['me_name'],$names,true);
        if($runIndex===false||($names[$runIndex+1]??null)!=='명예의 전당'||end($names)!==$ins[0]['me_name']||$childNames!==array_values($labels)||in_array('명예의 전당',$pointNames,true))throw new RuntimeException('menu order verification failed');
        $verified[$flag]=['roots'=>$names,'honor'=>$childNames,'point_zone'=>$pointNames];
    }
    if(function_exists('run_event'))run_event('admin_menu_list_update');
    bh_out(['status'=>'applied','changed'=>$changed,'verified'=>$verified]);
}catch(Throwable $e){bh_out(['status'=>'blocked','reason'=>$e instanceof RuntimeException?$e->getMessage():'runtime error']);}
