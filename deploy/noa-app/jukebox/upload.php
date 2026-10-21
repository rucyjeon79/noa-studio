<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/common.php';require dirname(__DIR__,2).'/noa-bridge/storage.php';require dirname(__DIR__,2).'/noa-bridge/sound-core.php';require __DIR__.'/upload-core.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
function nu_json(int $code,array $out):never{http_response_code($code);echo json_encode($out,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
if(empty($is_member)||($is_admin??'')!=='super')nu_json(403,['error'=>'administrator_required']);
try{
 $db=noa_bridge_pdo();$action=(string)($_GET['action']??'status');
 if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&$action==='status'){
  $key=(string)($_GET['key']??'');if(strlen($key)>191||!nj_document($db,$key))nu_json(404,['error'=>'unknown_song']);
  $out=nu_public($db,$key);if(isset($_GET['id'])){$u=nu_row($db,(string)$_GET['id']);if($u['song_key']!==$key)throw new DomainException('upload_song_mismatch');$out['chunks']=nu_chunks($u);}nu_json(200,$out);
 }
 if(($_SERVER['REQUEST_METHOD']??'')!=='POST')nu_json(405,['error'=>'method_not_allowed']);
 $token=$_SERVER['HTTP_X_NOA_CSRF']??'';if(empty($_SESSION['noa_jukebox_csrf'])||!is_string($token)||!hash_equals($_SESSION['noa_jukebox_csrf'],$token))nu_json(403,['error'=>'csrf_required']);
 session_write_close();
 if($action==='chunk'){$index=filter_var($_GET['index']??'',FILTER_VALIDATE_INT);if($index===false)throw new InvalidArgumentException('invalid_chunk');$raw=file_get_contents('php://input',false,null,0,NU_CHUNK+1);nu_json(200,nu_chunk($db,(string)($_GET['id']??''),$index,$raw));}
 $raw=file_get_contents('php://input',false,null,0,16385);if(strlen($raw)>16384)throw new InvalidArgumentException('request_too_large');$b=json_decode($raw,true,32,JSON_THROW_ON_ERROR);
 if($action==='init')nu_json(200,nu_initialize($db,$b,(string)$member['mb_id']));
 if($action==='finish')nu_json(200,nu_finish($db,(string)($b['id']??'')));
 if($action==='retry'){$u=nu_row($db,(string)($b['id']??''));if($u['status']!=='failed'||!is_file(nu_dir($u['id']).'/input.audio'))throw new DomainException('reselect_source_file');$db->prepare("UPDATE noa_jukebox_uploads SET status='analyzing',lease=NULL,lease_until=NULL,error=NULL WHERE id=? AND status='failed'")->execute([$u['id']]);nu_json(200,nu_public($db,$u['song_key']));}
 throw new InvalidArgumentException('unknown_action');
}catch(DomainException $e){nu_json(409,['error'=>$e->getMessage()]);}catch(InvalidArgumentException|JsonException $e){nu_json(400,['error'=>$e instanceof JsonException?'invalid_json':$e->getMessage()]);}catch(Throwable $e){error_log('[jukebox-upload] '.get_class($e).':'.$e->getCode());nu_json(503,['error'=>'upload_service_unavailable']);}
