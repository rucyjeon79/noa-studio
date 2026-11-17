<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
function nm_reply(int $status,array $data):never{http_response_code($status);echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
if(($_SERVER['REQUEST_METHOD']??'')!=='POST')nm_reply(405,['error'=>'method']);
$key=$_SERVER['HTTP_X_NOA_ACTION_KEY']??'';
if(!preg_match('/^[a-f0-9]{64}$/D',$key))nm_reply(401,['error'=>'worker_key_required']);
try{
 $dir=dirname(G5_PATH).'/noa-ai-lab/gpt-action';$file=$dir.'/state.json';
 if(is_link($dir)||is_link($file)||!is_file($file)||filesize($file)>16777216)nm_reply(401,['error'=>'worker_not_configured']);
 $lock=fopen($dir.'/lock','c');if(!$lock||!flock($lock,LOCK_SH))throw new RuntimeException('storage_lock');
 try{$auth=json_decode((string)file_get_contents($file),true,32,JSON_THROW_ON_ERROR);}finally{flock($lock,LOCK_UN);fclose($lock);}
 if(empty($auth['workerHash'])||!hash_equals($auth['workerHash'],hash('sha256',$key))||($auth['owner']??'')!==($config['cf_admin']??null))nm_reply(401,['error'=>'invalid_worker_key']);
 unset($key);$owner=(string)$auth['owner'];unset($auth);
 if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nm_reply(415,['error'=>'json_required']);
 $raw=file_get_contents('php://input',false,null,0,1048577);if(strlen($raw)>1048576)nm_reply(413,['error'=>'too_large']);
 $body=json_decode($raw,true,32,JSON_THROW_ON_ERROR);if(!is_array($body))throw new InvalidArgumentException('invalid_request');
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 require_once __DIR__.'/movie-execution.php';nm_reply(200,['ok'=>true]+nm_worker((string)($_GET['op']??''),$body,$owner));
}catch(DomainException $e){nm_reply(409,['error'=>$e->getMessage()]);}
catch(InvalidArgumentException|JsonException $e){nm_reply(400,['error'=>'invalid_request']);}
catch(Throwable $e){nm_reply(500,['error'=>'movie_worker_unavailable']);}
