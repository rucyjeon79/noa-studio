<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
function nj_root():string{return dirname(__DIR__,2).'/noa-jukebox';}
function nj_file(string $relative):?string{
 if($relative===''||str_contains($relative,"\0")||str_contains($relative,'\\')||str_starts_with($relative,'/')||preg_match('~(?:^|/)\.{1,2}(?:/|$)~',$relative))return null;
 $root=realpath(nj_root());$path=realpath(nj_root().'/'.$relative);
 return $root&&$path&&str_starts_with($path,$root.'/')&&is_file($path)&&is_readable($path)?$path:null;
}
function nj_schema(PDO $db):void{
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_assets (song_key VARCHAR(191) PRIMARY KEY, source_url TEXT NOT NULL, suno_id VARCHAR(64) NOT NULL DEFAULT '', suno_title TEXT NULL, genre VARCHAR(128) NOT NULL DEFAULT '', ep VARCHAR(32) NOT NULL DEFAULT '', title TEXT NULL, cover_path TEXT NULL, cover_bytes BIGINT NULL, cover_sha256 CHAR(64) NULL, audio_path TEXT NULL, audio_bytes BIGINT NULL, audio_sha256 CHAR(64) NULL, source_analysis JSON NULL, correction JSON NULL, final_analysis JSON NULL, status VARCHAR(32) NOT NULL DEFAULT 'audio_pending', errors JSON NULL, verified_at DATETIME NULL, updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_history (id BIGINT AUTO_INCREMENT PRIMARY KEY, song_key VARCHAR(191) NOT NULL, result JSON NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, KEY(song_key)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
 $db->exec("CREATE TABLE IF NOT EXISTS noa_jukebox_jobs (id BIGINT AUTO_INCREMENT PRIMARY KEY, action VARCHAR(32) NOT NULL, requested_by VARCHAR(191) NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'queued', created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at DATETIME NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}
function nj_find(PDO $db,string $key):?array{
 $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=?');$q->execute([$key]);return $q->fetch(PDO::FETCH_ASSOC)?:null;
}
function nj_url(string $key,string $type):string{return 'https://noastudio.ai.kr/noa-app/jukebox/stream.php?key='.rawurlencode($key).'&type='.$type;}
function nj_verified(?array $asset,string $type):bool{
 if(!$asset||($type==='audio'&&$asset['status']!=='ready'))return false;
 $p=nj_file((string)($asset[$type.'_path']??''));$hash=(string)($asset[$type.'_sha256']??'');
 if(!$p||!preg_match('/^[a-f0-9]{64}$/D',$hash)||filesize($p)!==(int)$asset[$type.'_bytes'])return false;
 if(!hash_equals($hash,hash_file('sha256',$p)))return false;
 $mime=(new finfo(FILEINFO_MIME_TYPE))->file($p);
 return $mime===($type==='cover'?'image/webp':'audio/mpeg');
}
function nj_assets(PDO $db):array{
 try{$out=[];foreach($db->query('SELECT * FROM noa_jukebox_assets') as $r)$out[$r['song_key']]=$r;return $out;}
 catch(PDOException $e){error_log('[jukebox] assets unavailable');return [];}
}
function nj_resolve(array $assets,string $key,string $source,string $type):string{
 $r=$assets[$key]??null;
 return $r&&hash_equals($r['source_url'],$source)&&nj_verified($r,$type)?nj_url($key,$type):'';
}
function nj_range(?string $header,int $size):array{
 if($size<=0)throw new InvalidArgumentException('empty');
 if(!$header)return [0,$size-1,200];
 if(!preg_match('/^bytes=(\d*)-(\d*)$/D',$header,$m)||($m[1]===''&&$m[2]===''))throw new InvalidArgumentException('range');
 if($m[1]===''){$n=(int)$m[2];if($n<1)throw new InvalidArgumentException('range');$start=max(0,$size-$n);$end=$size-1;}
 else{$start=(int)$m[1];$end=$m[2]===''?$size-1:min($size-1,(int)$m[2]);}
 if($start>=$size||$start>$end)throw new InvalidArgumentException('range');
 return [$start,$end,206];
}
function nj_import(PDO $db,array $r):void{
 $key=(string)($r['song_key']??'');$q=$db->prepare('SELECT payload FROM noa_documents WHERE doc_key=?');$q->execute([$key]);$raw=$q->fetchColumn();
 if(!$raw)throw new DomainException('unknown_song');$doc=json_decode($raw,true,512,JSON_THROW_ON_ERROR);
 $source=noa_sound_suno($doc['body']??[]);if(!$source||!hash_equals($source,(string)$r['source_url']))throw new DomainException('source_changed');
 $old=nj_find($db,$key);$new=['song_key'=>$key,'source_url'=>$source,'suno_id'=>(string)($r['suno_id']??''),'suno_title'=>$r['suno_title']??null,'genre'=>$doc['genreId']??'','ep'=>$doc['ep']??'','title'=>$doc['title']??'', 'status'=>'audio_pending'];
 foreach(['cover','audio'] as $type){
  if(empty($r[$type.'_path']))continue;
  $candidate=$r;if($type==='audio')$candidate['status']='ready';
  if(!nj_verified($candidate,$type))throw new DomainException('file_verification_failed');
  if($type==='cover'){if(!getimagesize(nj_file($r['cover_path'])))throw new DomainException('cover_decode_failed');}
  else{
   $a=$r['final_analysis']??[];
   if(($a['codec']??'')!=='mp3'||($a['channels']??0)!==2||($a['decode_errors']??true)||!is_numeric($a['true_peak']??null)||$a['true_peak']>-1||($a['duration']??0)<=0)throw new DomainException('audio_analysis_invalid');
   $new['status']='ready';
  }
  foreach(['path','bytes','sha256'] as $f)$new[$type.'_'.$f]=$r[$type.'_'.$f];
 }
 foreach(['source_analysis','correction','final_analysis','errors'] as $f)if(isset($r[$f]))$new[$f]=json_encode($r[$f],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
 $new['verified_at']=gmdate('Y-m-d H:i:s');
 $db->beginTransaction();
 try{
  // Never overwrite a verified edition implicitly; retain it and append new evidence.
  $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$key]);$old=$q->fetch(PDO::FETCH_ASSOC);
  if($old&&$old['source_url']===$source){
   foreach(['suno_id','suno_title'] as $field)if(empty($new[$field])&&!empty($old[$field]))$new[$field]=$old[$field];
   foreach(['cover','audio'] as $type)if(nj_verified($old,$type)){
    foreach(['path','bytes','sha256'] as $f)$new[$type.'_'.$f]=$old[$type.'_'.$f];
    if($type==='audio'){$new['status']='ready';foreach(['source_analysis','correction','final_analysis'] as $f)$new[$f]=$old[$f];}
   }
  }
  $columns=array_keys($new);$sql='INSERT INTO noa_jukebox_assets (`'.implode('`,`',$columns).'`) VALUES ('.implode(',',array_fill(0,count($new),'?')).') ON DUPLICATE KEY UPDATE '.implode(',',array_map(fn($k)=>'`'.$k.'`=VALUES(`'.$k.'`)',$columns));
  $db->prepare($sql)->execute(array_values($new));
  $db->prepare('INSERT INTO noa_jukebox_history(song_key,result) VALUES(?,?)')->execute([$key,json_encode($r,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)]);$db->commit();
 }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
}
