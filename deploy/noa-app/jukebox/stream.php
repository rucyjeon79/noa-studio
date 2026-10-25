<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/common.php';require dirname(__DIR__,2).'/noa-bridge/storage.php';require dirname(__DIR__,2).'/noa-bridge/sound-core.php';require __DIR__.'/core.php';
require_once dirname(__DIR__,2).'/noa-bridge/member-access.php';
header('X-Content-Type-Options: nosniff');header('Cache-Control: private, no-store');
if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){http_response_code(405);header('Allow: GET, HEAD');exit;}
try{
 $key=$_GET['key']??'';$type=$_GET['type']??'audio';if(!is_string($key)||strlen($key)>191||!in_array($type,['cover','audio'],true)){http_response_code(404);exit;}
 $db=noa_bridge_pdo();$doc=nj_document($db,$key);
 if(!$doc){http_response_code(404);exit;}
 $access=nam_access((array)($member??[]),(string)($is_admin??''));$admin=$access['admin'];$owner=$access['creator']&&nam_owner($doc,(array)($member??[]));if(($type==='audio'&&!$access['music']&&!$owner)||(!noa_sound_visible($doc,$admin)&&!$owner)){http_response_code(403);exit;}
 $asset=nj_find($db,$key);if(!$asset||!hash_equals($asset['source_url'],noa_sound_suno($doc['body']??[]))||!nj_verified($asset,$type)){http_response_code(404);exit;}
 $path=nj_file($asset[$type.'_path']);$file=fopen($path,'rb');if(!$file){http_response_code(404);exit;}$size=fstat($file)['size'];
 try{[$start,$end,$code]=nj_range($_SERVER['HTTP_RANGE']??null,$size);}catch(InvalidArgumentException $e){fclose($file);http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
 while(ob_get_level())ob_end_clean();
 http_response_code($code);header('Content-Type: '.($type==='audio'?'audio/mpeg':'image/webp'));header('Accept-Ranges: bytes');header('Content-Length: '.($end-$start+1));
 if($code===206)header('Content-Range: bytes '.$start.'-'.$end.'/'.$size);
 if(($_SERVER['REQUEST_METHOD']??'GET')==='HEAD'){fclose($file);exit;}
 fseek($file,$start);$left=$end-$start+1;
 // Deliver the first real block before optional ranking work: playback never waits for event setup.
 $first=fread($file,min(65536,$left));
 if($first!==false&&$first!==''&&!connection_aborted()){
  echo $first;$left-=strlen($first);flush();
  if($type==='audio'&&($_SERVER['HTTP_X_N80_AVAILABILITY_CHECK']??'')!=='1'&&session_status()===PHP_SESSION_ACTIVE){require_once __DIR__.'/stream-popularity.php';nj_track_verified_audio($db,$doc,$key,($is_admin??'')!=='',$_SESSION,time());}
 }
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 while($left>0&&!connection_aborted()){$block=fread($file,min(65536,$left));if($block===false||$block==='')break;echo $block;$left-=strlen($block);flush();}fclose($file);
}catch(Throwable $e){error_log('[jukebox-stream] '.get_class($e));http_response_code(503);}

