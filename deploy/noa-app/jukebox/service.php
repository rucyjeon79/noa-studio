<?php
/** Scoped HMAC service for a verified worker; no commands, paths or SQL accepted. */
declare(strict_types=1);
$web=dirname(__DIR__,2);require $web.'/common.php';require $web.'/noa-bridge/storage.php';require $web.'/noa-bridge/sound-core.php';require $web.'/noa-bridge/lab-core.php';require __DIR__.'/operations.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{
 $raw=file_get_contents('php://input',false,null,0,1048577);$ts=$_SERVER['HTTP_X_NOA_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_NOA_NONCE']??'';$sig=$_SERVER['HTTP_X_NOA_SIGNATURE']??'';
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||strlen($raw)>1048576||!ctype_digit($ts)||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce))lab_json(401,['error'=>'service_auth_required']);
 $key=trim((string)file_get_contents(lab_root().'/worker.key'));$signed="NOA-JUKEBOX-1\nPOST\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;
 if(strlen($key)!==64||!hash_equals(hash_hmac('sha256',$signed,$key),$sig))lab_json(401,['error'=>'service_auth_required']);
 $path=lab_root().'/jukebox-nonce-'.$nonce;$f=@fopen($path,'x');if(!$f)lab_json(409,['error'=>'replayed_request']);chmod($path,0600);fwrite($f,$ts);fclose($f);
 foreach(glob(lab_root().'/jukebox-nonce-*') as $p)if(filemtime($p)<time()-600&&!is_link($p))unlink($p);
 set_time_limit(120);$b=json_decode($raw,true,512,JSON_THROW_ON_ERROR);$result=nj_operation(noa_bridge_pdo(),(string)($b['action']??''),$b['payload']??[]);
 lab_json(200,['ok'=>true,'result'=>$result]);
}catch(DomainException $e){lab_json(409,['error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[jukebox-service] '.get_class($e).':'.$e->getCode());lab_json(503,['error'=>'jukebox_service_unavailable']);}
