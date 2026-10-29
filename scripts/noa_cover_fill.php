<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_COVER_EXPIRY||!hash_equals('NOA_COVER_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-enrollment-core.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/music-readmodel.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
 $db=noa_bridge_pdo();$owner=(string)$config['cf_admin'];$input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
 if(($input['action']??'')==='inventory'){
  $assets=nj_assets($db);$rows=[];$missingSource=0;$covered=0;
  foreach(nc_owned_records($db,$owner) as $r){$d=json_decode($r['payload'],true);if($r['kind']==='playlist'||!empty($d['_noaTrash']))continue;$b=$d['body']??[];$source=noa_sound_suno($b);
   if(noa_music_asset_url($assets,$r['doc_key'],$source,'cover')||noa_sound_cover($b)){$covered++;continue;}
   if(!$source){$missingSource++;continue;}$rows[]=['key'=>$r['doc_key'],'sunoUrl'=>$source,'title'=>$d['title']??'','revision'=>(int)$r['revision']];
  }$result=['ok'=>true,'rows'=>$rows,'covered'=>$covered,'missingSource'=>$missingSource];
 }elseif(($input['action']??'')==='apply'){
  $r=$input['record'];$key=(string)$r['song_key'];$doc=nc_row($db,$key);if(!$doc||!nam_owner($doc['document'],['mb_id'=>$owner])||!in_array($doc['kind'],['single','story'],true)||!empty($doc['document']['_noaTrash']))throw new DomainException('owner_or_song_changed');
  if(!preg_match('~^cover-repair/[a-f0-9]{64}/[a-f0-9]{64}[.]webp$~D',(string)$r['cover_path'])||!nj_verified($r,'cover'))throw new DomainException('invalid_cover');
  $db->beginTransaction();$q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$key]);$old=$q->fetch(PDO::FETCH_ASSOC)?:null;
  $q=$db->prepare('SELECT payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$current=$q->fetch(PDO::FETCH_ASSOC);$d=json_decode($current['payload'],true);$source=noa_sound_suno($d['body']??[]);
  if($current['revision']!=$input['revision']||$source!==$r['source_url']||!nam_owner($d,['mb_id'=>$owner])||!empty($d['_noaTrash']))throw new DomainException('song_changed');
  if(($old&&$old['source_url']!==$source)||nj_verified($old,'cover')||noa_sound_cover($d['body']??[]))throw new DomainException('existing_media_preserved');
  $backup=nce_root().'/cover-before-'.hash('sha256',$key.'|'.$current['revision']).'.json';if(is_link($backup))throw new RuntimeException('unsafe_backup');
  if(!is_file($backup)){$bytes=nce_seal(['key'=>$key,'asset'=>$old,'document'=>$current]);$f=fopen($backup,'xb');if(!$f)throw new RuntimeException('backup_failed');try{chmod($backup,0600);if(fwrite($f,$bytes)!==strlen($bytes))throw new RuntimeException('backup_failed');}finally{fclose($f);}}
  $snapshot=nce_open(file_get_contents($backup));if($snapshot!==['key'=>$key,'asset'=>$old,'document'=>$current])throw new RuntimeException('backup_conflict');
  nj_import($db,$r);$after=nj_find($db,$key);
  if($old)foreach(['audio_path','audio_bytes','audio_sha256','source_analysis','correction','final_analysis','status'] as $field)if(($after[$field]??null)!==($old[$field]??null))throw new RuntimeException('audio_preservation_failed');
  if(!nj_verified($after,'cover'))throw new RuntimeException('cover_readback_failed');$db->commit();$result=['ok'=>true,'key'=>$key,'coverUrl'=>nj_url($key,'cover'),'audioPreserved'=>true,'public'=>noa_sound_visible($d,false)];
 }else throw new DomainException('invalid_action');
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();http_response_code(409);header('X-NOA-Cover-Error: '.get_class($e).'-'.preg_replace('/[^a-zA-Z0-9_-]/','',substr($e->getMessage(),0,120)));$result=['ok'=>false,'error'=>$e instanceof DomainException?$e->getMessage():'cover_control_failed'];}
while(ob_get_level()>$level)ob_end_clean();header('Content-Type: application/json');echo json_encode($result,JSON_THROW_ON_ERROR);
