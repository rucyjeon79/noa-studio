<?php
declare(strict_types=1);
/** Narrow service authentication for N80 availability GETs. No user, session, role or write grant. */
function nmr_scope(string $target,string $range):bool{
 if($target==='/noa-music.php')return $range==='';
 foreach(['/noa-music-detail.php?key='=>'', '/noa-app/jukebox/stream.php?key='=>'&type=audio'] as $prefix=>$suffix){
  if(!str_starts_with($target,$prefix)||($suffix!==''&&!str_ends_with($target,$suffix)))continue;
  $encoded=substr($target,strlen($prefix),strlen($target)-strlen($prefix)-strlen($suffix));$key=rawurldecode($encoded);
  return preg_match('/^[a-zA-Z0-9:_-]{1,190}$/D',$key)===1&&rawurlencode($key)===$encoded&&$range===($suffix===''?'':'bytes=0-4095');
 }
 return false;
}
function nmr_message(string $target,string $range,string $timestamp,string $nonce):string{return "N80-MUSIC-READ-1\nGET\n".$target."\n".$range."\n".$timestamp."\n".$nonce;}
function nmr_verify(array $server,string $key,int $now):bool{
 if(strlen($key)!==64||($server['REQUEST_METHOD']??'')!=='GET'||($server['HTTP_X_N80_AVAILABILITY_CHECK']??'')!=='1')return false;
 $target=$server['REQUEST_URI']??'';$range=$server['HTTP_RANGE']??'';$ts=$server['HTTP_X_N80_MEDIA_TIMESTAMP']??'';$nonce=$server['HTTP_X_N80_MEDIA_NONCE']??'';$sig=$server['HTTP_X_N80_MEDIA_SIGNATURE']??'';
 if(!is_string($target)||!is_string($range)||!is_string($ts)||!is_string($nonce)||!is_string($sig)||!nmr_scope($target,$range)||!preg_match('/^[0-9]{10}$/D',$ts)||abs($now-(int)$ts)>180||!preg_match('/^[a-f0-9]{32}$/D',$nonce)||!preg_match('/^[a-f0-9]{64}$/D',$sig))return false;
 return hash_equals(hash_hmac('sha256',nmr_message($target,$range,$ts,$nonce),$key),$sig);
}
function nmr_key():string{
 static $key=null;if($key!==null)return $key;
 $file='/hosting/noastudio/noa-ai-lab/worker.key';$value=is_file($file)?trim((string)@file_get_contents($file,false,null,0,129)):'';
 return $key=strlen($value)===64?$value:'';
}
function nmr_current():bool{
 if(empty($_SERVER['HTTP_X_N80_MEDIA_SIGNATURE']))return false;
 return nmr_verify($_SERVER,nmr_key(),time());
}
function nmr_request_headers(string $target,string $range):string{
 $key=nmr_key();if($key==='')return '';if(!nmr_scope($target,$range))throw new InvalidArgumentException('unsupported_music_proof_scope');
 $timestamp=(string)time();$nonce=bin2hex(random_bytes(16));$signature=hash_hmac('sha256',nmr_message($target,$range,$timestamp,$nonce),$key);
 return 'X-N80-Media-Timestamp: '.$timestamp."\r\nX-N80-Media-Nonce: ".$nonce."\r\nX-N80-Media-Signature: ".$signature."\r\n";
}
