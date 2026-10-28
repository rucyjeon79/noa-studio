<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/toss-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');
function nt_hook_reply(int $code):never{http_response_code($code);echo json_encode(['ok'=>$code===200]);exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')nt_hook_reply(405);
$c=nt_config();if(!nt_ready($c))nt_hook_reply(503);
$raw=file_get_contents('php://input',false,null,0,65537);if(strlen($raw)>65536)nt_hook_reply(413);
if(!nt_webhook_valid($raw,$_SERVER['HTTP_TOSSPAYMENTS_WEBHOOK_TRANSMISSION_TIME']??'',$_SERVER['HTTP_TOSSPAYMENTS_WEBHOOK_SIGNATURE']??'',$c['webhookSecret'],time()))nt_hook_reply(401);
try{
 $b=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(($b['eventType']??'')!=='PAYMENT_STATUS_CHANGED'||!in_array($b['data']['status']??'',['DONE','PARTIAL_CANCELED','CANCELED'],true))nt_hook_reply(200);
 $oid=$b['data']['orderId']??'';if(!is_string($oid)||!preg_match('/^NOA_([a-f0-9]{32})$/D',$oid,$m))nt_hook_reply(200);
 $h=$m[1];$id=substr($h,0,8).'-'.substr($h,8,4).'-'.substr($h,12,4).'-'.substr($h,16,4).'-'.substr($h,20);$d=nt_order($id);
 $event=$_SERVER['HTTP_TOSSPAYMENTS_WEBHOOK_TRANSMISSION_ID']??'';if($event===''||strlen($event)>256)nt_hook_reply(400);
 $eventKey='toss:event:'.hash('sha256',$event);$prior=ns_doc($eventKey);if($prior){if(($prior['data']['bodyHash']??'')!==hash('sha256',$raw))nt_hook_reply(409);nt_hook_reply(200);}
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 // Ignore the supplied amounts/status: fetch current payment data with the server credential.
 nt_sync($id,time(),is_string($b['data']['paymentKey']??null)?$b['data']['paymentKey']:null);
 ns_atomic($d['ownerId'],false,function()use($eventKey,$raw,$id,$d){if(!ns_doc($eventKey,true))ns_put($eventKey,'toss_event',['orderId'=>$id,'bodyHash'=>hash('sha256',$raw)],0,$d['ownerId']);});nt_hook_reply(200);
}catch(DomainException $e){nt_hook_reply($e->getMessage()==='order_not_found'?200:503);}catch(Throwable $e){nt_hook_reply(503);}
