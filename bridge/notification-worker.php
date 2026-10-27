<?php
declare(strict_types=1);
ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
// Authenticate before loading the session or exposing any subscription material.
$cfgPath=dirname(__DIR__,2).'/noa-notifications-private/config.json';$cfg=is_file($cfgPath)?json_decode(file_get_contents($cfgPath),true):[];
$ts=(string)($_SERVER['HTTP_X_NOA_TIME']??'');$nonce=(string)($_SERVER['HTTP_X_NOA_NONCE']??'');$mac=(string)($_SERVER['HTTP_X_NOA_SIGNATURE']??'');$raw=file_get_contents('php://input',false,null,0,100001);
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>100000||!ctype_digit($ts)||abs(time()-(int)$ts)>300||!preg_match('/^[a-f0-9]{32}$/D',$nonce)||!preg_match('/^[a-f0-9]{64}$/D',$mac)||!preg_match('/^[a-f0-9]{64}$/D',$cfg['workerToken']??'')||!hash_equals(hash_hmac('sha256',$ts."\n".$nonce."\n".$raw,$cfg['workerToken']),$mac)){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/notifications-sources.php';require_once __DIR__.'/notifications-inline.php';
try{
 $db=noa_bridge_pdo();if(!nnt_ready($db))throw new RuntimeException('not_ready');
 if(!nnt_exec($db,'INSERT IGNORE INTO noa_notification_cursor VALUES (?,?)',['nonce:'.$nonce,time()])){http_response_code(409);$result=['ok'=>false,'error'=>'replayed_request'];}
 else{$b=json_decode($raw,true,12,JSON_THROW_ON_ERROR);$action=$b['action']??'';
  if($action==='claim'){$scanned=nnt_collect($db,time());nnt_prune($db,time());$result=['ok'=>true,'scanned'=>$scanned,'jobs'=>nnt_claim($db,time())];}
  elseif($action==='ack'&&is_array($b['results']??null))$result=['ok'=>true,'acknowledged'=>nnt_ack($db,$b['results'],time())];
  elseif($action==='health')$result=['ok'=>true,'ready'=>true,'inlineCapable'=>nnt_inline_capable(),'oldestDueAge'=>(int)nnt_one($db,"SELECT COALESCE(MAX(GREATEST(0,?-next_at)),0) age FROM noa_notification_delivery WHERE state='pending' AND next_at<=?",[time(),time()])['age'],'subscriptions'=>(int)nnt_one($db,'SELECT COUNT(*) n FROM noa_push_subscriptions WHERE active=1')['n'],'pending'=>(int)nnt_one($db,"SELECT COUNT(*) n FROM noa_notification_delivery WHERE state IN ('pending','leased')")['n'],'accepted'=>(int)nnt_one($db,'SELECT COUNT(*) n FROM noa_notification_delivery WHERE sent_at IS NOT NULL')['n'],'received'=>(int)nnt_one($db,'SELECT COUNT(*) n FROM noa_notification_delivery WHERE received_at IS NOT NULL')['n']];
  else throw new DomainException('invalid_action');
 }
}catch(Throwable $e){error_log('[noa-notification-worker] '.get_class($e));http_response_code(503);$result=['ok'=>false,'error'=>'worker_unavailable'];}
while(ob_get_level()>$level)ob_end_clean();echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
