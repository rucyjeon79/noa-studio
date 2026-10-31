<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(time()>__EXPIRY__||!hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
ob_start();require dirname(__DIR__).'/common.php';ob_end_clean();if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';$db=noa_bridge_pdo();
require_once __DIR__.'/community-core.php';
$r=nc_one("SELECT wr_id,wr_parent,mb_id FROM g5_write_song_request WHERE wr_id=3 AND wr_is_comment=1");
$result=[];ob_start();
try{$v=nc_one("SELECT mb_id,wr_password FROM g5_write_song_request WHERE wr_id=2 AND wr_is_comment=0");$c=nc_content('song_request',2,$v);$result['read']=['comments'=>count($c['comments']),'musicCard'=>!empty($c['comments'][0]['music'])];}catch(Throwable $e){$result['read']=[get_class($e),$e->getMessage()];}
try{require_once __DIR__.'/support-core.php';$key=nc_one('SELECT wr_9 FROM g5_write_song_request WHERE wr_id=3')['wr_9'];$target=nsp_target($db,'music',$key);$result['support']=['targetReady'=>true,'sameAsReplyAuthor'=>$target['owner']===$r['mb_id']];}catch(Throwable $e){$result['support']=['error'=>$e->getMessage()];}
$result['unexpectedOutputBytes']=strlen(ob_get_clean());
echo json_encode(['ok'=>true,'databaseWrites'=>0,'checks'=>$result],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
