<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/membership-core.php';require_once __DIR__.'/member-access.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nr_reply(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
$access=nam_access((array)($member??[]),(string)($is_admin??''));$method=$_SERVER['REQUEST_METHOD']??'GET';
if(!$access['member'])nr_reply($method==='GET'?200:401,['ok'=>$method==='GET','member'=>false,'error'=>$method==='GET'?null:'login_required']);
$owner=(string)$member['mb_id'];$_SESSION['noa_membership_csrf']??=bin2hex(random_bytes(32));
try{
 $rules=nr_policy();$active=!empty($rules['enabled']);$action=$_GET['action']??'status';
 if($method==='GET'){
  $m=nr_member($owner,false);$p=ns_policy();$g=ns_doc(ns_member_key($owner));$grant=$g['data']??null;$auto=nr_auto_settings($owner);$pending=ns_doc(nr_key('login',$owner,nr_day(time())));$ledger=[];
  $rows=ns_q('SELECT po_id,po_datetime,po_content,po_point,po_mb_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner).' ORDER BY po_id DESC LIMIT 20');while($row=sql_fetch_array($rows))$ledger[]=$row;
  $orders=[];$rows=ns_q("SELECT payload FROM noa_documents WHERE kind='membership_topup'".($access['admin']&&$action==='admin'?'':" AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.ownerId'))=".ns_e($owner)).' ORDER BY updated_at DESC LIMIT 30');while($row=sql_fetch_array($rows)){$o=json_decode($row['payload'],true,32,JSON_THROW_ON_ERROR);if(!$access['admin'])unset($o['ownerId'],$o['reference'],$o['verifiedBy']);$orders[]=$o;}
  nr_reply(200,['ok'=>true,'member'=>true,'admin'=>$access['admin'],'enabled'=>$active,'csrf'=>$_SESSION['noa_membership_csrf'],'name'=>$access['name'],'level'=>$access['level'],'balance'=>(int)$m['mb_point'],'grant'=>$grant?array_intersect_key($grant,array_flip(['baseLevel','paidLevel','status','until'])):null,'remainingDays'=>($grant['status']??'')==='active'?max(0,(int)ceil((($grant['until']??0)-time())/86400)):0,'pendingLogin'=>($pending['data']['state']??'')==='pending'?100:0,'autoRenew'=>$auto,'policyRevision'=>$p['revision'],'vipPoints'=>3000,'durationDays'=>30,'wonPerPoint'=>1,'payment'=>['enabled'=>$p['values']['paymentApprovalEnabled'],'provider'=>$p['values']['provider'],'instructions'=>$p['values']['paymentInstructions']],'ledger'=>$ledger,'topups'=>$orders,'youtubeRewardEnabled'=>false]);
 }
 if($method!=='POST')nr_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($_SESSION['noa_membership_csrf'],$_SERVER['HTTP_X_NOA_CSRF']??'')||strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nr_reply(403,['ok'=>false,'error'=>'csrf_required']);
 if(!$active)throw new DomainException('membership_not_ready');$raw=file_get_contents('php://input',false,null,0,8193);if(strlen($raw)>8192)throw new InvalidArgumentException('request_too_large');$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($b))throw new InvalidArgumentException('invalid_request');
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 if($action==='vip'){
  if(!is_string($b['requestId']??null)||!is_int($b['policyRevision']??null)||($b['quotedPoints']??null)!==3000||($b['durationDays']??null)!==30||($b['confirmed']??false)!==true)throw new InvalidArgumentException('purchase_confirmation_required');
  nr_reply(200,['ok'=>true,'order'=>nr_buy_vip($owner,$b['requestId'],$b['policyRevision'],time())]);
 }
 if($action==='auto'){
  if(!is_bool($b['enabled']??null)||!is_int($b['revision']??null))throw new InvalidArgumentException('invalid_request');
  nr_reply(200,['ok'=>true,'autoRenew'=>nr_set_auto($owner,$b['enabled'],$b['revision'],time())]);
 }
 if($action==='topup'){
  if(!is_string($b['requestId']??null)||!is_int($b['points']??null))throw new InvalidArgumentException('invalid_request');
  nr_reply(200,['ok'=>true,'order'=>nr_topup_order($owner,$b['requestId'],$b['points'],time())]);
 }
 if($action==='admin_confirm'){
  if(!$access['admin'])nr_reply(403,['ok'=>false,'error'=>'admin_required']);
  if(($b['paymentConfirmed']??false)!==true||!is_string($b['ownerId']??null)||!is_string($b['id']??null)||!is_string($b['reference']??null)||!is_int($b['amountWon']??null))throw new InvalidArgumentException('payment_confirmation_required');
  nr_reply(200,['ok'=>true,'order'=>nr_confirm_topup($b['ownerId'],$b['id'],trim($b['reference']),$b['amountWon'],$owner,time())]);
 }
 throw new InvalidArgumentException('invalid_action');
}catch(DomainException $e){nr_reply(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){nr_reply(400,['ok'=>false,'error'=>$e instanceof JsonException?'invalid_request':$e->getMessage()]);}catch(Throwable $e){error_log('[noa-membership] '.get_class($e));nr_reply(503,['ok'=>false,'error'=>'membership_unavailable']);}
