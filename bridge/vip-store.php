<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/vip-store-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nv_reply(int $code,array $data):never{http_response_code($code);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
$method=$_SERVER['REQUEST_METHOD']??'GET';$owner=(string)($member['mb_id']??'');
try{
 if($method==='GET'){
  $data=['ok'=>true,'member'=>$owner!=='','products'=>array_values(nv_products()),'version'=>NV_CATALOG_VERSION,'enabled'=>!empty(nr_policy()['enabled'])];
  if($owner!==''){$_SESSION['noa_vip_csrf']??=bin2hex(random_bytes(32));$data['csrf']=$_SESSION['noa_vip_csrf'];$m=nr_member($owner,false);$data['balance']=(int)$m['mb_point'];$data['eligiblePlan']=$owner===($config['cf_admin']??'')?null:(in_array((int)$m['mb_level'],[2,3,4],true)?'vip':(in_array((int)$m['mb_level'],[7,8],true)?'creator':null));$g=ns_doc(ns_member_key($owner));$data['grant']=$g?array_intersect_key($g['data'],array_flip(['paidLevel','until','status'])):null;$data['orders']=[];$rows=ns_q("SELECT payload FROM noa_documents WHERE kind='subscription_order' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ownerId'))=".ns_e($owner)." AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.catalog'))='vip-store-v1' ORDER BY updated_at DESC LIMIT 20");while($r=sql_fetch_array($rows)){$o=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$data['orders'][]=array_intersect_key($o,array_flip(['id','items','points','durationDays','paidAt','until','status']));}}
  if(session_status()===PHP_SESSION_ACTIVE)session_write_close();nv_reply(200,$data);
 }
 if($method!=='POST')nv_reply(405,['ok'=>false,'error'=>'method_not_allowed']);if($owner==='')nv_reply(401,['ok'=>false,'error'=>'login_required']);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||empty($_SESSION['noa_vip_csrf'])||!hash_equals($_SESSION['noa_vip_csrf'],$_SERVER['HTTP_X_NOA_CSRF']??'')||strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nv_reply(403,['ok'=>false,'error'=>'csrf_required']);
 $raw=file_get_contents('php://input',false,null,0,8193);if(strlen($raw)>8192)throw new InvalidArgumentException('invalid_cart');$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 if(!is_array($b)||!is_string($b['requestId']??null)||!is_array($b['items']??null)||($b['version']??null)!==NV_CATALOG_VERSION||($b['confirmed']??false)!==true)throw new InvalidArgumentException('purchase_confirmation_required');
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();$o=nv_buy($owner,$b['requestId'],$b['items'],time());nv_reply(200,['ok'=>true,'order'=>array_intersect_key($o,array_flip(['id','points','durationDays','until','status']))]);
}catch(DomainException $e){nv_reply(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){nv_reply(400,['ok'=>false,'error'=>$e instanceof JsonException?'invalid_cart':$e->getMessage()]);}catch(Throwable $e){error_log('[noa-vip-store] '.get_class($e));nv_reply(503,['ok'=>false,'error'=>'store_unavailable']);}
