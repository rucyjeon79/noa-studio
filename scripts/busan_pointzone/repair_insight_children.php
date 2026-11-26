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
    $spec=[
        ['회사·그룹 소식','busan_news_company','9010',10],
        ['노동조합 소식','busan_news_union','9020',20],
        ['노동법·판례','busan_news_law','9030',30],
        ['세계 노동 동향','busan_news_world','9040',40],
        ['권리노트','note','9050',50]
    ];
    $root=array_values(array_filter($rows,static function($r){return $r['me_code']==='90'&&$r['me_name']==='OpenAI 인사이트'&&parse_url($r['me_link'],PHP_URL_PATH)==='/bbs/board.php'&&parse_url($r['me_link'],PHP_URL_QUERY)==='bo_table=busan_news';}));
    if(count($root)!==1)throw new RuntimeException('Insight parent identity conflict');
    $expected=$rows;$plan=[];$used=[];
    foreach($rows as $i=>$r){if(isset($used[$r['me_code']]))throw new RuntimeException('duplicate code');$used[$r['me_code']]=$i;}
    foreach($spec as [$name,$board,$code,$order]){
        $matches=[];
        foreach($rows as $i=>$r){
            if($r['me_name']!==$name)continue;
            $path=parse_url($r['me_link'],PHP_URL_PATH);
            $q=[];parse_str(parse_url($r['me_link'],PHP_URL_QUERY)??'',$q);
            if(($board==='note'&&($path==='/note'||($path==='/bbs/board.php'&&($q['bo_table']??'')==='note')))||($path==='/bbs/board.php'&&($q['bo_table']??'')===$board))$matches[]=$i;
        }
        if(count($matches)!==1)throw new RuntimeException('child identity conflict: '.$name);
        $i=$matches[0];$r=$rows[$i];
        if(isset($used[$code])&&$used[$code]!==$i)throw new RuntimeException('target code occupied: '.$code);
        if(!in_array($r['me_code'],['b0','b010','b020','b030','40',$code],true))throw new RuntimeException('unexpected source code: '.$name);
        if((int)$r['me_use']!==1||(int)$r['me_mobile_use']!==1)throw new RuntimeException('child visibility conflict: '.$name);
        if($r['me_code']!==$code||(int)$r['me_order']!==$order){
            $plan[]=[$r,$code,$order];$expected[$i]['me_code']=$code;$expected[$i]['me_order']=(string)$order;
        }
    }
    if($plan){
        $ids=[];$cases=[];$orders=[];
        foreach($plan as [$r,$code,$order]){$id=(int)$r['me_id'];$ids[]=$id;$cases[]="WHEN $id THEN ".bh_v($code);$orders[]="WHEN $id THEN $order";}
        bh_q("UPDATE $mt SET me_code=CASE me_id ".implode(' ',$cases)." END,me_order=CASE me_id ".implode(' ',$orders)." END WHERE me_id IN (".implode(',',$ids).")");
    }
    $after=bh_rows($mt);
    $byId=static function($a){usort($a,static function($x,$y){return (int)$x['me_id']<=>(int)$y['me_id'];});return $a;};
    if($byId($after)!==$byId($expected))throw new RuntimeException('unexpected unrelated menu mutation');
    $verified=[];
    foreach(['me_use','me_mobile_use'] as $flag){
        $rootNames=[];$children=[];
        foreach($after as $r){if((int)$r[$flag]!==1)continue;if(strlen($r['me_code'])===2)$rootNames[]=$r['me_name'];elseif(substr($r['me_code'],0,2)==='90')$children[]=$r['me_name'];}
        if(end($rootNames)!=='OpenAI 인사이트'||$children!==array_column($spec,0))throw new RuntimeException('Insight hierarchy verification failed');
        $verified[$flag]=$children;
    }
    if($plan&&function_exists('run_event'))run_event('admin_menu_list_update');
    bh_out(['status'=>'applied','changed'=>count($plan),'verified'=>$verified]);
}catch(Throwable $e){bh_out(['status'=>'blocked','reason'=>$e instanceof RuntimeException?$e->getMessage():'runtime error']);}
