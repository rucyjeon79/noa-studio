<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_COMMUNITY_EXPIRY||!hash_equals('NOA_COMMUNITY_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';
function nci_table(string $s):string{if(!preg_match('/^[A-Za-z0-9_]+$/D',$s))throw new RuntimeException('invalid_table');return '`'.$s.'`';}
function nci_rows(string $sql):array{$r=sql_query($sql,false);if(!$r)throw new RuntimeException('query_failed');$out=[];while($row=sql_fetch_array($r))$out[]=$row;return $out;}
try{
 $boards=nci_rows('SELECT bo_table,bo_subject,gr_id,bo_list_level,bo_read_level,bo_write_level,bo_reply_level,bo_comment_level,bo_use_secret,bo_use_cert,bo_use_search,bo_use_rss_view,bo_count_write,bo_count_comment,bo_skin,bo_mobile_skin FROM '.nci_table($g5['board_table']).' ORDER BY bo_order,bo_table');
 $columns=nci_rows('SHOW COLUMNS FROM '.nci_table($g5['board_table']));
 $writeColumns=nci_rows('SHOW COLUMNS FROM '.nci_table($g5['write_prefix'].'free'));
 $result=['ok'=>true,'version'=>defined('G5_GNUBOARD_VER')?G5_GNUBOARD_VER:'unknown','boards'=>$boards,'boardColumns'=>$columns,'writeColumns'=>$writeColumns,'databaseWrites'=>0];
 while(ob_get_level()>$buffer)ob_end_clean();echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){while(ob_get_level()>$buffer)ob_end_clean();http_response_code(500);echo json_encode(['ok'=>false,'error'=>'inventory_failed']);}
