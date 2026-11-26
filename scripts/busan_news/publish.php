<?php
// Authorize either a one-time deployment import or a verified newsroom identity.
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || (!defined('BUSAN_ACCOUNT_NEWS') && !hash_equals('__TOKEN_HASH__', hash('sha256', $_SERVER['HTTP_X_BUSAN_NEWS'] ?? '')))) { http_response_code(404); exit; }
ini_set('display_errors','0');
require_once dirname(__DIR__) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
const BN_BOARD='busan_news';
const BN_TITLE='OpenAI 뉴스룸';
const BN_MARK='busan-reporter-v1';
const BN_TOPICS=['홈앤서비스','SK브로드밴드','SK텔레콤','SK그룹','노동조합','노동법','노동관련 세계동향'];
function bnq($s) { $r=sql_query($s,false); if (!$r) throw new RuntimeException('database operation failed'); return $r; }
function bnvalue($v){ return "'".sql_real_escape_string((string)$v)."'"; }
function bneh($v){return htmlspecialchars($v, ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function bnset($fields){$out=[];foreach($fields as $k=>$v){if(!preg_match('/^[a-zA-Z0-9_]+$/D',$k))throw new RuntimeException('column');$out[]="`$k`=".bnvalue($v);}return implode(',',$out);}
function bnsetup() {
    global $g5;
    $bt=$g5['board_table']; $mt=$g5['menu_table']; $wt=$g5['write_prefix'].BN_BOARD;
    $parent=sql_fetch("SELECT me_code FROM $mt WHERE LENGTH(me_code)=2 AND REPLACE(LOWER(TRIM(me_name)),' ','')='weruntogether' LIMIT 1",false);
    if(empty($parent['me_code'])||!preg_match('/^[0-9a-z]{2}$/iD',$parent['me_code'])) throw new RuntimeException('We Run Together menu missing');
    $board=sql_fetch("SELECT * FROM $bt WHERE bo_table='busan_news'",false);
    if($board && $board['bo_10']!==BN_MARK)throw new RuntimeException('unrelated board with this ID');
    $template=sql_fetch("SELECT * FROM $bt WHERE bo_table='notice'",false);
    if(empty($template['bo_table']))throw new RuntimeException('board template missing');
    $join=sql_fetch("SELECT gr_id FROM $bt WHERE bo_table='join'",false);
    if(empty($join['gr_id']))throw new RuntimeException('board group missing');
    $group=get_group($join['gr_id']);if(empty($group)||!empty($group['gr_use_access']))throw new RuntimeException('news group restricts public reading');
    if(!$board){
        $settings=['bo_table'=>BN_BOARD,'gr_id'=>$join['gr_id'],'bo_subject'=>BN_TITLE,'bo_mobile_subject'=>BN_TITLE,'bo_10'=>BN_MARK,
          'bo_notice'=>'','bo_admin'=>'','bo_count_write'=>0,'bo_count_comment'=>0,'bo_list_level'=>1,'bo_read_level'=>1,'bo_write_level'=>10,'bo_reply_level'=>10,'bo_comment_level'=>3,
          'bo_read_point'=>0,'bo_write_point'=>0,'bo_comment_point'=>0,'bo_download_point'=>0,'bo_use_cert'=>'','bo_use_secret'=>0,'bo_use_search'=>1,'bo_use_category'=>1,
          'bo_category_list'=>implode('|',BN_TOPICS),'bo_device'=>'both','bo_use_sns'=>0,'bo_use_email'=>0,'bo_use_good'=>0,'bo_use_nogood'=>0,
          'bo_content_head'=>'','bo_mobile_content_head'=>'','bo_content_tail'=>'','bo_mobile_content_tail'=>'','bo_insert_content'=>''];
        foreach($template as $k=>&$v){if(preg_match('/^bo_(?:[1-9]|10)(?:_subj)?$/D',$k))$v='';}unset($v);
        $row=array_replace($template,array_intersect_key($settings,$template));
        $orphan=sql_fetch("SHOW TABLES LIKE ".bnvalue(strtr($wt,['_'=>'\\_','%'=>'\\%'])),false);
        if($orphan)throw new RuntimeException('unclaimed news write table');
        bnq("INSERT INTO $bt SET ".bnset($row));
    }
    if($board){
        $updates=[];
        foreach(['bo_subject','bo_mobile_subject'] as $field)
            if($board[$field]==='챗지기자 뉴스')$updates[$field]=BN_TITLE;
        // On the launch edition these two native wrapper paths were empty.
        foreach(['bo_include_head','bo_include_tail'] as $field)
            if(isset($template[$field]) && trim($template[$field])!=='' && trim($board[$field])==='')$updates[$field]=$template[$field];
        if($updates)bnq("UPDATE $bt SET ".bnset($updates)." WHERE bo_table='busan_news' AND bo_10='".BN_MARK."'");
    }
    bnq("CREATE TABLE IF NOT EXISTS `$wt` LIKE `{$g5['write_prefix']}notice`");
    // Keep exactly one top-level newsroom. Never remove an unrelated menu.
    $url='https://skhnslu-busan.com/bbs/board.php?bo_table=busan_news';
    $roots=[];$sub=[];$used=[];$ordered=[];$conflict=false;
    $q=bnq("SELECT me_id,me_code,me_name,me_link,me_order,me_use,me_mobile_use FROM $mt ORDER BY me_order,me_id");
    while($m=sql_fetch_array($q)){
        $code=(string)$m['me_code'];$used[substr($code,0,2)]=true;
        if(strlen($code)===2)$ordered[]=$m;
        if(!in_array(trim($m['me_name']),[BN_TITLE,'챗지기자 뉴스'],true))continue;
        $link=parse_url((string)$m['me_link']);$args=[];
        if(is_array($link))parse_str($link['query']??'',$args);
        $same=is_array($link)&&($link['path']??'')==='/bbs/board.php'
            && in_array(strtolower($link['host']??''),['','skhnslu-busan.com','www.skhnslu-busan.com'],true)
            && $args===['bo_table'=>BN_BOARD];
        if(!$same){$conflict=true;continue;}
        if(strlen($code)===2)$roots[]=$m;
        elseif(strlen($code)===4)$sub[]=$m;
        else $conflict=true;
    }
    if($conflict||count($roots)>1)throw new RuntimeException('newsroom menu conflict');
    $root=$roots[0]??null;
    if(!$root){
        $code='';
        for($i=36;$i<1296;$i++){
            $candidate=str_pad(base_convert((string)$i,10,36),2,'0',STR_PAD_LEFT);
            if(!isset($used[$candidate])){$code=$candidate;break;}
        }
        if($code==='')throw new RuntimeException('no unused top menu code');
        bnq("INSERT INTO $mt SET ".bnset(['me_code'=>$code,'me_name'=>BN_TITLE,'me_link'=>$url,'me_target'=>'self','me_order'=>0,'me_use'=>1,'me_mobile_use'=>1]));
        $root=['me_id'=>(int)sql_insert_id(),'me_code'=>$code,'me_order'=>0];
    }
    $rootid=(int)$root['me_id'];if($rootid<1)throw new RuntimeException('invalid newsroom menu id');
    $order=[];$found=false;
    foreach($ordered as $m){
        if((int)$m['me_id']===$rootid)continue;
        $order[]=$m;
        if($m['me_code']===$parent['me_code']){$order[]=$root;$found=true;}
    }
    if(!$found)throw new RuntimeException('newsroom parent order missing');
    bnq("UPDATE $mt SET ".bnset(['me_name'=>BN_TITLE,'me_link'=>$url,'me_use'=>1,'me_mobile_use'=>1])." WHERE me_id=$rootid");
    foreach($order as $i=>$m){
        $ord=($i+1)*10;
        if((int)$m['me_order']!==$ord)bnq("UPDATE $mt SET me_order=$ord WHERE me_id=".(int)$m['me_id']." AND LENGTH(me_code)=2");
    }
    foreach($sub as $m){
        // A four-character native menu is a leaf. Only the exact old newsroom link is removed.
        bnq("DELETE FROM $mt WHERE me_id=".(int)$m['me_id']." AND me_code=".bnvalue($m['me_code'])." AND me_name=".bnvalue($m['me_name'])." AND me_link=".bnvalue($m['me_link']));
    }
    if(function_exists('run_event'))run_event('admin_menu_list_update');

}
function bnvalidate($a){
    if(!is_array($a)||!in_array($a['topic']??0,range(1,7),true)||!is_array($a['body']??null)||count($a['body'])<2||count($a['body'])>5)throw new RuntimeException('invalid article');
    foreach(array_merge([$a['publisher']??null,$a['title']??null],$a['body']) as $s){if(!is_string($s)||!trim($s)||mb_strlen($s)>1000)throw new RuntimeException('article text');}
    if(mb_strlen($a['title'])>120||mb_strlen($a['publisher'])>64||mb_strlen($a['url']??'')>250||!filter_var($a['url'],FILTER_VALIDATE_URL)||parse_url($a['url'],PHP_URL_SCHEME)!=='https'||parse_url($a['url'],PHP_URL_USER)!==null)throw new RuntimeException('article metadata');
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$a['date']??'');
    if(!$d||$d->format('Y-m-d')!==$a['date']||$a['date']>G5_TIME_YMD)throw new RuntimeException('article date');
}
function bnpublish($a,$admin_id,$write_point) {
    global $g5;
    $wt=$g5['write_prefix'].BN_BOARD;
    $key=hash('sha256',$a['url']);$event=hash('sha256',preg_replace('/[\p{P}\p{Z}\s]+/u','',mb_strtolower($a['title'])));
    $row=sql_fetch("SELECT wr_id,mb_id,wr_5 FROM `$wt` WHERE wr_is_comment=0 AND (wr_3='$key' OR wr_4='$event') LIMIT 1",false);
    $new=empty($row['wr_id']);
    if($new){
        $body='';
        foreach($a['body'] as $p)$body.='<p>'.bneh($p).'</p>';
        $body.='<p><strong>출처</strong> · '.bneh($a['publisher']).' · '.bneh($a['date']).' &nbsp; <a href="'.bneh($a['url']).'" target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a></p>';
        $post=['wr_num'=>get_next_num($wt),'wr_reply'=>'','wr_option'=>'html1','wr_subject'=>$a['title'],'wr_content'=>$body,
          'mb_id'=>$admin_id,'wr_name'=>'챗지기자','wr_datetime'=>G5_TIME_YMDHIS,'wr_last'=>G5_TIME_YMDHIS,'ca_name'=>BN_TOPICS[$a['topic']-1],
          'wr_1'=>$a['date'],'wr_2'=>$a['topic'],'wr_3'=>$key,'wr_4'=>$event,'wr_5'=>$write_point>0?'bn-point-pending-v1':'','wr_6'=>'bn-retro-checked-v1','wr_link1'=>$a['url'],'wr_link2'=>'','wr_ip'=>'','wr_seo_title'=>function_exists('generate_seo_title')?generate_seo_title($a['title']):''];
        bnq("INSERT INTO `$wt` SET ".bnset($post));$id=(int)sql_insert_id();
    }else{$id=(int)$row['wr_id'];}
    bnq("UPDATE `$wt` SET wr_parent=$id WHERE wr_id=$id AND wr_parent=0");
    $nt=$g5['board_new_table'];
    bnq("INSERT INTO $nt (bo_table,wr_id,wr_parent,bn_datetime,mb_id) SELECT 'busan_news',$id,$id,wr_datetime,mb_id FROM `$wt` WHERE wr_id=$id AND wr_datetime>=DATE_SUB(NOW(),INTERVAL 7 DAY) AND NOT EXISTS(SELECT 1 FROM $nt WHERE bo_table='busan_news' AND wr_id=$id)");
    // Only articles created under this policy receive writing points. Native relation
    // keys make recovery idempotent, including a retry after an interrupted award.
    $pending=$new ? $write_point>0 : ($row['wr_5']??'')==='bn-point-pending-v1';
    if($pending){
        $recipient=$new ? $admin_id : (string)$row['mb_id'];
        if($write_point<=0 || $recipient==='')throw new RuntimeException('news point policy unavailable');
        if(!function_exists('insert_point'))throw new RuntimeException('point ledger unavailable');
        insert_point($recipient,$write_point,'챗지기자 기사 발행 +'.$write_point.'P',BN_BOARD,(string)$id,'쓰기');
        $pt=$g5['point_table'];
        $entry=sql_fetch("SELECT po_point FROM $pt WHERE mb_id=".bnvalue($recipient)." AND po_rel_table=".bnvalue(BN_BOARD)." AND po_rel_id=".bnvalue((string)$id)." AND po_rel_action=".bnvalue('쓰기')." LIMIT 1",false);
        if((int)($entry['po_point']??0)<=0)throw new RuntimeException('news point not verified');
        bnq("UPDATE `$wt` SET wr_5='bn-point-credited-v1' WHERE wr_id=$id AND wr_5='bn-point-pending-v1'");
    }
    return ['id'=>$id,'created'=>$new];
}

/* Owner-approved historical migration: article authorship is unchanged; only
 * missing positive awards for authentic reporter posts are restored.
 * Use the same relation keys as native writing and the existing good hook.
 * Run only during the deployment importer, never the recurring news workflow.
 */
function bnrestore_point($admin,$amount,$description,$table,$id,$action){
    global $g5;
    $pt=$g5['point_table'];
    $where="mb_id=".bnvalue($admin)." AND po_rel_table=".bnvalue($table).
           " AND po_rel_id=".bnvalue((string)$id)." AND po_rel_action=".bnvalue($action);
    $row=sql_fetch("SELECT po_point FROM $pt WHERE $where LIMIT 1",false);
    if(isset($row['po_point'])){
        if((int)$row['po_point']<=0)throw new RuntimeException('existing nonpositive reward conflict');
        return 0;
    }
    $result=insert_point($admin,$amount,$description,$table,(string)$id,$action);
    $saved=sql_fetch("SELECT po_point FROM $pt WHERE $where LIMIT 1",false);
    if((int)($saved['po_point']??0)!==$amount)throw new RuntimeException('historical reward not verified');
    return (int)$result===1 ? $amount : 0;
}
function bnretro($admin,$write_point){
    global $g5;
    if($write_point!==10||!function_exists('insert_point')||!function_exists('bp_on_good'))
        throw new RuntimeException('historical policy not ready');
    $wt=$g5['write_prefix'].BN_BOARD;$gt=$g5['board_good_table'];$pt=$g5['point_table'];
    foreach([$wt,$gt,$pt] as $table)
        if(!preg_match('/^[A-Za-z0-9_]{1,90}$/D',$table))throw new RuntimeException('invalid point table');
    $board=sql_fetch("SELECT bo_10 FROM {$g5['board_table']} WHERE bo_table='busan_news'",false);
    if(($board['bo_10']??'')!==BN_MARK)throw new RuntimeException('unexpected newsroom');
    $reporter="wr_is_comment=0 AND wr_name=".bnvalue('챗지기자')." AND CHAR_LENGTH(wr_3)=64 AND CHAR_LENGTH(wr_4)=64";
    $query=bnq("SELECT wr_id,mb_id,wr_5,wr_6 FROM $wt WHERE $reporter ORDER BY wr_id");
    $posts=[];
    while($row=sql_fetch_array($query)){
        if($row['mb_id']!==$admin)throw new RuntimeException('historical reporter owner differs from super admin');
        if(!in_array((string)$row['wr_6'],['','bn-retro-checked-v1'],true))throw new RuntimeException('historical marker conflict');
        if(!in_array((string)$row['wr_5'],['','bn-point-pending-v1','bn-point-credited-v1'],true))throw new RuntimeException('writing marker conflict');
        $posts[]=$row;
    }
    $receipt=['articles_total'=>count($posts),'articles_processed'=>0,'article_awards'=>0,'article_points'=>0,
              'recommendations_checked'=>0,'recommendation_awards'=>0,'recommendation_points'=>0,'total_points'=>0];
    foreach($posts as $row){
        if($row['wr_6']==='bn-retro-checked-v1')continue;
        $id=(int)$row['wr_id'];
        if($id<1)throw new RuntimeException('invalid article id');
        if($row['wr_5']!=='bn-point-credited-v1'){
            $amount=bnrestore_point($admin,10,'챗지기자 기존 기사 소급 +10P',BN_BOARD,$id,'쓰기');
            if($amount){$receipt['article_awards']++;$receipt['article_points']+=$amount;}
        }
        // Only recorded recommendations, never negative votes or self-votes.
        // Exclude recent votes that the live recommendation handler is processing.
        $votes=bnq("SELECT DISTINCT mb_id FROM $gt WHERE bo_table='busan_news' AND wr_id=$id AND bg_flag='good' AND mb_id<>".bnvalue($admin).
                   " AND bg_datetime < DATE_SUB(NOW(),INTERVAL 5 MINUTE)");
        while($vote=sql_fetch_array($votes)){
            $voter=(string)$vote['mb_id'];
            if(!preg_match('/^[A-Za-z0-9_-]{2,30}$/D',$voter))continue;
            $receipt['recommendations_checked']++;
            $key=substr(hash('sha256','t|'.BN_BOARD.'|'.$id.'|'.$voter),0,20);
            $amount=bnrestore_point($admin,5,'챗지기자 기존 기사 추천 소급 +5P','@busan_good_received',$key,'recommend');
            if($amount){$receipt['recommendation_awards']++;$receipt['recommendation_points']+=$amount;}
        }
        bnq("UPDATE $wt SET wr_5='bn-point-credited-v1',wr_6='bn-retro-checked-v1' WHERE wr_id=$id AND $reporter AND mb_id=".bnvalue($admin)." AND wr_6=''");
        $saved=sql_fetch("SELECT wr_5,wr_6 FROM $wt WHERE wr_id=$id",false);
        if(($saved['wr_5']??'')!=='bn-point-credited-v1'||($saved['wr_6']??'')!=='bn-retro-checked-v1')throw new RuntimeException('historical marker not verified');
        $receipt['articles_processed']++;
    }
    $receipt['total_points']=$receipt['article_points']+$receipt['recommendation_points'];
    return $receipt;
}

/* Authenticated deployment-only inventory: no article bodies or member IDs. */
function bnpreflight(){
    global $g5,$config;
    $bt=$g5['board_table'];$mt=$g5['menu_table'];$wt=$g5['write_prefix'].BN_BOARD;
    $board=sql_fetch("SELECT bo_10,bo_write_point,bo_use_good,bo_count_write,bo_count_comment FROM $bt WHERE bo_table='busan_news'",false);
    $result=['board_exists'=>!empty($board),'owned'=>($board['bo_10']??'')===BN_MARK,
       'write_point'=>(int)($board['bo_write_point']??0),'good_enabled'=>(int)($board['bo_use_good']??0),
       'points_enabled'=>!empty($config['cf_use_point']),'good_hook'=>function_exists('bp_on_good'),
       'topics'=>[],'related_counts'=>[],'engines'=>[],'menu'=>[],'target_boards'=>[]];
    $tables=['write'=>$wt,'board'=>$bt,'menu'=>$mt,'new'=>$g5['board_new_table'],'good'=>$g5['board_good_table'],'point'=>$g5['point_table']];
    foreach(['board_file_table','scrap_table'] as $key)if(!empty($g5[$key]))$tables[$key]=$g5[$key];
    foreach($tables as $kind=>$table){
        if(!preg_match('/^[A-Za-z0-9_]{1,90}$/D',$table))throw new RuntimeException('invalid inventory table');
        $status=sql_fetch("SHOW TABLE STATUS WHERE Name=".bnvalue($table),false);
        $result['engines'][$kind]=$status['Engine']??null;
        if(in_array($kind,['new','good','board_file_table','scrap_table'],true)&&!empty($status)){
            $n=sql_fetch("SELECT COUNT(*) AS n FROM `$table` WHERE bo_table='busan_news'",false);
            $result['related_counts'][$kind]=isset($n['n'])?(int)$n['n']:null;
        }
    }
    if($result['engines']['write']){
        $rows=bnq("SELECT wr_2 AS topic,COUNT(*) AS articles,SUM(wr_name='챗지기자' AND CHAR_LENGTH(wr_3)=64 AND CHAR_LENGTH(wr_4)=64) AS reporter_posts,SUM(wr_5='bn-point-pending-v1') AS pending_points FROM `$wt` WHERE wr_is_comment=0 GROUP BY wr_2");
        while($x=sql_fetch_array($rows))$result['topics'][]=['topic'=>preg_match('/^[1-7]$/D',(string)$x['topic'])?(int)$x['topic']:0,'articles'=>(int)$x['articles'],'reporter_posts'=>(int)$x['reporter_posts'],'pending_points'=>(int)$x['pending_points']];
        $n=sql_fetch("SELECT COUNT(*) AS n FROM `$wt` WHERE wr_is_comment<>0",false);
        $result['related_counts']['comments']=(int)($n['n']??0);
    }
    $q=bnq("SELECT me_code,me_name,me_order,me_link FROM $mt ORDER BY me_order,me_id");
    while($m=sql_fetch_array($q)){
        if(in_array(trim($m['me_name']),[BN_TITLE,'챗지기자 뉴스'],true)||strtolower(str_replace(' ','',trim($m['me_name'])))==='weruntogether'){
            $result['menu'][]=['code'=>$m['me_code'],'name'=>$m['me_name'],'order'=>(int)$m['me_order'],'is_news_link'=>strpos($m['me_link'],'bo_table=busan_news')!==false];
        }
    }
    foreach(['busan_news_company','busan_news_union','busan_news_law','busan_news_world'] as $id){
        $x=sql_fetch("SELECT bo_10 FROM $bt WHERE bo_table=".bnvalue($id),false);
        $t=sql_fetch("SHOW TABLE STATUS WHERE Name=".bnvalue($g5['write_prefix'].$id),false);
        $result['target_boards'][$id]=['board_exists'=>!empty($x),'owned'=>($x['bo_10']??'')===BN_MARK,'table_exists'=>!empty($t)];
    }
    return $result;
}
$stage='input';
try{
    $input=json_decode(file_get_contents('php://input',false,null,0,500000),true,32,JSON_THROW_ON_ERROR);
    if(!is_array($input)||count($input)>100)throw new RuntimeException('invalid batch');
    foreach($input as $a)bnvalidate($a);
    if (defined('BUSAN_ACCOUNT_NEWS')) {
        if (!array_is_list($input) || count($input)>7) throw new RuntimeException('edition size');
        foreach ($input as $a) if ($a['date']<date('Y-m-d',strtotime(G5_TIME_YMD.' -1 month'))) throw new RuntimeException('expired article');
    }
    $stage='lock'; $lock=sql_fetch("SELECT GET_LOCK('busan_news_publish_v1',15) AS ok",false);
    if((int)($lock['ok']??0)!==1)throw new RuntimeException('publisher busy');
    $mode=$_SERVER['HTTP_X_BUSAN_NEWS_DEPLOY_MODE']??'';
    if(!defined('BUSAN_ACCOUNT_NEWS')&&in_array($mode,['preflight','menu'],true)){
        if($input!==[])throw new RuntimeException('deployment inventory requires empty input');
        $stage=$mode;
        if($mode==='menu')bnsetup();
        echo json_encode(['ok'=>true,'inventory'=>bnpreflight()],JSON_UNESCAPED_UNICODE);
        exit;
    }
    $stage='setup';if (!defined('BUSAN_ACCOUNT_NEWS')) bnsetup();
    // Resolve the site's configured super administrator, never a display nickname.
    $admin_id=(string)($config['cf_admin']??'');
    if($admin_id==='')throw new RuntimeException('super administrator not configured');
    $actor=get_member($admin_id);
    if(($actor['mb_id']??'')!==$admin_id||!empty($actor['mb_leave_date'])||!empty($actor['mb_intercept_date']))throw new RuntimeException('super administrator unavailable');
    $policy=sql_fetch("SELECT bo_write_point FROM {$g5['board_table']} WHERE bo_table='busan_news' LIMIT 1",false);
    if(!isset($policy['bo_write_point']))throw new RuntimeException('news board policy missing');
    $write_point=!empty($config['cf_use_point'])?max(0,(int)$policy['bo_write_point']):0;
    $retro=null;
    if(!defined('BUSAN_ACCOUNT_NEWS')){$stage='historical_points';$retro=bnretro($admin_id,$write_point);}
    $stage='publish';$rows=[];foreach($input as $a)$rows[]=bnpublish($a,$admin_id,$write_point);
    bnq("UPDATE {$g5['board_table']} SET bo_count_write=(SELECT COUNT(*) FROM `{$g5['write_prefix']}busan_news` WHERE wr_is_comment=0) WHERE bo_table='busan_news'");
    if(function_exists('delete_cache_latest'))delete_cache_latest('busan_news');
    echo json_encode(['ok'=>true,'rows'=>$rows,'historical_points'=>$retro]);
}catch(Throwable $e){
    if(!defined('BUSAN_ACCOUNT_NEWS')){
        header('X-Busan-News-Stage: '.$stage);
        $reason=$e instanceof RuntimeException?$e->getMessage():get_class($e);
        if(preg_match('/^[A-Za-z0-9 _-]{1,100}$/D',$reason))header('X-Busan-News-Reason: '.$reason);
    }
    http_response_code(409);echo json_encode(['error'=>$stage.': '.($e instanceof RuntimeException?$e->getMessage():get_class($e))]);
}
