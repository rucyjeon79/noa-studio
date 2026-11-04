<?php
// Installed only for the duration of a release, with a fresh one-time token hash.
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !hash_equals('__TOKEN_HASH__', hash('sha256', $_SERVER['HTTP_X_BUSAN_NEWS'] ?? ''))) { http_response_code(404); exit; }
ini_set('display_errors','0');
require_once dirname(__DIR__) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
const BN_BOARD='busan_news';
const BN_MARK='busan-reporter-v1';
const BN_TOPICS=['홈앤서비스','SK브로드밴드','SK텔레콤','SK그룹','노동조합','노동법','노동관련 세계동향'];
function bnq($s) { $r=sql_query($s,false); if (!$r) throw new RuntimeException('database operation failed'); return $r; }
function bnvalue($v){ return "'".sql_real_escape_string((string)$v)."'"; }
function bneh($v){return htmlspecialchars($v, ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
function bnset($fields){$out=[];foreach($fields as $k=>$v){if(!preg_match('/^[a-zA-Z0-9_]+$/D',$k))throw new RuntimeException('column');$out[]="`$k`=".bnvalue($v);}return implode(',',$out);}
function bnsetup() {
    global $g5;
    $bt=$g5['board_table']; $mt=$g5['menu_table']; $wt=$g5['write_prefix'].BN_BOARD;
    $parent=sql_fetch("SELECT me_code FROM $mt WHERE LENGTH(me_code)=2 AND LOWER(TRIM(me_name))='we run together' LIMIT 1",false);
    if(empty($parent['me_code'])||!preg_match('/^[0-9a-z]{2}$/iD',$parent['me_code'])) throw new RuntimeException('We Run Together menu missing');
    $board=sql_fetch("SELECT * FROM $bt WHERE bo_table='busan_news'",false);
    if($board && $board['bo_10']!==BN_MARK)throw new RuntimeException('unrelated board with this ID');
    $template=sql_fetch("SELECT * FROM $bt WHERE bo_table='notice'",false);
    if(empty($template['bo_table']))throw new RuntimeException('board template missing');
    $join=sql_fetch("SELECT gr_id FROM $bt WHERE bo_table='join'",false);
    if(empty($join['gr_id']))throw new RuntimeException('board group missing');
    $group=get_group($join['gr_id']);if(empty($group)||!empty($group['gr_use_access']))throw new RuntimeException('news group restricts public reading');
    if(!$board){
        $settings=['bo_table'=>BN_BOARD,'gr_id'=>$join['gr_id'],'bo_subject'=>'챗지기자 뉴스','bo_mobile_subject'=>'챗지기자 뉴스','bo_10'=>BN_MARK,
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
        // On the launch edition these two native wrapper paths were empty.
        $layout=[];
        foreach(['bo_include_head','bo_include_tail'] as $field)
            if(isset($template[$field]) && trim($template[$field])!=='' && trim($board[$field])==='')$layout[$field]=$template[$field];
        if($layout)bnq("UPDATE $bt SET ".bnset($layout)." WHERE bo_table='busan_news' AND bo_10='".BN_MARK."'");
    }
    bnq("CREATE TABLE IF NOT EXISTS `$wt` LIKE `{$g5['write_prefix']}notice`");
    $prefix=$parent['me_code'];$url='https://skhnslu-busan.com/bbs/board.php?bo_table=busan_news';
    $existing=sql_fetch("SELECT me_id FROM $mt WHERE LEFT(me_code,2)=".bnvalue($prefix)." AND me_link=".bnvalue($url),false);
    if(empty($existing['me_id'])){
        $last=sql_fetch("SELECT MAX(RIGHT(me_code,2)) AS code,MAX(me_order) AS ord FROM $mt WHERE LENGTH(me_code)=4 AND LEFT(me_code,2)=".bnvalue($prefix),false);
        $suffix=base_convert((int)base_convert($last['code']?:'00',36,10)+36,10,36);
        if(strlen($suffix)!==2)throw new RuntimeException('menu group full');
        bnq("INSERT INTO $mt SET ".bnset(['me_code'=>$prefix.$suffix,'me_name'=>'챗지기자 뉴스','me_link'=>$url,'me_target'=>'self','me_order'=>(int)$last['ord']+1,'me_use'=>1,'me_mobile_use'=>1]));
        if(function_exists('run_event'))run_event('admin_menu_list_update');
    }
}
function bnvalidate($a){
    if(!is_array($a)||!in_array($a['topic']??0,range(1,7),true)||!is_array($a['body']??null)||count($a['body'])<2||count($a['body'])>5)throw new RuntimeException('invalid article');
    foreach(array_merge([$a['publisher']??null,$a['title']??null],$a['body']) as $s){if(!is_string($s)||!trim($s)||mb_strlen($s)>1000)throw new RuntimeException('article text');}
    if(mb_strlen($a['title'])>120||mb_strlen($a['publisher'])>64||mb_strlen($a['url']??'')>250||!filter_var($a['url'],FILTER_VALIDATE_URL)||parse_url($a['url'],PHP_URL_SCHEME)!=='https'||parse_url($a['url'],PHP_URL_USER)!==null)throw new RuntimeException('article metadata');
    $d=DateTimeImmutable::createFromFormat('!Y-m-d',$a['date']??'');
    if(!$d||$d->format('Y-m-d')!==$a['date']||$a['date']>G5_TIME_YMD)throw new RuntimeException('article date');
}
function bnpublish($a) {
    global $g5;
    $wt=$g5['write_prefix'].BN_BOARD;
    $key=hash('sha256',$a['url']);$event=hash('sha256',preg_replace('/[\p{P}\p{Z}\s]+/u','',mb_strtolower($a['title'])));
    $row=sql_fetch("SELECT wr_id FROM `$wt` WHERE wr_is_comment=0 AND (wr_3='$key' OR wr_4='$event') LIMIT 1",false);
    $new=empty($row['wr_id']);
    if($new){
        $body='';
        foreach($a['body'] as $p)$body.='<p>'.bneh($p).'</p>';
        $body.='<p><strong>출처</strong> · '.bneh($a['publisher']).' · '.bneh($a['date']).' &nbsp; <a href="'.bneh($a['url']).'" target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a></p>';
        $post=['wr_num'=>get_next_num($wt),'wr_reply'=>'','wr_option'=>'html1','wr_subject'=>$a['title'],'wr_content'=>$body,
          'mb_id'=>'busanjibuon','wr_name'=>'챗지기자','wr_datetime'=>G5_TIME_YMDHIS,'wr_last'=>G5_TIME_YMDHIS,'ca_name'=>BN_TOPICS[$a['topic']-1],
          'wr_1'=>$a['date'],'wr_2'=>$a['topic'],'wr_3'=>$key,'wr_4'=>$event,'wr_link1'=>$a['url'],'wr_link2'=>'','wr_ip'=>'','wr_seo_title'=>function_exists('generate_seo_title')?generate_seo_title($a['title']):''];
        bnq("INSERT INTO `$wt` SET ".bnset($post));$id=(int)sql_insert_id();
    }else{$id=(int)$row['wr_id'];}
    bnq("UPDATE `$wt` SET wr_parent=$id WHERE wr_id=$id AND wr_parent=0");
    $nt=$g5['board_new_table'];
    bnq("INSERT INTO $nt (bo_table,wr_id,wr_parent,bn_datetime,mb_id) SELECT 'busan_news',$id,$id,wr_datetime,mb_id FROM `$wt` WHERE wr_id=$id AND wr_datetime>=DATE_SUB(NOW(),INTERVAL 7 DAY) AND NOT EXISTS(SELECT 1 FROM $nt WHERE bo_table='busan_news' AND wr_id=$id)");
    return ['id'=>$id,'created'=>$new];
}
$stage='input';
try{
    $input=json_decode(file_get_contents('php://input',false,null,0,500000),true,32,JSON_THROW_ON_ERROR);
    if(!is_array($input)||count($input)>100)throw new RuntimeException('invalid batch');
    foreach($input as $a)bnvalidate($a);
    $stage='lock'; $lock=sql_fetch("SELECT GET_LOCK('busan_news_publish_v1',15) AS ok",false);
    if((int)($lock['ok']??0)!==1)throw new RuntimeException('publisher busy');
    $stage='setup';bnsetup();
    $actor=get_member('busanjibuon');if(empty($actor['mb_id']))throw new RuntimeException('reporter account missing');
    $stage='publish';$rows=[];foreach($input as $a)$rows[]=bnpublish($a);
    bnq("UPDATE {$g5['board_table']} SET bo_count_write=(SELECT COUNT(*) FROM `{$g5['write_prefix']}busan_news` WHERE wr_is_comment=0) WHERE bo_table='busan_news'");
    if(function_exists('delete_cache_latest'))delete_cache_latest('busan_news');
    echo json_encode(['ok'=>true,'rows'=>$rows]);
}catch(Throwable $e){http_response_code(409);echo json_encode(['error'=>$stage.': '.($e instanceof RuntimeException?$e->getMessage():get_class($e))]);}
