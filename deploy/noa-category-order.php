<?php
/** Administrator-only manual order, outside webroot. No catalog or media writes. */
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
$path='/hosting/noastudio/noa-ai-lab/category-order.json';
$allowed=['story','cover'];
function respond(int $status,array $value):void{http_response_code($status);echo json_encode($value,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);exit;}
if($_SERVER['REQUEST_METHOD']==='GET'){
 $data=is_file($path)?json_decode((string)file_get_contents($path),true):[];
 respond(200,['story'=>is_array($data['story']??null)?$data['story']:[],'cover'=>is_array($data['cover']??null)?$data['cover']:[]]);
}
if($_SERVER['REQUEST_METHOD']!=='POST')respond(405,['error'=>'method_not_allowed']);
if(empty($is_member)||($is_admin??'')!=='super')respond(403,['error'=>'admin_required']);
if(empty($_SESSION['noa_category_order_csrf'])||!hash_equals($_SESSION['noa_category_order_csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))respond(403,['error'=>'csrf']);
$raw=file_get_contents('php://input',false,null,0,131073);
if($raw===false||strlen($raw)>131072)respond(413,['error'=>'payload_too_large']);
try{$request=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(Throwable $e){respond(400,['error'=>'invalid_json']);}
$group=$request['group']??null;$keys=$request['keys']??null;
if(!in_array($group,$allowed,true)||!is_array($keys)||count($keys)>2000)respond(400,['error'=>'invalid_order']);
$seen=[];foreach($keys as $key){if(!is_string($key)||!preg_match('/^[a-zA-Z0-9:_-]{1,190}$/D',$key)||isset($seen[$key]))respond(400,['error'=>'invalid_key']);$seen[$key]=true;}
$dir=dirname($path);
if(!is_dir($dir)||!is_writable($dir))respond(503,['error'=>'private_storage_unavailable']);
$lock=fopen($dir.'/.category-order.lock','c');if(!$lock||!flock($lock,LOCK_EX))respond(503,['error'=>'lock_failed']);
try{
 $current=is_file($path)?json_decode((string)file_get_contents($path),true):[];
 if(!is_array($current))$current=[];
 $current[$group]=array_values($keys);
 $temp=tempnam($dir,'.category-order-');
 if(!$temp)respond(503,['error'=>'temp_failed']);
 $bytes=json_encode($current,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 if(file_put_contents($temp,$bytes,LOCK_EX)!==strlen($bytes)){@unlink($temp);respond(503,['error'=>'write_failed']);}
 chmod($temp,0600);
 if(!rename($temp,$path)){@unlink($temp);respond(503,['error'=>'activate_failed']);}
 respond(200,['ok'=>true,'group'=>$group,'count'=>count($keys)]);
}finally{flock($lock,LOCK_UN);fclose($lock);}
