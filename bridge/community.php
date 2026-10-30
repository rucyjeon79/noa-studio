<?php
declare(strict_types=1);
ini_set('display_errors','0');
$nc_output_level=ob_get_level();ob_start();
require_once dirname(__DIR__).'/common.php';
while(ob_get_level()>$nc_output_level)ob_end_clean();
require_once __DIR__.'/community-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store, max-age=0');header('Vary: Cookie');header('X-Content-Type-Options: nosniff');
function nc_reply(array $data,int $status=200):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR);exit;}
$_SESSION['noa_community_csrf']??=bin2hex(random_bytes(32));
try{
 $method=$_SERVER['REQUEST_METHOD']??'GET';
 if($method==='GET'&&session_status()===PHP_SESSION_ACTIVE)session_write_close();
 if($method==='GET'&&($_GET['action']??'')==='home')nc_reply(['ok'=>true]+nc_home());
 if(empty($member['mb_id'])||(int)($member['mb_level']??1)<2)nc_reply(['ok'=>false,'error'=>'login_required'],401);
 if($method==='GET'){
  $action=(string)($_GET['action']??'list');$board=(string)($_GET['board']??'free');
  if($action==='list')$data=nc_list($board,max(0,(int)($_GET['before']??0)))+['csrf'=>$_SESSION['noa_community_csrf']];
  elseif($action==='read')$data=nc_read($board,(int)($_GET['id']??0));else throw new DomainException('invalid_input');
 }elseif($method==='POST'){
  $origin=(string)($_SERVER['HTTP_ORIGIN']??'');if($origin!==''&&$origin!=='https://noastudio.ai.kr')nc_reply(['ok'=>false,'error'=>'origin_not_allowed'],403);
  if(!hash_equals($_SESSION['noa_community_csrf'],(string)($_SERVER['HTTP_X_NOA_CSRF']??'')))nc_reply(['ok'=>false,'error'=>'csrf_required'],403);
  $raw=file_get_contents('php://input',false,null,0,70001);if(strlen($raw)>70000)throw new DomainException('invalid_input');$input=json_decode($raw,true,16,JSON_THROW_ON_ERROR);if(!is_array($input))throw new DomainException('invalid_input');
  $data=match($input['action']??''){'unlock'=>nc_unlock((int)($input['id']??0),(string)($input['password']??'')),'create'=>nc_create($input),'comment'=>nc_comment($input),default=>throw new DomainException('invalid_input')};
 }else{header('Allow: GET, POST');nc_reply(['ok'=>false,'error'=>'method_not_allowed'],405);}
 nc_reply(['ok'=>true]+$data);
}catch(DomainException $e){$error=$e->getMessage();nc_reply(['ok'=>false,'error'=>$error],$error==='try_later'?429:(str_contains($error,'not_allowed')||$error==='password_not_verified'?403:400));}
catch(JsonException $e){nc_reply(['ok'=>false,'error'=>'invalid_input'],400);}
catch(Throwable $e){error_log('[noa-community] '.get_class($e));nc_reply(['ok'=>false,'error'=>'temporarily_unavailable'],503);}
