<?php
declare(strict_types=1);ini_set('display_errors','0');
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/support-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nsp_reply(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
if(empty($member['mb_id']))nsp_reply(401,['ok'=>false,'error'=>'login_required']);
$owner=(string)$member['mb_id'];$method=$_SERVER['REQUEST_METHOD']??'GET';
try{
 nsp_member($owner);$db=noa_bridge_pdo();$action=(string)($_GET['action']??'quote');
 if($method==='GET'){
  if(empty($_SESSION['noa_support_csrf']))$_SESSION['noa_support_csrf']=bin2hex(random_bytes(32));$csrf=$_SESSION['noa_support_csrf'];
  if($action==='receipt'){
   $id=(string)($_GET['requestId']??'');ns_order_key($id);$r=ns_doc('support:receipt:'.hash('sha256',$owner.'|'.$id));nsp_reply(200,['ok'=>true,'receipt'=>$r['data']['receipt']??null,'senderKey'=>hash('sha256',$owner)]);
  }
  if($action==='review-list'){

   if(($is_admin??'')!=='super'||$owner!==($config['cf_admin']??''))nsp_reply(403,['ok'=>false,'error'=>'administrator_required']);
   $items=[];$q=ns_q("SELECT doc_key,payload FROM noa_documents WHERE doc_key LIKE 'support:settlement:%' ORDER BY updated_at DESC LIMIT 100");while($r=sql_fetch_array($q))$items[]=['key'=>$r['doc_key']]+json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);nsp_reply(200,['ok'=>true,'csrf'=>$csrf,'items'=>$items,'queue'=>nspp_admin_queue(),'policy'=>nspp_policy()]);
  }
  if($action==='detail')nsp_reply(200,['ok'=>true]+nspp_detail($owner,(string)($_GET['key']??''),($is_admin??'')==='super'));
  if($action==='dashboard')nsp_reply(200,['ok'=>true,'csrf'=>$csrf]+nspp_dashboard($owner));
  if($action==='stats'){
   $targets=json_decode((string)($_GET['targets']??'[]'),true,8,JSON_THROW_ON_ERROR);if(!is_array($targets)||count($targets)>30)throw new InvalidArgumentException('invalid_target');$out=[];
   foreach($targets as $x){if(!is_array($x)||!is_string($x['key']??null)||!is_string($x['type']??null))throw new InvalidArgumentException('invalid_target');try{$t=nsp_target($db,$x['type'],$x['key']);$out[]=$x+['available'=>$t['owner']!==$owner]+nsp_public($t);}catch(DomainException $e){$out[]=$x+['available'=>false];}}
   nsp_reply(200,['ok'=>true,'items'=>$out]);
  }
  $t=nsp_target($db,(string)($_GET['type']??''),(string)($_GET['key']??''));if($t['owner']===$owner)throw new DomainException('self_support_denied');
  nsp_reply(200,['ok'=>true,'csrf'=>$csrf,'balance'=>(int)get_point_sum($owner),'senderKey'=>hash('sha256',$owner),'target'=>nsp_public($t)]);
 }
 if($method!=='POST')nsp_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!is_string($_SERVER['HTTP_X_NOA_CSRF']??null)||empty($_SESSION['noa_support_csrf'])||!hash_equals($_SESSION['noa_support_csrf'],$_SERVER['HTTP_X_NOA_CSRF']))nsp_reply(403,['ok'=>false,'error'=>'csrf_required']);
 $raw=file_get_contents('php://input',false,null,0,8193);if(strlen($raw)>8192)nsp_reply(413,['ok'=>false,'error'=>'request_too_large']);$b=json_decode($raw,true,16,JSON_THROW_ON_ERROR);if(!is_array($b)||!is_string($b['requestId']??null))throw new InvalidArgumentException('invalid_request');session_write_close();
 if($action==='review'){
  if(($is_admin??'')!=='super'||$owner!==($config['cf_admin']??''))nsp_reply(403,['ok'=>false,'error'=>'administrator_required']);
  if(($b['confirmed']??false)!==true||!is_int($b['net']??null))throw new InvalidArgumentException('invalid_review');
  nsp_reply(200,['ok'=>true,'request'=>nspp_review($owner,$b)]);
 }
 if($action==='profile')nsp_reply(200,['ok'=>true,'profile'=>nspp_profile($owner,$b)]);
 if($action==='refund-request')nsp_reply(200,['ok'=>true]+nspp_refund_request($owner,(string)($b['key']??''),(string)($b['reason']??'')));
 if(in_array($action,['policy','profile-review','refund-review'],true)){
  if(($is_admin??'')!=='super')nsp_reply(403,['ok'=>false,'error'=>'administrator_required']);
  $out=match($action){'policy'=>nspp_policy_save($owner,$b),'profile-review'=>nspp_profile_review($owner,$b),'refund-review'=>nspp_refund_review($owner,$b)};nsp_reply(200,['ok'=>true,'result'=>$out]);
 }
 if($action==='send')nsp_reply(200,['ok'=>true,'receipt'=>nsp_send($owner,$b['requestId'],$b,fn()=>nsp_target($db,$b['type'],$b['key']))]);
 if($action==='settlement'&&($b['confirmed']??false)===true)nsp_reply(200,['ok'=>true,'request'=>nspp_request($owner,$b['requestId'],(string)($b['kind']??''))]);
 throw new InvalidArgumentException('unknown_action');
}catch(DomainException $e){nsp_reply(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){nsp_reply(400,['ok'=>false,'error'=>$e instanceof JsonException?'invalid_json':$e->getMessage()]);}catch(Throwable $e){error_log('[noa-support] '.get_class($e));nsp_reply(503,['ok'=>false,'error'=>'support_unavailable']);}
