<?php
declare(strict_types=1);
/** Dedicated deployment identity. The automation worker key cannot call this endpoint. */
require_once dirname(__DIR__).'/common.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once dirname(__DIR__).'/noa-app/engine/hub-release.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
try{
 $root=n80_hub_root();$keyPath=$root.'/access.key';
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||is_link($keyPath)||!is_file($keyPath))throw new DomainException('hub_auth_required');
 $raw=(string)file_get_contents('php://input',false,null,0,12582913);$key=trim((string)file_get_contents($keyPath,false,null,0,256));
 $headers=['time'=>$_SERVER['HTTP_X_N80_TIME']??'','nonce'=>$_SERVER['HTTP_X_N80_NONCE']??'','signature'=>$_SERVER['HTTP_X_N80_SIGNATURE']??''];
 if(!n80_hub_auth($raw,$headers,$key,time(),12582912))throw new DomainException('hub_auth_required');
 n80_hub_nonce($root,$headers['nonce'],time());$body=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 if(!is_array($body))throw new InvalidArgumentException('hub_body_invalid');
 switch($body['action']??''){
  case 'status':$result=n80_hub_status($root);break;
  case 'release':$result=n80_hub_release_apply($root,dirname(__DIR__),$body['package']??[],(int)($body['revision']??-1));break;
  case 'recover':$result=['ok'=>n80_hub_release_recover($root,dirname(__DIR__))];break;
  case 'control':
   $result=n80_hub_locked($root,function()use($root,$body){
    $c=n80_hub_read($root,'control.json');if(($body['revision']??-1)!==($c['revision']??0))throw new DomainException('hub_state_changed');
    $active=$body['activeOperations']??null;
    if(!is_array($active)||!array_is_list($active)||!in_array('hub.verify',$active,true)||array_diff($active,array_keys(n80_hub_operations()))||count($active)!==count(array_unique($active)))throw new InvalidArgumentException('hub_invalid_operation');
    $c['activeOperations']=$active;$c['revision']++;n80_hub_write($root,'control.json',$c);return ['ok'=>true,'revision'=>$c['revision']];
   });break;
  default:throw new InvalidArgumentException('hub_unknown_action');
 }
 echo json_encode($result,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);
}catch(Throwable $e){$code=$e->getMessage();http_response_code($code==='hub_auth_required'?401:409);echo json_encode(['ok'=>false,'error'=>preg_match('/^hub_[a-z_]{1,90}$/D',$code)?$code:'hub_unavailable']);}
