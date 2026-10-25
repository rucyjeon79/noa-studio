<?php
declare(strict_types=1);require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/storage.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/member-access.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
$a=nam_access((array)($member??[]),(string)($is_admin??''));if(!$a['music']&&!$a['creator']){http_response_code(403);exit;}
if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){http_response_code(405);exit;}
$name=$_GET['file']??'';if(!is_string($name)||!preg_match('/^[A-Za-z0-9_-][A-Za-z0-9_.-]*[.](?:mp3|m4a|ogg|wav|flac|aac)$/D',$name)){http_response_code(404);exit;}
try{
 $db=noa_bridge_pdo();$wanted='https://noastudio.ai.kr/data/noa-audio/'.$name;$path=null;
 foreach($db->query("SELECT payload FROM noa_documents WHERE kind IN ('single','story','playlist')")as $r){$d=json_decode($r['payload'],true,512,JSON_THROW_ON_ERROR);if(($d['body']['audioUrl']??'')!==$wanted)continue;$owner=$a['creator']&&nam_owner($d,(array)($member??[]));if((!$a['music']&&!$owner)||(!noa_sound_visible($d,$a['admin'])&&!$owner))continue;if(noa_sound_audio($d['body'],dirname(__DIR__))===$wanted){$path=dirname(__DIR__).'/data/noa-audio/'.$name;break;}}
 if(!$path){http_response_code(404);exit;}$file=fopen($path,'rb');$size=fstat($file)['size'];try{[$start,$end,$code]=nj_range($_SERVER['HTTP_RANGE']??null,$size);}catch(InvalidArgumentException $e){fclose($file);http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
 session_write_close();while(ob_get_level())ob_end_clean();http_response_code($code);header('Content-Type: '.(new finfo(FILEINFO_MIME_TYPE))->file($path));header('Accept-Ranges: bytes');header('Content-Length: '.($end-$start+1));if($code===206)header('Content-Range: bytes '.$start.'-'.$end.'/'.$size);if(($_SERVER['REQUEST_METHOD']??'GET')!=='HEAD'){fseek($file,$start);$left=$end-$start+1;while($left>0&&!connection_aborted()){$block=fread($file,min(65536,$left));if($block===false||$block==='')break;echo $block;$left-=strlen($block);}}fclose($file);
}catch(Throwable $e){error_log('[noa-legacy-audio] '.get_class($e));http_response_code(503);}
