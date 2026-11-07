<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/lab-core.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
$raw=file_get_contents('php://input',false,null,0,2097153);$ts=$_SERVER['HTTP_X_NOA_TIMESTAMP']??'';$nonce=$_SERVER['HTTP_X_NOA_NONCE']??'';$signature=$_SERVER['HTTP_X_NOA_SIGNATURE']??'';$action=(string)($_GET['action']??'');
try {
 if(!is_string($raw)||strlen($raw)>2097152||!ctype_digit($ts)||abs(time()-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce))lab_json(401,['error'=>'worker_auth_required']);
 $key=trim((string)file_get_contents(lab_root().'/worker.key'));if(strlen($key)!==64)throw new RuntimeException('worker_key');$signed=($_SERVER['REQUEST_METHOD']??'GET')."\n".($_SERVER['QUERY_STRING']??'')."\n".hash('sha256',$raw)."\n".$ts."\n".$nonce;if(!hash_equals(hash_hmac('sha256',$signed,$key),$signature))lab_json(401,['error'=>'worker_auth_required']);
 lab_lock(function(&$s)use($nonce){if(isset($s['nonces'][$nonce]))throw new DomainException('replayed_request');$s['nonces']=array_filter($s['nonces'],fn($at)=>$at>time()-360);$s['nonces'][$nonce]=time();});
 $b=$raw!==''?json_decode($raw,true,512,JSON_THROW_ON_ERROR):[];
 require_once dirname(__DIR__).'/noa-app/engine/service-runtime.php';
 if(!is_array($b)||array_is_list($b)&&$b!==[])throw new InvalidArgumentException('invalid_body');
 $context=['authenticatedByServer'=>true,'principal'=>'n80_lab_worker',
   'permissions'=>['ai:read','ai:text','batch:recover','catalog:index','media:worker'],
   'method'=>$_SERVER['REQUEST_METHOD']??'','admin'=>(string)($config['cf_admin']??'')];
 // Compatibility alias: same N80 operations, no independent old executor.
 if($action==='n80_tick'){
   try{n80_service_execute('n80_batch_watchdog',[],$context);}
   catch(Throwable $error){error_log('[n80-channel-batch] '.get_class($error));}
   $action='n80_text_tick';
 }
 $result=n80_service_execute($action,$b,$context);
 lab_json(!empty($result['ok'])?200:(($result['error']??'')==='method_not_allowed'?405:400),$result);
}catch(DomainException $e){lab_json(409,['error'=>$e->getMessage()]);}catch(InvalidArgumentException $e){lab_json(400,['error'=>$e->getMessage()]);}catch(Throwable $e){error_log('[noa-lab-worker] '.get_class($e));lab_json(503,['error'=>'worker_unavailable']);}
