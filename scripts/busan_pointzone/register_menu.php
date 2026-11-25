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
    $path='/theme/Busan_PointZone/pointzone.php';
    $legacy=G5_URL.'/theme/UXC_Flarumix/pointzone.php';
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
        throw new RuntimeException('expected existing POINT ZONE tree');
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
        if(!in_array($existing['me_link'],[$url,$legacy],true)||$existing['me_name']!=='POINT ZONE')
            throw new RuntimeException('unrelated point zone menu');
    }
    $top=pzm_q("SELECT me_id,me_code,me_name,me_link,me_order,me_use,me_mobile_use FROM $mt WHERE LENGTH(me_code)=2 ORDER BY me_order,me_id");
    $ordered=[];while($v=sql_fetch_array($top))$ordered[]=$v;
    $pos=null;foreach($ordered as $i=>$v)if((string)$v['me_code']===(string)$code)$pos=$i;
    if($pos===null)throw new RuntimeException('POINT ZONE root not located');
    if(!in_array($ordered[$pos]['me_link'],[$url,$legacy],true))throw new RuntimeException('POINT ZONE root URL mismatch');
    if((int)$ordered[$pos]['me_use']!==1||(int)$ordered[$pos]['me_mobile_use']!==1)throw new RuntimeException('POINT ZONE visibility disabled');
    // Find a position using only POINT ZONE's own numeric order. Preserve
    // every other root's relative ordering and visibility on both devices.
    $currentOrder=(int)$ordered[$pos]['me_order'];
    $candidates=[$currentOrder,(int)$parent['me_order']];
    foreach($ordered as $v){
        $n=(int)$v['me_order'];$candidates[]=$n;
        if($n<2147483647)$candidates[]=$n+1;
        if($n>0)$candidates[]=$n-1;
    }
    $candidates=array_values(array_unique($candidates));
    usort($candidates,static function($a,$b)use($currentOrder){return abs($a-$currentOrder)<=>abs($b-$currentOrder);});
    $newOrder=null;
    foreach($candidates as $candidate){
        if($candidate<0||$candidate>2147483647)continue;
        $trial=$ordered;$trial[$pos]['me_order']=$candidate;
        usort($trial,static function($a,$b){return ((int)$a['me_order']<=>(int)$b['me_order'])?:((int)$a['me_id']<=>(int)$b['me_id']);});
        $ok=true;
        foreach(['me_use','me_mobile_use'] as $flag){
            $visible=array_values(array_filter($trial,static function($v)use($flag){return (int)$v[$flag]===1;}));
            $names=array_map(static function($v){return strtoupper(trim($v['me_name']));},$visible);
            $p=array_search('POINT ZONE',$names,true);$e=array_search('ETC',$names,true);
            if($p===false||$e===false||$p!==$e+1){$ok=false;break;}
        }
        if($ok){$newOrder=$candidate;break;}
    }
    if($newOrder===null){
        $diagnostic=array_map(static function($v){return ['name'=>$v['me_name'],'id'=>(int)$v['me_id'],'order'=>(int)$v['me_order'],'pc'=>(int)$v['me_use'],'mobile'=>(int)$v['me_mobile_use']];},$ordered);
        pzm_out(200,['status'=>'blocked','reason'=>'no safe POINT ZONE-only order','root_order'=>$diagnostic]);
    }
    $needsOrder=$newOrder!==$currentOrder;
    $desired=['shop'=>'포인트 상점','auction'=>'포인트 경매','sharing'=>'포인트 나눔','events'=>'지부장 이벤트',
              'profile'=>'프로필 꾸미기','honor'=>'명예의 전당','my'=>'나의 포인트존'];
    $children=pzm_q("SELECT me_id,me_code,me_name,me_link,me_target,me_order,me_use,me_mobile_use FROM $mt WHERE LENGTH(me_code)=4 AND LEFT(me_code,2)=".pzm_v($code)." ORDER BY me_code,me_id");
    $byCode=[];while($row=sql_fetch_array($children)){
        if(isset($byCode[$row['me_code']]))throw new RuntimeException('duplicate submenu code');
        $byCode[$row['me_code']]=$row;
    }
    $plan=[];$i=0;
    foreach($desired as $key=>$name){
        $childCode=$code.(string)(10+$i*10);
        $target=$url.'?section='.$key;$old=$byCode[$childCode]??null;
        if($old&&($old['me_name']!==$name||(!in_array($old['me_link'],[$target,$legacy.'?section='.$key],true)&&!($key==='shop'&&in_array($old['me_link'],[$url,$legacy],true)))))
            throw new RuntimeException('submenu conflict');
        $plan[]=[$childCode,$target,$name,$i,$old];$i++;
    }
    if(!$matches)throw new RuntimeException('expected existing POINT ZONE tree');
    $snapshot=['root'=>$matches[0],'children'=>array_values($byCode),'root_order'=>$ordered];
    $snapshotHash=hash('sha256',json_encode($snapshot,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR));
    $input=json_decode(file_get_contents('php://input'),true);
    if(($input['mode']??'')==='snapshot'){
        pzm_out(200,['status'=>'snapshot','snapshot'=>$snapshot,'sha256'=>$snapshotHash]);
    }
    if(($input['mode']??'')!=='apply'||!hash_equals($snapshotHash,(string)($input['expected_sha256']??'')))
        throw new RuntimeException('menu snapshot mismatch');
    if($needsOrder){
        pzm_q("UPDATE $mt SET me_order=".$newOrder." WHERE me_id=".(int)$ordered[$pos]['me_id']);
        $changed++;
    }
    if($matches&&$ordered[$pos]['me_link']===$legacy){
        /* backup verified by deployment client over authenticated SFTP */ 
        $private=null;
        pzm_q("UPDATE $mt SET me_link=".pzm_v($url)." WHERE me_id=".(int)$ordered[$pos]['me_id']." AND me_link=".pzm_v($legacy));
        $changed++;
    }
    foreach($plan as [$childCode,$target,$name,$order,$old]){
        if(!$old){
            pzm_q("INSERT INTO $mt (me_code,me_name,me_link,me_target,me_order,me_use,me_mobile_use) VALUES (".pzm_v($childCode).",".pzm_v($name).",".pzm_v($target).",'self',$order,1,1)");
            $changed++;
        }elseif($old['me_link']!==$target||(int)$old['me_order']!==$order||(int)$old['me_use']!==1||(int)$old['me_mobile_use']!==1||$old['me_target']!=='self'){
            pzm_q("UPDATE $mt SET me_link=".pzm_v($target).",me_target='self',me_order=$order,me_use=1,me_mobile_use=1 WHERE me_id=".(int)$old['me_id']);
            $changed++;
        }
    }
    $verified=[];
    $result=pzm_q("SELECT me_code,me_name,me_link,me_order,me_use,me_mobile_use FROM $mt WHERE LENGTH(me_code)=4 AND LEFT(me_code,2)=".pzm_v($code)." ORDER BY me_order,me_id");
    while($row=sql_fetch_array($result)){
        foreach($plan as [$childCode,$target,$name,$order,$old]){
            if($row['me_code']!==$childCode)continue;
            if($row['me_name']!==$name||$row['me_link']!==$target||(int)$row['me_order']!==$order||(int)$row['me_use']!==1||(int)$row['me_mobile_use']!==1)
                throw new RuntimeException('submenu verification failed');
            $verified[]=$name;
        }
    }
    if($verified!==array_values($desired))throw new RuntimeException('submenu ordering verification failed');
    $rootcheck=sql_fetch("SELECT me_link FROM $mt WHERE me_code=".pzm_v($code)." LIMIT 1",false);
    if(($rootcheck['me_link']??'')!==$url)throw new RuntimeException('independent theme link not verified');
    foreach(['me_use','me_mobile_use'] as $flag){
        $rs=pzm_q("SELECT me_name FROM $mt WHERE LENGTH(me_code)=2 AND $flag=1 ORDER BY me_order,me_id");
        $names=[];while($row=sql_fetch_array($rs))$names[]=strtoupper(trim($row['me_name']));
        $p=array_search('POINT ZONE',$names,true);
        if($p===false||$p===0||$names[$p-1]!=='ETC')throw new RuntimeException('post-migration visible order failed: '.$flag);
    }
    if($changed&&function_exists('run_event'))run_event('admin_menu_list_update');
    pzm_out(200,['status'=>$changed?'applied':'already_current','after'=>'ETC','menu'=>'POINT ZONE','submenus'=>$verified,'url'=>$url,'desktop'=>true,'mobile'=>true,'mutations'=>$changed]);
}catch(Throwable $e){pzm_out(200,['status'=>'blocked','reason'=>$e instanceof RuntimeException?$e->getMessage():'runtime error']);}
