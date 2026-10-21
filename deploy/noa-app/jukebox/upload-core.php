<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/core.php';
const NU_CHUNK=524288;
const NU_MAX=268435456;
function nu_id(string $id):string{if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new InvalidArgumentException('invalid_upload_id');return $id;}
function nu_dir(string $id):string{
 $path=nj_private().'/incoming/'.nu_id($id);
 foreach([nj_private(),nj_private().'/incoming',$path] as $p){if(is_link($p))throw new DomainException('unsafe_upload_directory');if(!is_dir($p)&&!mkdir($p,0700))throw new RuntimeException('upload_storage_unavailable');}
 return $path;
}
function nu_row(PDO $db,string $id):array{$q=$db->prepare('SELECT * FROM noa_jukebox_uploads WHERE id=?');$q->execute([nu_id($id)]);$r=$q->fetch(PDO::FETCH_ASSOC);if(!$r)throw new DomainException('upload_not_found');return $r;}
function nu_chunks(array $r):array{$out=[];$dir=nu_dir($r['id']);for($i=0;$i<(int)$r['total_chunks'];$i++)if(is_file($dir.'/chunk-'.$i))$out[]=$i;return $out;}
function nu_clean(array $r):void{foreach(glob(nu_dir($r['id']).'/*') as $p)if(!is_link($p)&&is_file($p)&&preg_match('~/(?:chunk-[0-9]+|input[.]audio|input[.]part)$~D',$p))unlink($p);}
function nu_public(PDO $db,string $key):array{
 $asset=nj_find($db,$key);$ready=nj_verified($asset,'audio');$q=$db->prepare('SELECT id,status,error,filename,fingerprint,file_bytes,total_chunks,source_analysis,correction,final_analysis,updated_at FROM noa_jukebox_uploads WHERE song_key=? ORDER BY sequence DESC LIMIT 1');$q->execute([$key]);$u=$q->fetch(PDO::FETCH_ASSOC)?:null;
 return ['key'=>$key,'ready'=>$ready,'audio'=>$ready?nj_url($key,'audio'):'','download'=>$ready?'/noa-app/jukebox/download.php?key='.rawurlencode($key):'',
  'status'=>!$ready&&($u['status']??'')==='ready'?'failed':($u?$u['status']:($ready?'ready':'audio_pending')),'error'=>!$ready&&($u['status']??'')==='ready'?'final_file_missing_or_mismatched':($u['error']??null),'upload'=>$u,
  'analysis'=>$asset?['source'=>json_decode($asset['source_analysis']??'null',true),'correction'=>json_decode($asset['correction']??'null',true),'final'=>json_decode($asset['final_analysis']??'null',true)]:null];
}
function nu_initialize(PDO $db,array $b,string $actor):array{
 $key=(string)($b['key']??'');$doc=nj_document($db,$key);if(!$doc||!in_array($doc['_kind']??'',['single','story','jukebox_qa'],true))throw new DomainException('unknown_song');
 $name=(string)($b['filename']??'');$size=$b['bytes']??null;$fp=(string)($b['fingerprint']??'');$ext=strtolower(pathinfo($name,PATHINFO_EXTENSION));
 if(!in_array($ext,['mp3','wav'],true)||!is_int($size)||$size<256||$size>NU_MAX||strlen($name)>1000||!preg_match('/^[a-f0-9]{64}$/D',$fp))throw new InvalidArgumentException('mp3_wav_size_or_identity_invalid');
 $artist=trim((string)($b['originalArtist']??($doc['body']['originalArtist']??$doc['body']['originalSinger']??'')));
 if(strlen($artist)>500||(($doc['genreId']??'')==='cover-reborn'&&$artist===''))throw new InvalidArgumentException('cover_original_artist_required');
 $asset=nj_find($db,$key);$context=['originalArtist'=>$artist,'title'=>(($doc['body']['confirmedTitle']??'')?:($doc['title']??'')),'genre'=>$doc['genreId']??'unclassified','ep'=>$doc['ep']??'','act'=>$doc['act']??'',
  'suno_id'=>$asset['suno_id']??'','suno_title'=>$asset['suno_title']??'','catalogId'=>$doc['_catalog_id']??null,'authorization'=>'administrator_owned_upload','confirmed_by'=>$actor];
 $context=array_merge($context,nj_taxonomy($db,$key,$doc));if(empty($context['act'])&&!empty($context['ep']))$context['act']=(string)ceil((int)$context['ep']/10);
 if(!$db->query("SELECT GET_LOCK('noa_jukebox_upload_quota',5)")->fetchColumn())throw new DomainException('upload_busy_retry');
 try{
  $q=$db->prepare("SELECT * FROM noa_jukebox_uploads WHERE song_key=? AND status IN ('uploading','analyzing','processing') ORDER BY sequence DESC LIMIT 1");$q->execute([$key]);$active=$q->fetch(PDO::FETCH_ASSOC);
  if($active){if($active['fingerprint']!==$fp||(int)$active['file_bytes']!==$size)throw new DomainException('another_upload_is_active');return ['id'=>$active['id'],'chunks'=>nu_chunks($active),'status'=>$active['status'],'chunkSize'=>NU_CHUNK];}
  $reserved=(int)$db->query("SELECT COALESCE(SUM(file_bytes),0) FROM noa_jukebox_uploads WHERE status<>'ready'")->fetchColumn();
  if($reserved+$size>1073741824)throw new DomainException('temporary_storage_quota_reached');
  $id=bin2hex(random_bytes(16));$dir=nu_dir($id);if(disk_free_space($dir)<$size*2+67108864)throw new DomainException('hosting_storage_insufficient');
  $db->prepare('INSERT INTO noa_jukebox_uploads(id,song_key,source_url,filename,extension,file_bytes,fingerprint,total_chunks,status,previous_sha256,context,requested_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$id,$key,noa_sound_suno($doc['body']??[]),$name,$ext,$size,$fp,(int)ceil($size/NU_CHUNK),'uploading',$asset['audio_sha256']??null,json_encode($context,JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR),$actor]);
  return ['id'=>$id,'chunks'=>[],'status'=>'uploading','chunkSize'=>NU_CHUNK];
 }finally{$db->query("SELECT RELEASE_LOCK('noa_jukebox_upload_quota')");}
}
function nu_chunk(PDO $db,string $id,int $index,string $raw):array{
 $r=nu_row($db,$id);if($r['status']!=='uploading'||$index<0||$index>=(int)$r['total_chunks'])throw new DomainException('upload_not_accepting_chunks');
 $expected=min(NU_CHUNK,(int)$r['file_bytes']-$index*NU_CHUNK);if(strlen($raw)!==$expected)throw new InvalidArgumentException('chunk_size_mismatch');
 $dir=nu_dir($id);$lock=fopen($dir.'/.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('upload_lock_failed');
 try{if(nu_row($db,$id)['status']!=='uploading')throw new DomainException('upload_not_accepting_chunks');$file=$dir.'/chunk-'.$index;if(is_file($file)){if(!hash_equals(hash_file('sha256',$file),hash('sha256',$raw)))throw new DomainException('chunk_conflict');}
  else{if(disk_free_space($dir)<strlen($raw)+33554432)throw new DomainException('hosting_storage_insufficient');if(file_put_contents($file,$raw,LOCK_EX)!==strlen($raw))throw new RuntimeException('chunk_write_failed');chmod($file,0600);}
  $db->prepare('UPDATE noa_jukebox_uploads SET updated_at=CURRENT_TIMESTAMP WHERE id=?')->execute([$id]);return ['index'=>$index,'sha256'=>hash('sha256',$raw)];
 }finally{flock($lock,LOCK_UN);fclose($lock);}
}
function nu_finish(PDO $db,string $id):array{
 $r=nu_row($db,$id);if($r['status']!=='uploading')return nu_public($db,$r['song_key']);$dir=nu_dir($id);$lock=fopen($dir.'/.lock','c');if(!$lock||!flock($lock,LOCK_EX))throw new RuntimeException('upload_lock_failed');
 try{
  if(count(nu_chunks($r))!==(int)$r['total_chunks'])throw new DomainException('upload_incomplete');
  if(disk_free_space($dir)<(int)$r['file_bytes']+33554432)throw new DomainException('hosting_storage_insufficient');
  $out=fopen($dir.'/input.part','wb');$bytes=0;try{for($i=0;$i<(int)$r['total_chunks'];$i++){$in=fopen($dir.'/chunk-'.$i,'rb');$bytes+=stream_copy_to_stream($in,$out);fclose($in);}}finally{fclose($out);}chmod($dir.'/input.part',0600);
  if($bytes!==(int)$r['file_bytes'])throw new DomainException('assembled_size_mismatch');
  $head=file_get_contents($dir.'/input.part',false,null,0,16);$wave=substr($head,0,4)==='RIFF'&&substr($head,8,4)==='WAVE';$mp3=str_starts_with($head,'ID3')||(strlen($head)>1&&ord($head[0])===255&&(ord($head[1])&224)===224);
  if(($r['extension']==='wav'&&!$wave)||($r['extension']==='mp3'&&!$mp3))throw new InvalidArgumentException('actual_audio_format_mismatch');
  $mime=(new finfo(FILEINFO_MIME_TYPE))->file($dir.'/input.part');if(!in_array($mime,['audio/mpeg','audio/wav','audio/x-wav','audio/vnd.wave'],true))throw new InvalidArgumentException('actual_audio_format_mismatch');
  $sha=hash_file('sha256',$dir.'/input.part');$old=nj_find($db,$r['song_key']);$before=json_decode($old['source_analysis']??'null',true);
  if(nj_verified($old,'audio')&&($before['sha256']??'')===$sha){$db->prepare("UPDATE noa_jukebox_uploads SET status='ready',sha256=? WHERE id=?")->execute([$sha,$id]);nu_clean($r);return nu_public($db,$r['song_key']);}
  rename($dir.'/input.part',$dir.'/input.audio');$db->prepare("UPDATE noa_jukebox_uploads SET status='analyzing',sha256=?,error=NULL WHERE id=? AND status='uploading'")->execute([$sha,$id]);
  for($i=0;$i<(int)$r['total_chunks'];$i++)unlink($dir.'/chunk-'.$i);
  return nu_public($db,$r['song_key']);
 }catch(InvalidArgumentException $e){$db->prepare("UPDATE noa_jukebox_uploads SET status='failed',file_bytes=0,error=? WHERE id=?")->execute([$e->getMessage(),$id]);nu_clean($r);throw $e;}finally{if(is_file($dir.'/input.part'))unlink($dir.'/input.part');flock($lock,LOCK_UN);fclose($lock);}
}
function nu_housekeeping(PDO $db):void{
 $q=$db->query("SELECT * FROM noa_jukebox_uploads WHERE status<>'ready' AND updated_at<CURRENT_TIMESTAMP()-INTERVAL 24 HOUR AND (lease_until IS NULL OR lease_until<CURRENT_TIMESTAMP()) LIMIT 100");
 foreach($q as $r){nu_clean($r);$db->prepare("UPDATE noa_jukebox_uploads SET status='failed',file_bytes=0,error='temporary_upload_expired',lease=NULL WHERE id=?")->execute([$r['id']]);}
}
