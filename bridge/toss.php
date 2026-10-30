<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/toss-core.php';require_once __DIR__.'/member-access.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: no-referrer');
function nt_reply(int $code,array $d):never{http_response_code($code);echo json_encode($d,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_THROW_ON_ERROR);exit;}
$a=nam_access((array)($member??[]),(string)($is_admin??''));$method=$_SERVER['REQUEST_METHOD']??'GET';$action=$_GET['action']??'status';$c=nt_config();
try{
 if($method==='GET'&&$action==='status'){
  $orders=[];$csrf=null;$balance=null;
  if($a['member']){$_SESSION['noa_toss_csrf']??=bin2hex(random_bytes(32));$csrf=$_SESSION['noa_toss_csrf'];$owner=(string)$member['mb_id'];$balance=(int)nr_member($owner,false)['mb_point'];$rows=ns_q("SELECT payload FROM noa_documents WHERE kind='toss_order' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ownerId'))=".ns_e($owner).' ORDER BY updated_at DESC LIMIT 20');while($row=sql_fetch_array($rows))$orders[]=nt_view(json_decode($row['payload'],true,64,JSON_THROW_ON_ERROR));}
  nt_reply(200,['ok'=>true,'member'=>$a['member'],'admin'=>($is_admin??'')==='super','csrf'=>$csrf,'balance'=>$balance,'payment'=>nt_public_config($c),'products'=>nt_products(),'orders'=>$orders]);
 }
 if(!$a['member'])nt_reply(401,['ok'=>false,'error'=>'login_required']);
 if($method!=='POST')nt_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||empty($_SESSION['noa_toss_csrf'])||!hash_equals($_SESSION['noa_toss_csrf'],$_SERVER['HTTP_X_NOA_CSRF']??'')||strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nt_reply(403,['ok'=>false,'error'=>'csrf_required']);
 $raw=file_get_contents('php://input',false,null,0,8193);if(strlen($raw)>8192)throw new InvalidArgumentException('invalid_request');$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($b))throw new InvalidArgumentException('invalid_request');$owner=(string)$member['mb_id'];if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 if($action==='create'){
  if(!is_string($b['requestId']??null)||(!is_string($b['productId']??null)&&!is_array($b['items']??null))||($b['confirmed']??false)!==true)throw new InvalidArgumentException('purchase_confirmation_required');
  $d=nt_create($owner,$b['requestId'],$b['items']??$b['productId'],time());nt_reply(200,['ok'=>true,'order'=>nt_view($d),'customerKey'=>$d['customerKey'],'clientKey'=>$c['clientKey']]);
 }
 if(!is_string($b['id']??null))throw new InvalidArgumentException('invalid_request');
 if($action==='confirm'){
  if(!is_string($b['paymentKey']??null)||!is_int($b['amount']??null))throw new InvalidArgumentException('invalid_request');
  $d=nt_confirm($owner,$b['id'],$b['paymentKey'],$b['amount'],time());nt_reply(200,['ok'=>true,'order'=>nt_view($d)]);
 }
 if($action==='refresh'){nt_order($b['id'],$owner);$d=nt_sync($b['id'],time());nt_reply(200,['ok'=>true,'order'=>nt_view($d)]);}
 throw new InvalidArgumentException('invalid_action');
}catch(InvalidArgumentException|JsonException $e){nt_reply(400,['ok'=>false,'error'=>'invalid_request']);}
catch(DomainException $e){$allowed=['payment_not_ready','payment_configuration_changed','order_not_found','order_expired','purchase_conflict','payment_amount_mismatch','payment_method_not_supported','payment_verification_pending','payment_reference_already_used','purchase_busy_retry','points_storage_not_ready'];nt_reply(409,['ok'=>false,'error'=>in_array($e->getMessage(),$allowed,true)?$e->getMessage():'payment_unavailable']);}
catch(Throwable $e){nt_reply(503,['ok'=>false,'error'=>'payment_verification_pending']);}

