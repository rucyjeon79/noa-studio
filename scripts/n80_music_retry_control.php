<?php
declare(strict_types=1);ini_set('display_errors','0');header('Cache-Control: no-store');header('Content-Type: application/json');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_RETRY_EXPIRY||!hash_equals('NOA_RETRY_TOKEN_SHA',hash('sha256',$_SERVER['HTTP_X_NOA_CONTROL']??''))){http_response_code(403);exit;}
/*NOA_RETRY_CORE*/
try{
 set_time_limit(120);define('_GNUBOARD_',true);$web=dirname(__DIR__);require $web.'/data/dbconfig.php';require $web.'/noa-bridge/storage.php';require $web.'/noa-app/engine/music-availability.php';
 $db=noa_bridge_pdo();$db->exec('SET TRANSACTION READ ONLY');$db->beginTransaction();try{$verified=n80_music_availability($db,83,'n80_music_public_get');$db->commit();}catch(Throwable $e){$db->rollBack();throw $e;}
 if(($verified['ok']??false)!==true)throw new RuntimeException('verification_failed');
 $result=n80_music_repair_retry('/hosting/noastudio/noa-ai-lab/n80-music-consumer/leases',$verified['event']['id'],'NOA_RETRY_STATE_SHA',$verified,time());echo json_encode($result,JSON_THROW_ON_ERROR);
}catch(Throwable $e){http_response_code(200);echo json_encode(['ok'=>false,'error'=>'retry_repair_failed','kind'=>get_class($e)]);}
