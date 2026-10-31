<?php
declare(strict_types=1);
/** One expiring, content-bound maintenance request; no authentication settings or member changes. */
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_NOTICE_EXPIRY||!hash_equals('NOA_NOTICE_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$notice_buffer=ob_get_level();ob_start();
register_shutdown_function(static function(){global $notice_buffer;$e=error_get_last();if($e&&in_array($e['type'],[E_ERROR,E_PARSE,E_COMPILE_ERROR,E_CORE_ERROR],true)){while(ob_get_level()>$notice_buffer)ob_end_clean();http_response_code(500);echo json_encode(['ok'=>false,'error'=>'notice_runtime_failure','file'=>basename($e['file']),'line'=>$e['line']]);}});
require_once dirname(__DIR__).'/common.php';
function ng_query(string $sql){$r=sql_query($sql,false);if($r===false)throw new RuntimeException('notice_database_operation_failed');return $r;}
function ng_one(string $sql):array{$r=ng_query($sql);return sql_fetch_array($r)?:[];}
function ng_q(string $v):string{return "'".sql_escape_string($v)."'";}
function ng_table(string $name):string{if(!preg_match('/^[A-Za-z0-9_]+$/D',$name))throw new RuntimeException('invalid_native_table');return '`'.$name.'`';}
function ng_reply(array $data,int $status=200):never{global $notice_buffer;while(ob_get_level()>$notice_buffer)ob_end_clean();http_response_code($status);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
$locked=false;
try{
 $raw=file_get_contents('php://input');if(!hash_equals('NOA_NOTICE_PAYLOAD_SHA',hash('sha256',$raw)))throw new RuntimeException('unreviewed_notice_payload');
 $p=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if($p['board']!=='notice'||!in_array($p['noticeKey'],['NOA-20261026-WELCOME-GUIDE-V1','NOA-20261031-AMT2-FAN'],true)||$p['pin']!==($p['noticeKey']==='NOA-20261026-WELCOME-GUIDE-V1')||!is_string($p['title'])||!is_string($p['body']))throw new RuntimeException('invalid_notice_identity');
 $key=$p['noticeKey'];$bodyHash=hash('sha256',$p['body']);$write=ng_table($g5['write_prefix'].'notice');$boards=ng_table($g5['board_table']);$new=ng_table($g5['board_new_table']);$members=ng_table($g5['member_table']);
 $board=ng_one("SELECT bo_table,bo_notice,bo_list_level,bo_read_level,bo_count_write FROM $boards WHERE bo_table='notice'");if(!$board)throw new RuntimeException('notice_board_missing');
 $author=ng_one('SELECT mb_id,mb_level FROM '.$members.' WHERE mb_id='.ng_q((string)$config['cf_admin']));if(!$author||(int)$author['mb_level']<10)throw new RuntimeException('native_super_admin_missing');
 $columns=[];$rows=ng_query('SHOW COLUMNS FROM '.$write);while($row=sql_fetch_array($rows))$columns[$row['Field']]=$row;
 foreach(['wr_id','wr_num','wr_reply','wr_is_comment','wr_parent','wr_subject','wr_content','wr_option','wr_datetime','wr_last','wr_9','wr_10','mb_id']as $field)if(!isset($columns[$field]))throw new RuntimeException('native_notice_schema_mismatch');
 $lock=ng_one("SELECT GET_LOCK('noa-welcome-notice-20261026',15) AS acquired");if((int)($lock['acquired']??0)!==1)throw new RuntimeException('notice_publish_busy');$locked=true;
 $found=[];$rows=ng_query("SELECT wr_id,wr_subject,wr_content,wr_option,mb_id,wr_9 FROM $write WHERE wr_10=".ng_q($key));while($row=sql_fetch_array($rows))$found[]=$row;
 if(count($found)>1)throw new RuntimeException('duplicate_notice_marker');$created=false;$updated=false;
 if($found){$post=$found[0];if($post['wr_subject']!==$p['title']||$post['mb_id']!==$author['mb_id']||$post['wr_option']!=='html1')throw new RuntimeException('existing_notice_edited_preserved');$id=(int)$post['wr_id'];$currentHash=hash('sha256',$post['wr_content']);if(!hash_equals($bodyHash,$currentHash)){$expected=(string)($p['expectedBodySha256']??'');if(strlen($expected)!==64||!hash_equals($expected,$currentHash)||!hash_equals($expected,(string)$post['wr_9']))throw new RuntimeException('existing_notice_edited_preserved');ng_query("UPDATE $write SET wr_content=".ng_q($p['body']).',wr_9='.ng_q($bodyHash).',wr_last='.ng_q(G5_TIME_YMDHIS)." WHERE wr_id=$id AND wr_10=".ng_q($key).' AND wr_9='.ng_q($expected).' AND wr_content='.ng_q($post['wr_content']));$updated=true;}}
 else{
  $fields=['wr_reply'=>'','wr_is_comment'=>0,'wr_comment'=>0,'wr_comment_reply'=>'','ca_name'=>'','wr_option'=>'html1','wr_subject'=>$p['title'],'wr_content'=>$p['body'],'wr_seo_title'=>'','wr_link1'=>'','wr_link2'=>'','wr_link1_hit'=>0,'wr_link2_hit'=>0,'wr_hit'=>0,'wr_good'=>0,'wr_nogood'=>0,'mb_id'=>$author['mb_id'],'wr_password'=>'','wr_name'=>'NOA STUDIO','wr_email'=>'','wr_homepage'=>'','wr_datetime'=>G5_TIME_YMDHIS,'wr_last'=>G5_TIME_YMDHIS,'wr_ip'=>'','wr_file'=>0,'wr_facebook_user'=>'','wr_twitter_user'=>''];
  for($i=1;$i<=10;$i++)$fields['wr_'.$i]='';$fields['wr_9']=$bodyHash;$fields['wr_10']=$key;
  $sets=["wr_num=(SELECT IFNULL(MIN(wr_num)-1,-1) FROM $write AS native_notice_sequence)","wr_parent=0"];
  foreach($fields as $field=>$value)if(isset($columns[$field]))$sets[]=ng_table($field).'='.(is_int($value)?(string)$value:ng_q($value));
  ng_query('INSERT INTO '.$write.' SET '.implode(',',$sets));$id=(int)sql_insert_id();if($id<1)throw new RuntimeException('notice_id_missing');$created=true;
 }
 // Each dependent native record can be repaired after an interrupted request without adding another post.
 ng_query("UPDATE $write SET wr_parent=$id WHERE wr_id=$id AND wr_10=".ng_q($key));
 if(!(int)ng_one("SELECT COUNT(*) AS n FROM $new WHERE bo_table='notice' AND wr_id=$id")['n'])ng_query("INSERT INTO $new (bo_table,wr_id,wr_parent,bn_datetime,mb_id) VALUES ('notice',$id,$id,".ng_q(G5_TIME_YMDHIS).','.ng_q($author['mb_id']).')');
 $board=ng_one("SELECT bo_notice FROM $boards WHERE bo_table='notice'");$old=(string)$board['bo_notice'];$pins=array_values(array_filter(explode(',',$old),'strlen'));foreach($pins as $pin)if(!ctype_digit($pin))throw new RuntimeException('unexpected_native_notice_list');
 if($p['pin']&&!in_array((string)$id,$pins,true)){$updated=implode(',',array_merge([(string)$id],$pins));ng_query("UPDATE $boards SET bo_notice=".ng_q($updated)." WHERE bo_table='notice' AND bo_notice=".ng_q($old));}
 $count=(int)ng_one("SELECT COUNT(*) AS n FROM $write WHERE wr_is_comment=0")['n'];ng_query("UPDATE $boards SET bo_count_write=$count WHERE bo_table='notice'");
 if(function_exists('delete_cache_latest'))delete_cache_latest('notice');
 $row=ng_one("SELECT wr_id,wr_parent,wr_subject,wr_content,wr_option,wr_datetime FROM $write WHERE wr_id=$id");$board=ng_one("SELECT bo_notice,bo_count_write FROM $boards WHERE bo_table='notice'");
 if((int)$row['wr_parent']!==$id||$row['wr_subject']!==$p['title']||!hash_equals($bodyHash,hash('sha256',$row['wr_content']))||$p['pin']!==in_array((string)$id,explode(',',$board['bo_notice']),true)||(int)$board['bo_count_write']!==$count)throw new RuntimeException('notice_readback_failed');
 $result=['ok'=>true,'created'=>$created,'updated'=>$updated,'id'=>$id,'title'=>$row['wr_subject'],'bodySha256'=>$bodyHash,'publishedAt'=>$row['wr_datetime'],'pinned'=>$p['pin'],'noticeCount'=>$count,'url'=>'https://noastudio.ai.kr/bbs/board.php?bo_table=notice&wr_id='.$id,'publicHomeUrl'=>'https://noastudio.ai.kr/#noa-notice-'.$id,'existingPostsModified'=>$updated?1:0,'otherPostsModified'=>0,'memberRowsChanged'=>0,'pointsChanged'=>0,'boardPermissionsChanged'=>false,'emailSent'=>false];
 ng_query("SELECT RELEASE_LOCK('noa-welcome-notice-20261026')");$locked=false;ng_reply($result);
}catch(Throwable $e){if($locked)sql_query("SELECT RELEASE_LOCK('noa-welcome-notice-20261026')",false);ng_reply(['ok'=>false,'error'=>$e instanceof mysqli_sql_exception?'notice_database_operation_failed':$e->getMessage()],500);}
