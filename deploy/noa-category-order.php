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
function load_order(string $path):array{
 if(!is_file($path))return [];
 try{$data=json_decode((string)file_get_contents($path),true,512,JSON_THROW_ON_ERROR);}catch(Throwable $e){respond(503,['error'=>'order_storage_invalid']);}
 if(!is_array($data))respond(503,['error'=>'order_storage_invalid']);
 foreach(['story','cover'] as $group)if(isset($data[$group])&&(!is_array($data[$group])||!array_is_list($data[$group])))respond(503,['error'=>'order_storage_invalid']);
 if(isset($data['playlists'])&&(!is_array($data['playlists'])||!array_is_list($data['playlists'])))respond(503,['error'=>'playlist_storage_invalid']);
 foreach($data['playlists']??[] as $playlist)if(!is_array($playlist)||!is_string($playlist['id']??null)||!is_string($playlist['title']??null)||!in_array($playlist['group']??null,['story','cover'],true)||!is_array($playlist['keys']??null)||!array_is_list($playlist['keys']))respond(503,['error'=>'playlist_storage_invalid']);
 return $data;
}
if($_SERVER['REQUEST_METHOD']==='GET'){
 $data=load_order($path);
 $result=['story'=>is_array($data['story']??null)?$data['story']:[],'cover'=>is_array($data['cover']??null)?$data['cover']:[]];
 $result['playlists']=array_map(static fn($p)=>array_intersect_key($p,array_flip(['id','title','group','keys'])), $data['playlists']??[]);
 if(!empty($is_member)&&($is_admin??'')==='super'){
  if(empty($_SESSION['noa_category_order_csrf']))$_SESSION['noa_category_order_csrf']=bin2hex(random_bytes(32));
  $result['admin']=true;$result['csrf']=$_SESSION['noa_category_order_csrf'];
 }
 respond(200,$result);
}
if($_SERVER['REQUEST_METHOD']!=='POST')respond(405,['error'=>'method_not_allowed']);
if(empty($is_member)||($is_admin??'')!=='super')respond(403,['error'=>'admin_required']);
if(empty($_SESSION['noa_category_order_csrf'])||!hash_equals($_SESSION['noa_category_order_csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN']??'')))respond(403,['error'=>'csrf']);
$raw=file_get_contents('php://input',false,null,0,131073);
if($raw===false||strlen($raw)>131072)respond(413,['error'=>'payload_too_large']);
try{$request=json_decode($raw,true,512,JSON_THROW_ON_ERROR);}catch(Throwable $e){respond(400,['error'=>'invalid_json']);}
$creating=($request['action']??'order')==='create';
if(!in_array($request['action']??'order',['order','create'],true))respond(400,['error'=>'invalid_action']);
if($creating){
 $title=is_string($request['title']??null)?trim($request['title']):'';$requestId=$request['requestId']??'';
 if(!preg_match('/^[^\x00-\x1f\x7f]{1,80}$/uD',$title)||!is_string($requestId)||!preg_match('/^[a-zA-Z0-9_-]{16,80}$/D',$requestId))respond(400,['error'=>'invalid_playlist']);
}
$group=$request['group']??null;$keys=$request['keys']??null;
if(!in_array($group,$allowed,true)||!is_array($keys)||count($keys)>2000)respond(400,['error'=>'invalid_order']);
if($creating&&count($keys)===0)respond(400,['error'=>'empty_playlist']);
$seen=[];foreach($keys as $key){if(!is_string($key)||!preg_match('/^[a-zA-Z0-9:_-]{1,190}$/D',$key)||isset($seen[$key]))respond(400,['error'=>'invalid_key']);$seen[$key]=true;}
$dir=dirname($path);
if(!is_dir($dir)||!is_writable($dir))respond(503,['error'=>'private_storage_unavailable']);
$lock=fopen($dir.'/.category-order.lock','c');if(!$lock||!flock($lock,LOCK_EX))respond(503,['error'=>'lock_failed']);
try{
 $current=load_order($path);
 if(!$creating&&array_key_exists('expected',$request)&&(!is_array($request['expected'])||!array_is_list($request['expected'])||$request['expected']!==($current[$group]??[])))respond(409,['error'=>'order_conflict']);
 if($creating){
  $current['playlists']??=[];
  foreach($current['playlists'] as $existing)if(($existing['requestId']??'')===$requestId){
   if($existing['group']!==$group||$existing['title']!==$title||$existing['keys']!==array_values($keys))respond(409,['error'=>'request_reused']);
   respond(200,['ok'=>true,'playlist'=>array_intersect_key($existing,array_flip(['id','title','group','keys']))]);
  }
  if(count($current['playlists'])>=200)respond(409,['error'=>'playlist_limit']);
  $playlist=['id'=>bin2hex(random_bytes(12)),'title'=>$title,'group'=>$group,'keys'=>array_values($keys),'requestId'=>$requestId];
  $current['playlists'][]=$playlist;
 }else $current[$group]=array_values($keys);
 $temp=tempnam($dir,'.category-order-');
 if(!$temp)respond(503,['error'=>'temp_failed']);
 $bytes=json_encode($current,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 if(file_put_contents($temp,$bytes,LOCK_EX)!==strlen($bytes)){@unlink($temp);respond(503,['error'=>'write_failed']);}
 chmod($temp,0600);
 if(!rename($temp,$path)){@unlink($temp);respond(503,['error'=>'activate_failed']);}
 if($creating)respond(200,['ok'=>true,'playlist'=>array_intersect_key($playlist,array_flip(['id','title','group','keys']))]);
 respond(200,['ok'=>true,'group'=>$group,'count'=>count($keys)]);
}finally{flock($lock,LOCK_UN);fclose($lock);}
