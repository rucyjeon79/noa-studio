<?php
// Authorize either a one-time deployment import or a verified newsroom identity.
if ($_SERVER['REQUEST_METHOD'] !== 'POST' || (!defined('BUSAN_ACCOUNT_NEWS') && !hash_equals('__TOKEN_HASH__', hash('sha256', $_SERVER['HTTP_X_BUSAN_NEWS'] ?? '')))) { http_response_code(404); exit; }
ini_set('display_errors','0');
require_once dirname(__DIR__) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
const BN_BOARD='busan_news';
const BN_TITLE='OpenAI 인사이트';
const BN_LEGACY_TITLES=['OpenAI 뉴스룸','챗지기자 뉴스'];
const BN_MARK='busan-reporter-v1';
const BN_ARCHIVE='busan-reporter-archive-v2';
const BN_SECTIONS=[
 'busan_news_company'=>['회사·그룹 소식',[1,2,3,4]],
 'busan_news_union'=>['노동조합 소식',[5]],
 'busan_news_law'=>['노동법·판례',[6]],
 'busan_news_world'=>['세계 노동 동향',[7]]
];
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
    if($board && !in_array($board['bo_10'],[BN_MARK,BN_ARCHIVE],true))throw new RuntimeException('unrelated board with this ID');
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
            if(in_array($board[$field],BN_LEGACY_TITLES,true))$updates[$field]=BN_TITLE;
        // On the launch edition these two native wrapper paths were empty.
        foreach(['bo_include_head','bo_include_tail'] as $field)
            if(isset($template[$field]) && trim($template[$field])!=='' && trim($board[$field])==='')$updates[$field]=$template[$field];
        if($updates)bnq("UPDATE $bt SET ".bnset($updates)." WHERE bo_table='busan_news' AND bo_10 IN (".bnvalue(BN_MARK).",".bnvalue(BN_ARCHIVE).")");
    }
    bnq("CREATE TABLE IF NOT EXISTS `$wt` LIKE `{$g5['write_prefix']}notice`");
    // Keep exactly one top-level newsroom. Never remove an unrelated menu.
    $url='https://skhnslu-busan.com/bbs/board.php?bo_table=busan_news';
    $roots=[];$sub=[];$used=[];$ordered=[];$conflict=false;
    $q=bnq("SELECT me_id,me_code,me_name,me_link,me_order,me_use,me_mobile_use FROM $mt ORDER BY me_order,me_id");
    while($m=sql_fetch_array($q)){
        $code=(string)$m['me_code'];$used[substr($code,0,2)]=true;
        if(strlen($code)===2)$ordered[]=$m;
        if(!in_array(trim($m['me_name']),array_merge([BN_TITLE],BN_LEGACY_TITLES),true))continue;
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

function bncount($table,$where='1'){
    $row=sql_fetch("SELECT COUNT(*) AS n FROM $table WHERE $where",false);
    if(!isset($row['n']))throw new RuntimeException('count unavailable');
    return (int)$row['n'];
}
function bnactive(){
    global $g5;
    $b=sql_fetch("SELECT bo_10 FROM {$g5['board_table']} WHERE bo_table='busan_news'",false);
    return ($b['bo_10']??'')===BN_ARCHIVE;
}
function bnsection($topic){
    foreach(BN_SECTIONS as $id=>$section)if(in_array((int)$topic,$section[1],true))return $id;
    throw new RuntimeException('unknown topic');
}
function bnboards(){return bnactive()?array_keys(BN_SECTIONS):[BN_BOARD];}
function bnsectionmenu(){
    global $g5;
    $mt=$g5['menu_table'];$base=G5_URL.'/bbs/board.php?bo_table=';
    $root=sql_fetch("SELECT me_code FROM $mt WHERE LENGTH(me_code)=2 AND me_name=".bnvalue(BN_TITLE)." LIMIT 1",false);
    $prefix=$root['me_code']??'';
    if(!preg_match('/^[a-z0-9]{2}$/iD',$prefix))throw new RuntimeException('newsroom root unavailable');
    $i=0;
    foreach(BN_SECTIONS as $id=>$section){
        $url=$base.$id;$i++;
        $found=sql_fetch("SELECT me_id,me_code FROM $mt WHERE me_link=".bnvalue($url)." AND LEFT(me_code,2)=".bnvalue($prefix)." AND LENGTH(me_code)=4",false);
        $fields=['me_name'=>$section[0],'me_link'=>$url,'me_order'=>$i*10,'me_use'=>1,'me_mobile_use'=>1,'me_target'=>'self'];
        if(!empty($found['me_id'])){
            bnq("UPDATE $mt SET ".bnset($fields)." WHERE me_id=".(int)$found['me_id']);
        }else{
            $code='';
            for($k=$i*10;$k<1296;$k++){
                $test=$prefix.str_pad(base_convert((string)$k,10,36),2,'0',STR_PAD_LEFT);
                if(!bncount($mt,"me_code=".bnvalue($test))){$code=$test;break;}
            }
            if(!$code)throw new RuntimeException('newsroom submenu full');
            bnq("INSERT INTO $mt SET ".bnset(['me_code'=>$code]+$fields));
        }
    }
    if(function_exists('run_event'))run_event('admin_menu_list_update');
}
function bnsplit(){
    global $g5,$config;
    $bt=$g5['board_table'];$src=$g5['write_prefix'].BN_BOARD;
    $nt=$g5['board_new_table'];$gt=$g5['board_good_table'];
    $ft=$g5['board_file_table'];$st=$g5['scrap_table'];
    $admin=(string)($config['cf_admin']??'');$actor=get_member($admin);
    if(!$admin||($actor['mb_id']??'')!==$admin||!empty($actor['mb_leave_date'])||!empty($actor['mb_intercept_date']))throw new RuntimeException('reward recipient unavailable');
    $root=sql_fetch("SELECT * FROM $bt WHERE bo_table='busan_news'",false);
    if(!in_array($root['bo_10']??'',[BN_MARK,BN_ARCHIVE],true))throw new RuntimeException('unowned legacy board');
    if((int)$root['bo_write_point']!==10||(int)$root['bo_read_point']!==0||(int)$root['bo_use_good']!==1)throw new RuntimeException('news reward policy changed');
    $targets=[];$tables=[$bt,$src,$nt,$gt,$ft,$st];
    foreach(BN_SECTIONS as $id=>$section){
        $dest=$g5['write_prefix'].$id;$targets[$id]=$dest;$tables[]=$dest;
    }
    foreach($tables as $t)if(!preg_match('/^[a-zA-Z0-9_]{1,90}$/D',$t))throw new RuntimeException('invalid migration table');
    if(($root['bo_10']??'')===BN_ARCHIVE){
        foreach($targets as $id=>$dest){
            $b=sql_fetch("SELECT bo_10 FROM $bt WHERE bo_table=".bnvalue($id),false);
            if(($b['bo_10']??'')!==BN_MARK)throw new RuntimeException('split board missing');
        }
        bnsectionmenu();
        return ['already_active'=>true,'inventory'=>bnpreflight()];
    }
    // Phase 1: create only managed, initially private native boards.
    foreach($targets as $id=>$dest){
        $section=BN_SECTIONS[$id];$existing=sql_fetch("SELECT * FROM $bt WHERE bo_table=".bnvalue($id),false);
        $physical=sql_fetch("SHOW TABLE STATUS WHERE Name=".bnvalue($dest),false);
        if($existing && (($existing['bo_10']??'')!==BN_MARK||(int)$existing['bo_list_level']!==10||(int)$existing['bo_read_level']!==10))
            throw new RuntimeException('split board ownership conflict');
        if(!$existing && $physical)throw new RuntimeException('unclaimed split write table');
        if(!$existing){
            $fields=$root;
            $fields=array_replace($fields,['bo_table'=>$id,'bo_subject'=>$section[0],'bo_mobile_subject'=>$section[0],
              'bo_notice'=>'','bo_count_write'=>0,'bo_count_comment'=>0,'bo_list_level'=>10,'bo_read_level'=>10,
              'bo_use_search'=>0,'bo_use_category'=>$id==='busan_news_company'?1:0,
              'bo_category_list'=>$id==='busan_news_company'?implode('|',array_slice(BN_TOPICS,0,4)):'','bo_10'=>BN_MARK]);
            bnq("INSERT INTO $bt SET ".bnset($fields));
        }
        bnq("CREATE TABLE IF NOT EXISTS $dest LIKE $src");
    }
    // MyISAM has no rollback. Keep the original physical rows untouched as the
    // rollback archive and lock all affected tables while copying and switching.
    bnq('LOCK TABLES '.implode(', ',array_map(static function($t){return $t.' WRITE';},$tables)));
    $activated=false;$moved=false;$report=[];
    try{
        $root=sql_fetch("SELECT bo_10,bo_notice FROM $bt WHERE bo_table='busan_news'",false);
        if(($root['bo_10']??'')!==BN_MARK||!empty($root['bo_notice']))throw new RuntimeException('legacy board changed');
        $total=bncount($src);
        if(!$total||bncount($src,"wr_is_comment<>0 OR wr_name<>".bnvalue('챗지기자')." OR CHAR_LENGTH(wr_3)<>64 OR CHAR_LENGTH(wr_4)<>64 OR wr_2 NOT IN ('1','2','3','4','5','6','7') OR wr_5='bn-point-pending-v1' OR wr_parent<>wr_id")>0)
            throw new RuntimeException('legacy articles need manual review');
        if(bncount($ft,"bo_table='busan_news'")||bncount($st,"bo_table='busan_news'"))throw new RuntimeException('new attachment or scrap requires migration');
        $allids=implode(',',array_map('bnvalue',array_keys(BN_SECTIONS)));
        $oldgood=bncount($gt,"bo_table IN ('busan_news',$allids)");
        $oldnew=bncount($nt,"bo_table IN ('busan_news',$allids)");
        foreach($targets as $id=>$dest){
            $topics=implode(',',array_map('bnvalue',BN_SECTIONS[$id][1]));
            $condition="wr_2 IN ($topics)";
            if(bncount($dest,"wr_id NOT IN (SELECT wr_id FROM $src WHERE $condition)")>0)throw new RuntimeException('unexpected split article');
            bnq("REPLACE INTO $dest SELECT * FROM $src WHERE $condition");
            $expected=bncount($src,$condition);
            if(bncount($dest)!==$expected)throw new RuntimeException('split article count mismatch');
            $rows=bnq("SELECT * FROM $src WHERE $condition ORDER BY wr_id");
            while($row=sql_fetch_array($rows)){
                $copy=sql_fetch("SELECT * FROM $dest WHERE wr_id=".(int)$row['wr_id'],false);
                if($row!==$copy)throw new RuntimeException('split article content mismatch');
            }
            // Preserve the original owner in the archive; on the active reporter
            // copies future native recommendation awards belong to the configured
            // super administrator. The historical points ledger is never rewritten.
            $changed=bncount($dest,"mb_id<>".bnvalue($admin));
            if($changed)bnq("UPDATE $dest SET mb_id=".bnvalue($admin));
            if(bncount($dest,"mb_id<>".bnvalue($admin)))throw new RuntimeException('reward owner verification failed');
            $report[$id]=['articles'=>$expected,'future_reward_owner_normalized'=>$changed];
        }
        if(array_sum(array_column($report,'articles'))!==$total)throw new RuntimeException('split totals differ');
        $moved=true;
        foreach($targets as $id=>$dest){
            foreach([$gt,$nt] as $rel){
                bnq("UPDATE $rel SET bo_table=".bnvalue($id)." WHERE bo_table='busan_news' AND wr_id IN (SELECT wr_id FROM $dest)");
            }
            $report[$id]['recommendations']=bncount($gt,"bo_table=".bnvalue($id));
            $report[$id]['recent_records']=bncount($nt,"bo_table=".bnvalue($id));
        }
        if(bncount($gt,"bo_table='busan_news'")||bncount($nt,"bo_table='busan_news'")||
           array_sum(array_column($report,'recommendations'))!==$oldgood||array_sum(array_column($report,'recent_records'))!==$oldnew)
            throw new RuntimeException('related record count mismatch');
        foreach($targets as $id=>$dest){
            bnq("UPDATE $bt SET bo_list_level=1,bo_read_level=1,bo_use_search=1,bo_count_write=".$report[$id]['articles'].",bo_count_comment=0 WHERE bo_table=".bnvalue($id)." AND bo_10=".bnvalue(BN_MARK));
        }
        // Single activation flag controls reader redirects and publisher routing.
        bnq("UPDATE $bt SET bo_10=".bnvalue(BN_ARCHIVE).",bo_use_search=0 WHERE bo_table='busan_news' AND bo_10=".bnvalue(BN_MARK));
        $saved=sql_fetch("SELECT bo_10 FROM $bt WHERE bo_table='busan_news'",false);
        if(($saved['bo_10']??'')!==BN_ARCHIVE)throw new RuntimeException('split activation failed');
        $activated=true;
    }catch(Throwable $ex){
        if(!$activated){
            // Never delete originals. Restore any moved native references before
            // reopening the old list, and hide the new boards on a normal error.
            foreach($targets as $id=>$dest){
                if($moved)foreach([$gt,$nt] as $rel)bnq("UPDATE $rel SET bo_table='busan_news' WHERE bo_table=".bnvalue($id)." AND wr_id IN (SELECT wr_id FROM $src)");
                bnq("UPDATE $bt SET bo_list_level=10,bo_read_level=10,bo_use_search=0 WHERE bo_table=".bnvalue($id)." AND bo_10=".bnvalue(BN_MARK));
            }
        }
        throw $ex;
    }finally{sql_query('UNLOCK TABLES',false);}
    foreach(array_merge([BN_BOARD],array_keys(BN_SECTIONS)) as $id)if(function_exists('delete_cache_latest'))delete_cache_latest($id);
    bnsectionmenu();
    return ['already_active'=>false,'archive_articles'=>$total,'moved_recommendations'=>$oldgood,'moved_recent_records'=>$oldnew,'boards'=>$report];
}


/* Rights note: retain the existing native board and every permission setting. */
function bnrights_menu(){
    global $g5;
    $mt=$g5['menu_table'];$bt=$g5['board_table'];
    $board=sql_fetch("SELECT bo_table,bo_subject FROM $bt WHERE bo_table='note'",false);
    if(($board['bo_table']??'')!=='note'||str_replace(' ','',trim($board['bo_subject']??''))!=='권리노트')throw new RuntimeException('rights board identity not verified');
    $root=sql_fetch("SELECT me_code FROM $mt WHERE LENGTH(me_code)=2 AND me_name=".bnvalue(BN_TITLE)." LIMIT 1",false);
    $prefix=$root['me_code']??'';
    if(!preg_match('/^[a-z0-9]{2}$/iD',$prefix))throw new RuntimeException('newsroom root unavailable');
    $q=bnq("SELECT me_id,me_code,me_name,me_link,me_order FROM $mt WHERE LENGTH(me_code)=4 ORDER BY me_id");
    $matches=[];
    while($m=sql_fetch_array($q)){
        if(str_replace(' ','',trim($m['me_name']))!=='권리노트')continue;
        $link=parse_url($m['me_link']);$args=[];
        if(!is_array($link))throw new RuntimeException('rights menu link conflict');
        parse_str($link['query']??'',$args);
        if(!in_array(strtolower($link['host']??''),['','skhnslu-busan.com','www.skhnslu-busan.com','rucyjeon79.dothome.co.kr'],true)
           ||!(in_array(rtrim($link['path']??'','/'),['/note','note'],true)||(($link['path']??'')==='/bbs/board.php'&&$args===['bo_table'=>'note'])))
            throw new RuntimeException('rights menu link conflict');
        $matches[]=$m;
    }
    if(count($matches)!==1)throw new RuntimeException('rights menu missing or duplicated');
    $m=$matches[0];$code=$m['me_code'];
    if(substr($code,0,2)!==$prefix){
        $code='';
        for($k=50;$k<1296;$k++){
            $test=$prefix.str_pad(base_convert((string)$k,10,36),2,'0',STR_PAD_LEFT);
            if(!bncount($mt,"me_code=".bnvalue($test))){$code=$test;break;}
        }
        if(!$code)throw new RuntimeException('rights submenu full');
    }
    bnq("UPDATE $mt SET ".bnset(['me_code'=>$code,'me_order'=>50,'me_name'=>'권리노트'])." WHERE me_id=".(int)$m['me_id']." AND me_code=".bnvalue($m['me_code']));
    $saved=sql_fetch("SELECT me_code,me_name,me_order FROM $mt WHERE me_id=".(int)$m['me_id'],false);
    if(($saved['me_code']??'')!==$code||($saved['me_name']??'')!=='권리노트'||(int)($saved['me_order']??0)!==50)throw new RuntimeException('rights menu not verified');
    if(function_exists('run_event'))run_event('admin_menu_list_update');
    return ['code'=>$code,'name'=>'권리노트','board'=>'note'];
}
// Read-only shape audit of every actual rights-note body, without exposing
// the member-only original text, title, author, attachment URLs or other data.
function bnrights_layout_audit(){
    global $g5;
    $bt=$g5['board_table'];$wt=$g5['write_prefix'].'note';
    $board=sql_fetch("SELECT bo_subject,bo_list_level,bo_read_level FROM $bt WHERE bo_table='note'",false);
    if(str_replace(' ','',trim($board['bo_subject']??''))!=='권리노트')throw new RuntimeException('rights board audit identity invalid');
    $q=bnq("SELECT wr_id,wr_subject,wr_content,wr_6,wr_option,wr_name,wr_is_comment FROM $wt WHERE wr_is_comment=0 ORDER BY wr_id");
    $report=['total'=>0,'legacy'=>0,'new_format'=>0,'paragraphs'=>0,'line_breaks'=>0,'headings'=>0,'lists'=>0,'tables'=>0,'plain_text'=>0,'interactive_fallback'=>0,'server_render_verified'=>0,'server_render_failed_ids'=>[],'question_group_audit'=>[],'visual_audit'=>[],'numbered_heading_audit'=>[],'read_level'=>(int)$board['bo_read_level'],'list_level'=>(int)$board['bo_list_level']];
    while($r=sql_fetch_array($q)){
        $body=(string)$r['wr_content'];$report['total']++;
        $report[$r['wr_6']==='bn-rights-note-v1'?'new_format':'legacy']++;
        foreach(['paragraphs'=>'p|div','line_breaks'=>'br','headings'=>'h[1-6]|strong|b','lists'=>'ul|ol|dl','tables'=>'table','interactive_fallback'=>'script|style|form|iframe|object|embed|template'] as $key=>$tags)
            if(preg_match('~<(?:'.$tags.')\b~i',$body))$report[$key]++;
        if($body===strip_tags($body))$report['plain_text']++;
        // Exercise the same deployed view hook and native HTML converter on every
        // actual database row, without exposing its contents in the release log.
        $originalWrite=$GLOBALS['write']??null;
        try{
            $GLOBALS['write']=$r;
            if(function_exists('busan_rights_prepare_body'))busan_rights_prepare_body('', ['bo_table'=>'note']);
            $out=$GLOBALS['write']['wr_content']??'';
            $rendered=($out!==$body && function_exists('conv_content'))?conv_content($out,1):$out;
            $ok=$out!==$body&&strpos($rendered,'bn-rights-guide')!==false
                &&strpos($GLOBALS['write']['wr_option']??'','html1')!==false;
            if($ok&&$r['wr_6']!=='bn-rights-note-v1'){
                $normalize=static function($s){return preg_replace('/[\s\x{00A0}]+/u','',html_entity_decode($s,ENT_QUOTES,'UTF-8'));};
                $source=preg_replace('/\*\*([^*\r\n]+)\*\*/u','$1',$body);
                // When emphasis spans native lines it can be retained verbatim.
                $ok=($normalize(strip_tags($rendered))===$normalize($source)||$normalize(str_replace('**','',strip_tags($rendered)))===$normalize(str_replace('**','',$body)))
                    &&strpos($rendered,'bn-rights-compact-text')!==false
                    &&!preg_match('~<br\s*/?>\s*<br\s*/?>~i',$rendered);
                $expected=0;
                foreach(preg_split('/\R/u',$body) as $line)if(busan_rights_question_line($line))$expected++;
                $actual=substr_count($rendered,'bn-rights-topic-qa');
                $report['question_group_audit'][]=['id'=>(int)$r['wr_id'],'expected'=>$expected,'actual'=>$actual];
                $ok=$ok&&$expected===$actual;
                $numbered=0;
                foreach(preg_split('/\R/u',$body) as $line)if(busan_rights_numbered_heading($line))$numbered++;
                if(!$expected&&$numbered>=2){
                    $headingCount=substr_count($rendered,'bn-rights-topic bn-rights-topic-heading');
                    $report['numbered_heading_audit'][]=['id'=>(int)$r['wr_id'],'numbered'=>$numbered,'rendered_headings'=>$headingCount];
                    $ok=$ok&&$headingCount>=$numbered;
                }
            }
            if($ok){
                $cards=substr_count($rendered,'bn-rights-section-card ')+substr_count($rendered,'bn-rights-topic bn-rights-topic-qa')+substr_count($rendered,'bn-rights-topic bn-rights-topic-heading');
                if(!$cards)$cards=substr_count($rendered,'bn-rights-topic bn-rights-topic-intro');
                $visuals=preg_match_all('/\bbn-rights-visual-(?:evacuate|pay|time|leave|injury|safety|record|union|contract|law|check|example|question|answer|guide)\b/',$rendered,$visualMatches);
                $report['visual_audit'][]=['id'=>(int)$r['wr_id'],'cards'=>$cards,'illustrations'=>$visuals];
                $ok=$cards>0&&$visuals===$cards;
            }
            if($ok)$report['server_render_verified']++;
            else $report['server_render_failed_ids'][]=(int)$r['wr_id'];
        }finally{$GLOBALS['write']=$originalWrite;}
    }
    return $report;
}
// A separate schedule-only operation. The outer publisher advisory lock
// serializes this with other importer requests; no news or menu rewrite.
function bnrights_daily($input){
    global $g5;
    if(!array_is_list($input)||count($input)!==1)throw new RuntimeException('daily rights requires one candidate');
    $a=$input[0];$now=new DateTimeImmutable('now',new DateTimeZone('Asia/Seoul'));
    $day=$now->format('Y-m-d');
    if(($a['publish_date']??'')!==$day||$now->format('H:i')<'08:00')throw new RuntimeException('daily rights outside release window');
    if(!preg_match('/^[a-z0-9-]{4,80}$/D',$a['slug']??''))throw new RuntimeException('daily rights slug invalid');
    $wt=$g5['write_prefix'].'note';
    $key=hash('sha256','busan-rights-note:'.$a['slug']);
    $same=sql_fetch("SELECT wr_id,wr_3,wr_5 FROM $wt WHERE wr_is_comment=0 AND wr_3=".bnvalue($key)." LIMIT 1",false);
    $first=$day.' 00:00:00';$next=$now->modify('+1 day')->format('Y-m-d').' 00:00:00';
    $count=bncount($wt,"wr_is_comment=0 AND wr_name=".bnvalue('챗지기자')." AND wr_datetime>=".bnvalue($first)." AND wr_datetime<".bnvalue($next));
    if($count>0&&empty($same['wr_id']))return ['status'=>'already_published_today','date'=>$day,'created'=>0];
    if(!empty($same['wr_id'])&&($same['wr_5']??'')!=='bn-point-pending-v1')return ['status'=>'already_published','date'=>$day,'created'=>0,'id'=>(int)$same['wr_id']];
    $result=bnrights_publish($input);
    $row=$result['rows'][0]??[];
    if(empty($row['id'])||empty($result['permissions_preserved']))throw new RuntimeException('daily rights receipt missing');
    return ['status'=>$row['status']??'unknown','date'=>$day,'created'=>!empty($row['created'])?1:0,'id'=>(int)$row['id'],'write_point'=>$result['write_point'],'permissions_preserved'=>true];
}
function bnrights_publish($input){
    global $g5,$config;
    if(!bnactive())throw new RuntimeException('newsroom split not active');
    $menu=bnrights_menu();
    $bt=$g5['board_table'];$wt=$g5['write_prefix'].'note';
    $board=sql_fetch("SELECT * FROM $bt WHERE bo_table='note'",false);
    $admin=(string)($config['cf_admin']??'');$actor=get_member($admin);
    if(!$admin||($actor['mb_id']??'')!==$admin||!empty($actor['mb_leave_date'])||!empty($actor['mb_intercept_date']))throw new RuntimeException('rights author unavailable');
    if(!preg_match('/^[a-zA-Z0-9_]{1,90}$/D',$wt))throw new RuntimeException('rights table invalid');
    if(!array_is_list($input)||count($input)>3)throw new RuntimeException('rights batch invalid');
    $categories=array_values(array_filter(array_map('trim',explode('|',$board['bo_category_list']??''))));
    $policy=!empty($config['cf_use_point'])?max(0,(int)$board['bo_write_point']):0;
    $prepared=[];
    foreach($input as $a){
        if(!is_array($a)||!preg_match('/^[a-z0-9-]{4,80}$/D',$a['slug']??'')||!is_string($a['title']??null)||mb_strlen($a['title'])>120||!is_array($a['body']??null)||count($a['body'])<3||count($a['body'])>8)throw new RuntimeException('rights article invalid');
        foreach($a['body'] as $s)if(!is_string($s)||!trim($s)||mb_strlen($s)>1500)throw new RuntimeException('rights article paragraph invalid');
        $category='';
        if(!empty($board['bo_use_category'])){
            foreach($categories as $c)if(preg_match('/현장|공감|기타|일반|정보|신규|필독/u',$c)){$category=$c;break;}
            if(!$category&&$categories)$category=$categories[0];
            if(!$category)throw new RuntimeException('rights category unavailable');
        }
        $prepared[]=[$a,$category];
    }
    $rows=[];
    foreach($prepared as [$a,$category]){
        $key=hash('sha256','busan-rights-note:'.$a['slug']);
        $event=hash('sha256',preg_replace('/[\p{P}\p{Z}\s]+/u','',mb_strtolower($a['title'])));
        $row=sql_fetch("SELECT wr_id,mb_id,wr_name,wr_3,wr_5 FROM $wt WHERE wr_is_comment=0 AND (wr_3=".bnvalue($key)." OR wr_subject=".bnvalue($a['title']).") LIMIT 1",false);
        $new=empty($row['wr_id']);
        if($new){
            $body='';
            foreach($a['body'] as $s)$body.='<p>'.bneh($s).'</p>';
            $body.='<p>작성: 챗지기자 · 부산지부 AI 기자. 일반적인 현장 기록 및 상담 준비 안내이며, 개별 법률 판단이나 회사 지침을 대신하지 않습니다.</p>';
            $post=['wr_num'=>get_next_num($wt),'wr_reply'=>'','wr_option'=>'html1','wr_subject'=>$a['title'],'wr_content'=>$body,
              'mb_id'=>$admin,'wr_name'=>'챗지기자','wr_datetime'=>G5_TIME_YMDHIS,'wr_last'=>G5_TIME_YMDHIS,'ca_name'=>$category,
              'wr_3'=>$key,'wr_4'=>$event,'wr_5'=>$policy>0?'bn-point-pending-v1':'','wr_6'=>'bn-rights-note-v1','wr_ip'=>'',
              'wr_seo_title'=>function_exists('generate_seo_title')?generate_seo_title($a['title']):''];
            bnq("INSERT INTO $wt SET ".bnset($post));$id=(int)sql_insert_id();
        }else{
            $id=(int)$row['wr_id'];
            if(($row['wr_3']??'')!==$key||($row['wr_name']??'')!=='챗지기자'){
                $rows[]=['id'=>$id,'created'=>false,'status'=>'existing_title_preserved'];continue;
            }
        }
        bnq("UPDATE $wt SET wr_parent=$id WHERE wr_id=$id AND wr_parent=0");
        $nt=$g5['board_new_table'];
        bnq("INSERT INTO $nt (bo_table,wr_id,wr_parent,bn_datetime,mb_id) SELECT 'note',$id,$id,wr_datetime,mb_id FROM $wt WHERE wr_id=$id AND wr_datetime>=DATE_SUB(NOW(),INTERVAL 7 DAY) AND NOT EXISTS(SELECT 1 FROM $nt WHERE bo_table='note' AND wr_id=$id)");
        if($new?$policy>0:($row['wr_5']??'')==='bn-point-pending-v1'){
            $recipient=$new?$admin:(string)$row['mb_id'];
            if($policy<=0||$recipient!==$admin)throw new RuntimeException('rights point policy changed');
            insert_point($recipient,$policy,'챗지기자 권리노트 발행 +'.$policy.'P','note',(string)$id,'쓰기');
            $pt=$g5['point_table'];
            $entry=sql_fetch("SELECT po_point FROM $pt WHERE mb_id=".bnvalue($recipient)." AND po_rel_table='note' AND po_rel_id=".bnvalue((string)$id)." AND po_rel_action=".bnvalue('쓰기')." LIMIT 1",false);
            if((int)($entry['po_point']??0)!==$policy)throw new RuntimeException('rights reward not verified');
            bnq("UPDATE $wt SET wr_5='bn-point-credited-v1' WHERE wr_id=$id AND wr_5='bn-point-pending-v1'");
        }
        $saved=sql_fetch("SELECT wr_subject,wr_name,wr_3,wr_parent FROM $wt WHERE wr_id=$id",false);
        if(($saved['wr_subject']??'')!==$a['title']||($saved['wr_name']??'')!=='챗지기자'||($saved['wr_3']??'')!==$key||(int)$saved['wr_parent']!==$id)throw new RuntimeException('rights post verification failed');
        $rows[]=['id'=>$id,'created'=>$new,'status'=>'verified','category'=>$category];
    }
    bnq("UPDATE $bt SET bo_count_write=(SELECT COUNT(*) FROM $wt WHERE wr_is_comment=0) WHERE bo_table='note'");
    if(function_exists('delete_cache_latest'))delete_cache_latest('note');
    $after=sql_fetch("SELECT * FROM $bt WHERE bo_table='note'",false);
    foreach(['gr_id','bo_list_level','bo_read_level','bo_write_level','bo_comment_level','bo_write_point','bo_read_point','bo_use_cert','bo_use_category','bo_category_list'] as $field)if(($after[$field]??null)!==($board[$field]??null))throw new RuntimeException('rights permission or policy changed');
    return ['menu'=>$menu,'rows'=>$rows,'list_level'=>(int)$board['bo_list_level'],'read_level'=>(int)$board['bo_read_level'],'write_point'=>$policy,'permissions_preserved'=>true,'layout_audit'=>bnrights_layout_audit()];
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
    $boards=bnboards();
    $dest=count($boards)===1?BN_BOARD:bnsection($a['topic']);
    $wt=$g5['write_prefix'].$dest;
    $key=hash('sha256',$a['url']);$event=hash('sha256',preg_replace('/[\p{P}\p{Z}\s]+/u','',mb_strtolower($a['title'])));
    $row=[];$next=1;
    foreach($boards as $candidate){
        $table=$g5['write_prefix'].$candidate;
        $existing=sql_fetch("SELECT wr_id,mb_id,wr_5 FROM `$table` WHERE wr_is_comment=0 AND (wr_3='$key' OR wr_4='$event') LIMIT 1",false);
        if(!empty($existing['wr_id'])){$row=$existing;$dest=$candidate;$wt=$table;break;}
        $max=sql_fetch("SELECT MAX(wr_id) AS id FROM `$table`",false);
        $next=max($next,(int)($max['id']??0)+1);
    }
    $new=empty($row['wr_id']);
    if($new){
        $body='';
        foreach($a['body'] as $p)$body.='<p>'.bneh($p).'</p>';
        $body.='<p><strong>출처</strong> · '.bneh($a['publisher']).' · '.bneh($a['date']).' &nbsp; <a href="'.bneh($a['url']).'" target="_blank" rel="noopener noreferrer">원문 읽기 ↗</a></p>';
        $post=['wr_id'=>$next,'wr_num'=>get_next_num($wt),'wr_reply'=>'','wr_option'=>'html1','wr_subject'=>$a['title'],'wr_content'=>$body,
          'mb_id'=>$admin_id,'wr_name'=>'챗지기자','wr_datetime'=>G5_TIME_YMDHIS,'wr_last'=>G5_TIME_YMDHIS,'ca_name'=>($dest===BN_BOARD||$dest==='busan_news_company')?BN_TOPICS[$a['topic']-1]:'',
          'wr_1'=>$a['date'],'wr_2'=>$a['topic'],'wr_3'=>$key,'wr_4'=>$event,'wr_5'=>$write_point>0?'bn-point-pending-v1':'','wr_6'=>'bn-retro-checked-v1','wr_link1'=>$a['url'],'wr_link2'=>'','wr_ip'=>'','wr_seo_title'=>function_exists('generate_seo_title')?generate_seo_title($a['title']):''];
        bnq("INSERT INTO `$wt` SET ".bnset($post));$id=$next;
    }else{$id=(int)$row['wr_id'];}
    bnq("UPDATE `$wt` SET wr_parent=$id WHERE wr_id=$id AND wr_parent=0");
    $nt=$g5['board_new_table'];
    bnq("INSERT INTO $nt (bo_table,wr_id,wr_parent,bn_datetime,mb_id) SELECT '$dest',$id,$id,wr_datetime,mb_id FROM `$wt` WHERE wr_id=$id AND wr_datetime>=DATE_SUB(NOW(),INTERVAL 7 DAY) AND NOT EXISTS(SELECT 1 FROM $nt WHERE bo_table='$dest' AND wr_id=$id)");
    // Only articles created under this policy receive writing points. Native relation
    // keys make recovery idempotent, including a retry after an interrupted award.
    $pending=$new ? $write_point>0 : ($row['wr_5']??'')==='bn-point-pending-v1';
    if($pending){
        $recipient=$new ? $admin_id : (string)$row['mb_id'];
        if($write_point<=0 || $recipient==='')throw new RuntimeException('news point policy unavailable');
        if(!function_exists('insert_point'))throw new RuntimeException('point ledger unavailable');
        insert_point($recipient,$write_point,'챗지기자 기사 발행 +'.$write_point.'P',$dest,(string)$id,'쓰기');
        $pt=$g5['point_table'];
        $entry=sql_fetch("SELECT po_point FROM $pt WHERE mb_id=".bnvalue($recipient)." AND po_rel_table=".bnvalue($dest)." AND po_rel_id=".bnvalue((string)$id)." AND po_rel_action=".bnvalue('쓰기')." LIMIT 1",false);
        if((int)($entry['po_point']??0)<=0)throw new RuntimeException('news point not verified');
        bnq("UPDATE `$wt` SET wr_5='bn-point-credited-v1' WHERE wr_id=$id AND wr_5='bn-point-pending-v1'");
    }
    return ['id'=>$id,'board'=>$dest,'created'=>$new];
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
    $result=['board_exists'=>!empty($board),'owned'=>in_array($board['bo_10']??'',[BN_MARK,BN_ARCHIVE],true),'split_active'=>($board['bo_10']??'')===BN_ARCHIVE,
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
        if(in_array(trim($m['me_name']),array_merge(array_merge([BN_TITLE],BN_LEGACY_TITLES),array_column(BN_SECTIONS,0)),true)||strtolower(str_replace(' ','',trim($m['me_name'])))==='weruntogether'){
            $result['menu'][]=['code'=>$m['me_code'],'name'=>$m['me_name'],'order'=>(int)$m['me_order'],'is_news_link'=>strpos($m['me_link'],'bo_table=busan_news')!==false];
        }
    }
    foreach(['busan_news_company','busan_news_union','busan_news_law','busan_news_world'] as $id){
        $x=sql_fetch("SELECT bo_10 FROM $bt WHERE bo_table=".bnvalue($id),false);
        $t=sql_fetch("SHOW TABLE STATUS WHERE Name=".bnvalue($g5['write_prefix'].$id),false);
        $result['target_boards'][$id]=['board_exists'=>!empty($x),'owned'=>($x['bo_10']??'')===BN_MARK,'table_exists'=>!empty($t),'articles'=>!empty($t)?(int)(sql_fetch("SELECT COUNT(*) AS n FROM `".$g5['write_prefix'].$id."` WHERE wr_is_comment=0",false)['n']??0):0];
    }
    return $result;
}
$stage='input';
try{
    $input=json_decode(file_get_contents('php://input',false,null,0,500000),true,32,JSON_THROW_ON_ERROR);
    if(!is_array($input)||count($input)>100)throw new RuntimeException('invalid batch');
    $mode=$_SERVER['HTTP_X_BUSAN_NEWS_DEPLOY_MODE']??'';
    $rightsMode=!defined('BUSAN_ACCOUNT_NEWS')&&in_array($mode,['rights','rights-daily'],true);
    if(!$rightsMode)foreach($input as $a)bnvalidate($a);
    if (defined('BUSAN_ACCOUNT_NEWS')) {
        if (!array_is_list($input) || count($input)>7) throw new RuntimeException('edition size');
        foreach ($input as $a) if ($a['date']<date('Y-m-d',strtotime(G5_TIME_YMD.' -1 month'))) throw new RuntimeException('expired article');
    }
    $stage='lock'; $lock=sql_fetch("SELECT GET_LOCK('busan_news_publish_v1',15) AS ok",false);
    if((int)($lock['ok']??0)!==1)throw new RuntimeException('publisher busy');
    if($rightsMode){
        $stage='rights';
        if($mode==='rights-daily')echo json_encode(['ok'=>true,'daily'=>bnrights_daily($input)],JSON_UNESCAPED_UNICODE);
        else echo json_encode(['ok'=>true,'rights'=>bnrights_publish($input)],JSON_UNESCAPED_UNICODE);
        exit;
    }
    if(!defined('BUSAN_ACCOUNT_NEWS')&&in_array($mode,['preflight','menu','split'],true)){
        if($input!==[])throw new RuntimeException('deployment inventory requires empty input');
        $stage=$mode;
        if($mode==='menu')bnsetup();
        $split=$mode==='split'?bnsplit():null;
        echo json_encode(['ok'=>true,'inventory'=>bnpreflight(),'split'=>$split],JSON_UNESCAPED_UNICODE);
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
    // Historical reward repair is a separate explicitly reviewed operation; do not run it during structural releases.
    $stage='publish';$rows=[];foreach($input as $a)$rows[]=bnpublish($a,$admin_id,$write_point);
    foreach(bnboards() as $id){
        $t=$g5['write_prefix'].$id;
        bnq("UPDATE {$g5['board_table']} SET bo_count_write=(SELECT COUNT(*) FROM `$t` WHERE wr_is_comment=0) WHERE bo_table=".bnvalue($id));
        if(function_exists('delete_cache_latest'))delete_cache_latest($id);
    }
    echo json_encode(['ok'=>true,'rows'=>$rows,'historical_points'=>$retro]);
}catch(Throwable $e){
    if(!defined('BUSAN_ACCOUNT_NEWS')){
        header('X-Busan-News-Stage: '.$stage);
        $reason=$e instanceof RuntimeException?$e->getMessage():get_class($e);
        if(preg_match('/^[A-Za-z0-9 _-]{1,100}$/D',$reason))header('X-Busan-News-Reason: '.$reason);
    }
    http_response_code(409);echo json_encode(['error'=>$stage.': '.($e instanceof RuntimeException?$e->getMessage():get_class($e))]);
}
