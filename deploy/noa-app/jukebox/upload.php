<?php
declare(strict_types=1);ini_set('display_errors','0');
require dirname(__DIR__,2).'/common.php';require dirname(__DIR__,2).'/noa-bridge/storage.php';require dirname(__DIR__,2).'/noa-bridge/sound-core.php';require __DIR__.'/upload-core.php';
$requestId=bin2hex(random_bytes(8));header('X-NOA-Request-ID: '.$requestId);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nu_json(int $code,array $out):never{global $requestId;if(isset($out['error'])){$out['request_id']=$requestId;if(preg_match('/^[a-z][a-z0-9_:-]{0,99}$/D',(string)$out['error']))header('X-NOA-Error-Code: '.$out['error']);}http_response_code($code);echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
if(empty($is_member)||($is_admin??'')!=='super')nu_json(403,['error'=>'administrator_required']);
// Authentication and CSRF use the session; status reads and file verification
// must not hold its lock while other requests from this browser are running.
$faultSession=hash('sha256',session_id());$csrf=$_SESSION['noa_jukebox_csrf']??'';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
try{
 $db=noa_bridge_pdo();$action=(string)($_GET['action']??'status');
 if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&$action==='health')nu_json(200,nr_health($db));
 if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&$action==='queue'){nr_schema($db);nu_json(200,nq_snapshot($db,isset($_GET['qa']))+['health'=>nr_health($db),'incidents'=>$db->query('SELECT code,stage,http_status,upload_id,job_id,response_format,request_id,occurrences,last_seen,resolved_at FROM noa_jukebox_incidents ORDER BY last_seen DESC LIMIT 20')->fetchAll(PDO::FETCH_ASSOC)]);}
 if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&$action==='status'){
  $key=(string)($_GET['key']??'');if(strlen($key)>191||!nj_document($db,$key))nu_json(404,['error'=>'unknown_song']);
  if(isset($_GET['reconcile']))nu_json(200,nr_reconcile($db,$key,(string)($_GET['id']??'')));
  $out=nu_public($db,$key);if(isset($_GET['id'])){$u=nu_row($db,(string)$_GET['id']);if($u['song_key']!==$key)throw new DomainException('upload_song_mismatch');$out['chunks']=nu_chunks($u);}nu_json(200,$out);
 }
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')nu_json(405,['error'=>'method_not_allowed']);
 $token=$_SERVER['HTTP_X_NOA_CSRF']??'';if(!is_string($csrf)||$csrf===''||!is_string($token)||!hash_equals($csrf,$token))nu_json(403,['error'=>'csrf_required']);
 if($action==='chunk'){$index=filter_var($_GET['index']??'',FILTER_VALIDATE_INT);if($index===false)throw new InvalidArgumentException('invalid_chunk');$id=(string)($_GET['id']??'');$u=nu_row($db,$id);$fault=nr_fault_take($db,$faultSession,$u['song_key'],$action);
  if($fault==='http_503'){header('Retry-After: 1');nu_json(503,['error'=>'upload_service_unavailable']);}
  if($fault==='html_response'){http_response_code(200);header('Content-Type: text/html; charset=utf-8');echo '<!doctype html><title>QA temporary response</title>';exit;}
  $raw=file_get_contents('php://input',false,null,0,(nd_is($u)?ND_CHUNK:NU_CHUNK)+1);$out=nu_chunk($db,$id,$index,$raw);if($fault==='chunk_response_lost'){http_response_code(200);echo '';exit;}nu_json(200,$out);}
 $raw=file_get_contents('php://input',false,null,0,16385);if(strlen($raw)>16384)throw new InvalidArgumentException('request_too_large');$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 if($action==='qa_selftest')nu_json(200,nr_selftest($db));
 if($action==='qa_fault')nu_json(200,nr_fault_setup($db,$b));
 if($action==='client_incident'){nr_schema($db);$code=(string)($b['code']??'');if(!in_array($code,['response_html','response_empty','response_json_invalid','response_schema_invalid','network_unavailable','request_timeout','authentication_required','upload_service_unavailable','hosting_storage_insufficient','temporary_storage_quota_reached','http_429','http_500','http_502','http_503','http_504'],true))throw new InvalidArgumentException('invalid_incident_code');nr_incident($db,$code,(string)($b['stage']??'unknown'),$b['upload_id']??null,null,$b);nu_json(200,['recorded'=>true]);}
 if($action==='init'&&nr_fault_take($db,$faultSession,(string)($b['key']??''),$action)==='storage_insufficient')throw new DomainException('hosting_storage_insufficient');
 if($action==='init')nu_json(200,nu_initialize($db,$b,(string)$member['mb_id']));
 if($action==='cancel')nu_json(200,nu_cancel_pending($db,(string)($b['id']??'')));
 if($action==='cancel_processing')nu_json(200,nu_cancel_processing($db,(string)($b['id']??'')));
 if($action==='finish'){$u=nu_row($db,(string)($b['id']??''));$fault=nr_fault_take($db,$faultSession,$u['song_key'],$action);$out=nu_finish($db,$u['id']);if($out['status']==='ready'){try{nu_cleanup_verified($db,$u['id']);}catch(Throwable $e){}}if($fault==='finish_response_lost'){http_response_code(200);echo '';exit;}nu_json(200,$out);}
 if($action==='retry'){nq_retry($db,(string)($b['id']??''));nu_json(200,nu_public($db,nu_row($db,$b['id'])['song_key']));}
 throw new InvalidArgumentException('unknown_action');
}catch(DomainException $e){$code=$e->getMessage();nu_json(in_array($code,['account_storage_quota_exceeded','hosting_storage_insufficient','storage_permission_denied','upload_storage_unavailable'],true)?507:409,['error'=>$code]);}catch(InvalidArgumentException|JsonException $e){nu_json(400,['error'=>$e instanceof JsonException?'invalid_json':$e->getMessage()]);}catch(Throwable $e){error_log('[jukebox-upload] '.get_class($e).':'.$e->getCode());nu_json(503,['error'=>'upload_service_unavailable']);}
