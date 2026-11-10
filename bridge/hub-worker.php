<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once dirname(__DIR__).'/noa-app/engine/hub.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
try{
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')throw new DomainException('hub_auth_required');
 $raw=(string)file_get_contents('php://input',false,null,0,65537);
 $keyPath=dirname(__DIR__,2).'/noa-ai-lab/worker.key';
 if(is_link($keyPath)||!is_file($keyPath))throw new DomainException('hub_auth_required');
 $key=trim((string)file_get_contents($keyPath,false,null,0,256));
 $headers=['time'=>$_SERVER['HTTP_X_N80_TIME']??'','nonce'=>$_SERVER['HTTP_X_N80_NONCE']??'','signature'=>$_SERVER['HTTP_X_N80_SIGNATURE']??''];
 if(!n80_hub_auth($raw,$headers,$key,time()))throw new DomainException('hub_auth_required');
 $root=n80_hub_root();n80_hub_nonce($root,$headers['nonce'],time());
 $body=json_decode($raw,true,16,JSON_THROW_ON_ERROR);if(!is_array($body))throw new InvalidArgumentException('hub_body_invalid');
 if(($body['action']??'')==='heartbeat'){
  n80_hub_locked($root,function()use($root){n80_hub_write($root,'status.json',['heartbeatAt'=>time(),'runner'=>'host_node']);});$result=['ok'=>true,'control'=>n80_hub_read($root,'control.json'),'requests'=>n80_hub_read($root,'requests.json')];
 }elseif(($body['action']??'')==='execute'){
  set_time_limit(120);
  require_once dirname(__DIR__).'/noa-app/engine/hub-specialists.php';
  $result=n80_hub_execute($root,(string)($body['operation']??''),(string)($body['id']??''),'n80_hub_specialist');
 }else throw new InvalidArgumentException('hub_unknown_action');
 echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
}catch(Throwable $e){$code=$e->getMessage();http_response_code($code==='hub_auth_required'?401:409);echo json_encode(['ok'=>false,'error'=>preg_match('/^hub_[a-z_]{1,90}$/D',$code)?$code:'hub_unavailable']);}
