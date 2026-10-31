<?php
declare(strict_types=1);ini_set('display_errors','0');require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/member-access.php';require_once __DIR__.'/subscription-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function ns_reply(int $code,array $body):never{http_response_code($code);if(isset($body['error'])&&preg_match('/^[a-z_]+$/D',$body['error']))header('X-NOA-Error-Code: '.$body['error']);echo json_encode($body,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_THROW_ON_ERROR);exit;}
function ns_public_order(array $d):array{return array_intersect_key($d,array_flip(['id','plan','method','status','points','priceWon','provider','createdAt','paidAt','until']));}
$access=nam_access((array)($member??[]),(string)($is_admin??''));if(!$access['member'])ns_reply(401,['ok'=>false,'error'=>'login_required']);$owner=(string)$member['mb_id'];$admin=$access['admin'];
if(empty($_SESSION['noa_subscription_csrf']))$_SESSION['noa_subscription_csrf']=bin2hex(random_bytes(32));
try{
 $method=$_SERVER['REQUEST_METHOD']??'GET';$action=$_GET['action']??'status';if(!is_string($action))throw new InvalidArgumentException('invalid_action');
 if(str_starts_with($action,'admin_')&&!$admin)ns_reply(403,['ok'=>false,'error'=>'administrator_required']);
 if($method==='GET'&&in_array($action,['status','admin_status'],true)){
  $policy=ns_policy();$grant=ns_doc(ns_member_key($owner));$orders=[];$condition=$action==='admin_status'?'':' AND JSON_UNQUOTE(JSON_EXTRACT(payload,\'$.ownerId\'))='.ns_e($owner);
  $r=ns_q("SELECT payload FROM noa_documents WHERE kind='subscription_order'".$condition.($action==='admin_status'?" ORDER BY (JSON_UNQUOTE(JSON_EXTRACT(payload,'$.status'))='awaiting_payment') DESC,updated_at DESC LIMIT 50":' ORDER BY updated_at DESC LIMIT 50'));while($row=sql_fetch_array($r)){$d=json_decode($row['payload'],true,64,JSON_THROW_ON_ERROR);$orders[]=$action==='admin_status'?$d:ns_public_order($d);}
  ns_reply(200,['ok'=>true,'admin'=>$admin,'csrf'=>$_SESSION['noa_subscription_csrf'],'buyerKey'=>hash('sha256',$owner),'policy'=>$policy,'storage'=>$admin?ns_storage(true):['ready'=>ns_storage(true)['ready']],'balance'=>(int)($member['mb_point']??0),'level'=>$access['level'],'baseLevel'=>ns_family((int)($member['noa_raw_level']??$member['mb_level']??1)),'grant'=>$grant?array_intersect_key($grant['data'],array_flip(['baseLevel','paidLevel','until','status','source'])):null,'legacyVip'=>!$grant&&in_array((int)($member['mb_level']??1),[4,5,6,8],true),'orders'=>$orders]);
 }
 if($method!=='POST')ns_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
 $token=$_SERVER['HTTP_X_NOA_CSRF']??'';if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!is_string($token)||!hash_equals($_SESSION['noa_subscription_csrf'],$token)||strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')ns_reply(403,['ok'=>false,'error'=>'request_verification_failed']);
 $raw=file_get_contents('php://input',false,null,0,32769);if(strlen($raw)>32768)throw new InvalidArgumentException('request_too_large');$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($b))throw new InvalidArgumentException('invalid_request');
 if($action==='admin_policy'){
  $expected=$b['revision']??null;if(!is_int($expected)||$expected<0||!is_array($b['policy']??null))throw new InvalidArgumentException('invalid_policy');$p=ns_policy_validate($b['policy']);
  if($p['enabled']&&$p['pointsEnabled']&&!ns_storage(true)['ready'])throw new DomainException('points_storage_not_ready');
  $next=ns_atomic('policy',false,fn()=>ns_put(NS_POLICY,'prefs',$p,$expected,$owner));ns_reply(200,['ok'=>true,'revision'=>$next]);
 }
 if($action==='points'||$action==='payment'){
  $method=$action==='points'?'points':'payment';$id=$b['requestId']??'';$plan=$b['plan']??'';if(!is_string($id)||!is_string($plan))throw new InvalidArgumentException('invalid_plan');ns_order_key($id);
  $existing=ns_doc(ns_order_key($id));if(!$existing){$policy=ns_policy();if(($b['policyRevision']??null)!==$policy['revision'])throw new DomainException('policy_changed');}else $policy=ns_policy();
  $order=ns_create_order($owner,$id,$plan,$method,time(),$b['policyRevision']??null);ns_reply(200,['ok'=>true,'order'=>ns_public_order($order)]);
 }
 if($action==='cancel'){
  $id=$b['id']??'';if(!is_string($id))throw new InvalidArgumentException('request_id_required');$d=ns_atomic($owner,false,function()use($id,$owner){$r=ns_doc(ns_order_key($id),true);if(!$r||($r['data']['ownerId']??'')!==$owner)throw new DomainException('own_order_required');$d=$r['data'];if($d['status']==='cancelled')return $d;if($d['status']!=='awaiting_payment')throw new DomainException('pending_order_required');$d['status']='cancelled';$d['cancelledAt']=time();ns_put(ns_order_key($id),'subscription_order',$d,$r['revision'],$owner);return $d;});ns_reply(200,['ok'=>true,'order'=>ns_public_order($d)]);
 }
 if($action==='admin_confirm'){
  if(($b['paymentConfirmed']??false)!==true)throw new DomainException('payment_confirmation_required');if(!is_string($b['id']??null)||!is_string($b['reference']??null)||!is_int($b['amountWon']??null))throw new InvalidArgumentException('invalid_payment_confirmation');$d=ns_confirm_payment($b['id'],$b['reference'],$b['amountWon'],$owner,time());ns_reply(200,['ok'=>true,'order'=>$d]);
 }
 throw new InvalidArgumentException('invalid_action');
}catch(DomainException $e){ns_reply(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){ns_reply(400,['ok'=>false,'error'=>$e instanceof JsonException?'invalid_json':$e->getMessage()]);}catch(Throwable $e){error_log('[noa-subscription] '.get_class($e));ns_reply(503,['ok'=>false,'error'=>'subscription_service_unavailable']);}
