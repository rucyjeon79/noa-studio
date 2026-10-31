<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';require_once __DIR__.'/community-core.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){http_response_code(405);exit;}
try{
 $id=(int)($_GET['request']??0);$key=$_GET['key']??'';
 if(!is_string($key)||strlen($key)>191||empty($member['mb_id'])){http_response_code(403);exit;}
 nc_board(NC_REQUEST_BOARD);if(!nc_request_audio_allowed($id,$key)){http_response_code(403);exit;}
 nc_music($key);$asset=nj_find(noa_bridge_pdo(),$key);$path=nj_file($asset['audio_path']);$file=fopen($path,'rb');if(!$file){http_response_code(404);exit;}$size=fstat($file)['size'];
 try{[$start,$end,$code]=nj_range($_SERVER['HTTP_RANGE']??null,$size);}catch(InvalidArgumentException $e){fclose($file);http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();while(ob_get_level())ob_end_clean();
 http_response_code($code);header('Content-Type: audio/mpeg');header('Accept-Ranges: bytes');header('Content-Length: '.($end-$start+1));if($code===206)header('Content-Range: bytes '.$start.'-'.$end.'/'.$size);
 if(($_SERVER['REQUEST_METHOD']??'GET')==='HEAD'){fclose($file);exit;}fseek($file,$start);$left=$end-$start+1;
 while($left>0&&!connection_aborted()){$block=fread($file,min(65536,$left));if($block===false||$block==='')break;echo $block;$left-=strlen($block);flush();}fclose($file);
}catch(DomainException $e){http_response_code(403);}catch(Throwable $e){error_log('[request-audio] '.get_class($e));http_response_code(503);}
