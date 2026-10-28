<?php
declare(strict_types=1);ini_set('display_errors','0');$buffer=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';while(ob_get_level()>$buffer)ob_end_clean();require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-enrollment-core.php';
function nce_reply(int $code,array $data):never{http_response_code($code);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_THROW_ON_ERROR);exit;}
$_SESSION['noa_enrollment_csrf']??=bin2hex(random_bytes(32));$_SESSION['noa_enrollment_claim']??=bin2hex(random_bytes(32));$super=!empty($member['mb_id'])&&($is_admin??'')==='super';
try{
 $db=noa_bridge_pdo();$action=(string)($_GET['action']??'status');$method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='GET'&&$action==='status')nce_reply(200,['ok'=>true,'csrf'=>$_SESSION['noa_enrollment_csrf'],'application'=>nce_public_application(nce_owned_application($db,(array)$member,$_SESSION['noa_enrollment_claim']),true),'certReady'=>count(nce_cert_options($config))>0]);
 if($method==='GET'&&$action==='reviews'){
  if(!$super)nce_reply(403,['ok'=>false,'error'=>'super_required']);$state=$_GET['state']??'pending';if(!in_array($state,['pending','approved','rejected'],true))throw new InvalidArgumentException('invalid_state');$q=$db->prepare('SELECT * FROM noa_creator_applications WHERE state=? ORDER BY created_at DESC LIMIT 100');$q->execute([$state]);nce_reply(200,['ok'=>true,'items'=>array_map(fn($a)=>nce_public_application($a,true),$q->fetchAll(PDO::FETCH_ASSOC)),'csrf'=>$_SESSION['noa_enrollment_csrf'],'certReady'=>count(nce_cert_options($config))>0]);
 }
 if($method!=='POST')nce_reply(405,['ok'=>false,'error'=>'method_not_allowed']);
 if(($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr'||!hash_equals($_SESSION['noa_enrollment_csrf'],(string)($_SERVER['HTTP_X_NOA_CSRF']??'')))nce_reply(403,['ok'=>false,'error'=>'csrf_required']);
 if((int)($_SERVER['CONTENT_LENGTH']??0)>6291456)nce_reply(413,['ok'=>false,'error'=>'invalid_symbol']);
 if($action==='cert-start'){
  if(!nce_cert_options($config))throw new DomainException('cert_not_configured');nce_rate($db,'identity',10);foreach(['ss_cert_type','ss_cert_no','ss_cert_hash','ss_cert_birth','ss_cert_dupinfo']as $k)unset($_SESSION[$k]);$_SESSION['noa_creator_cert_started']=time();nce_reply(200,['ok'=>true]);
 }
 if(in_array($action,['draft','submit'],true)){
  if(!empty($member['mb_id'])&&!in_array((int)$member['mb_level'],[2,3,4],true))throw new DomainException('application_not_allowed');
  // common.php escapes native form values; PDO and password hashing need the original bytes.
  $input=array_map(static fn($v)=>is_string($v)?stripslashes($v):$v,$_POST);
  nce_rate($db,'application',20);$symbol=nce_symbol_upload($_FILES['symbol']??[]);try{$a=nce_save($db,$input,(array)$member,$_SESSION,$config,$_SESSION['noa_enrollment_claim'],$symbol,$action==='submit');}catch(Throwable $e){if($symbol!=='')unlink(nce_root().'/symbols/'.$symbol.'.jpg');throw $e;}
  nce_reply(200,['ok'=>true,'application'=>nce_public_application($a,true)]);
 }
 if($action==='review'){
  if(!$super)nce_reply(403,['ok'=>false,'error'=>'super_required']);$b=json_decode(file_get_contents('php://input',false,null,0,8193),true,8,JSON_THROW_ON_ERROR);if(!is_int($b['revision']??null))throw new InvalidArgumentException('invalid_review');nce_reply(200,['ok'=>true]+nce_review($db,(string)($b['id']??''),$b['revision'],(string)($b['decision']??''),(string)($b['note']??''),(string)$member['mb_id'],$super));
 }
 throw new InvalidArgumentException('invalid_action');
}catch(DomainException $e){nce_reply(409,['ok'=>false,'error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){nce_reply(400,['ok'=>false,'error'=>$e instanceof JsonException?'invalid_input':$e->getMessage()]);}catch(Throwable $e){error_log('[noa-creator-enrollment] '.get_class($e).' code='.$e->getCode().($e instanceof PDOException?' driver='.(string)($e->errorInfo[1]??''):''));nce_reply(503,['ok'=>false,'error'=>'service_unavailable']);}
