<?php
declare(strict_types=1);
require dirname(__DIR__,2).'/common.php';require dirname(__DIR__,2).'/noa-bridge/storage.php';require dirname(__DIR__,2).'/noa-bridge/sound-core.php';require __DIR__.'/core.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit;}
if(!in_array($_SERVER['REQUEST_METHOD']??'GET',['GET','HEAD'],true)){http_response_code(405);exit;}
try{
 $key=$_GET['key']??'';if(!is_string($key)||strlen($key)>191){http_response_code(404);exit;}$db=noa_bridge_pdo();$doc=nj_document($db,$key);$a=nj_find($db,$key);
 if(!$doc||!$a||!hash_equals($a['source_url'],noa_sound_suno($doc['body']??[]))||!nj_verified($a,'audio')){http_response_code(404);exit;}
 $p=nj_file($a['audio_path']);$size=filesize($p);try{[$start,$end,$code]=nj_range($_SERVER['HTTP_RANGE']??null,$size);}catch(InvalidArgumentException $e){http_response_code(416);header('Content-Range: bytes */'.$size);exit;}
 $filename=nj_download_name(($a['suno_title']?:$a['title'])?:'NOA');
 if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&$start===0)$db->prepare('INSERT INTO noa_jukebox_downloads(song_key,sha256,bytes,requested_by) VALUES(?,?,?,?)')->execute([$key,$a['audio_sha256'],$size,(string)$member['mb_id']]);
 $f=fopen($p,'rb');if(!$f)throw new RuntimeException('unreadable_audio');session_write_close();while(ob_get_level())ob_end_clean();http_response_code($code);
 header('Content-Type: audio/mpeg');header('Content-Disposition: attachment; filename="NOA-track.mp3"; filename*=UTF-8\'\''.rawurlencode($filename));header('X-NOA-SHA256: '.$a['audio_sha256']);header('Accept-Ranges: bytes');header('Content-Length: '.($end-$start+1));if($code===206)header('Content-Range: bytes '.$start.'-'.$end.'/'.$size);
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='HEAD'){fseek($f,$start);$left=$end-$start+1;while($left>0&&!connection_aborted()){$b=fread($f,min(65536,$left));if($b===false||$b==='')break;echo $b;$left-=strlen($b);flush();}}fclose($f);
}catch(Throwable $e){error_log('[jukebox-download] '.get_class($e));http_response_code(503);}
