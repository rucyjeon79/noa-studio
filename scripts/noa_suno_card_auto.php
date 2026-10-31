<?php
declare(strict_types=1);ini_set('display_errors','0');header('Content-Type: application/json');header('Cache-Control: no-store');
if(($_SERVER['REQUEST_METHOD']??'')!=='POST'||time()>NOA_COVER_EXPIRY||!hash_equals('NOA_COVER_TOKEN_SHA',hash('sha256',(string)($_SERVER['HTTP_X_NOA_CONTROL']??'')))){http_response_code(404);exit;}
function nca_target(?array $asset,string $key):array{
 $audio=!empty($asset['audio_path'])?nj_file($asset['audio_path']):null;
 if($audio){$relative=dirname($asset['audio_path']).'/cover.webp';$base=substr($audio,0,-strlen($asset['audio_path']));return ['targetBase'=>rtrim($base,'/'),'coverPath'=>$relative];}
 return ['targetBase'=>nj_private().'/media','coverPath'=>'cover-only/'.hash('sha256',$key).'/cover.webp'];
}
$level=ob_get_level();ob_start();require_once dirname(__DIR__).'/common.php';
try{
 require_once __DIR__.'/storage.php';require_once __DIR__.'/creator-enrollment-core.php';require_once __DIR__.'/sound-core.php';require_once __DIR__.'/music-readmodel.php';require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
 $db=noa_bridge_pdo();if(session_status()===PHP_SESSION_ACTIVE)session_write_close();$input=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);
 if(($input['action']??'')==='inventory'){
  $assets=nj_assets($db);$rows=[];$missingSource=0;$covered=0;$readyWithoutSource=[];
  foreach($db->query("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key") as $r){$d=json_decode($r['payload'],true);if($r['kind']==='playlist'||!empty($d['_noaTrash']))continue;$b=$d['body']??[];$source=noa_sound_suno($b);
   if(noa_music_asset_url($assets,$r['doc_key'],$source,'cover')||noa_sound_cover($b)){$covered++;continue;}
   if(!$source){$missingSource++;continue;}$target=nca_target($assets[$r['doc_key']]??null,$r['doc_key']);$rows[]=['key'=>$r['doc_key'],'sunoUrl'=>$source,'title'=>$d['title']??'','revision'=>(int)$r['revision'],'ownerId'=>$d['ownerId']??'',...$target];
  }$result=['ok'=>true,'rows'=>$rows,'covered'=>$covered,'missingSource'=>$missingSource,'readyWithoutSource'=>$readyWithoutSource];
 }elseif(($input['action']??'')==='apply'){
  $r=$input['record'];$key=(string)$r['song_key'];$doc=nc_row($db,$key);if(!$doc||($doc['document']['ownerId']??'')!==($input['ownerId']??'')||!in_array($doc['kind'],['single','story'],true)||!empty($doc['document']['_noaTrash']))throw new DomainException('owner_or_song_changed');
  if(!nj_verified($r,'cover'))throw new DomainException('invalid_cover');
  $db->beginTransaction();$q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');$q->execute([$key]);$old=$q->fetch(PDO::FETCH_ASSOC)?:null;
  $q=$db->prepare('SELECT payload,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');$q->execute([$key]);$current=$q->fetch(PDO::FETCH_ASSOC);$d=json_decode($current['payload'],true);$source=noa_sound_suno($d['body']??[]);
  if($current['revision']!=$input['revision']||$source!==$r['source_url']||($d['ownerId']??'')!==($input['ownerId']??'')||!empty($d['_noaTrash']))throw new DomainException('song_changed');
  if(($old&&nj_asset_source($old,'cover')===$source&&nj_verified($old,'cover'))||noa_sound_cover($d['body']??[]))throw new DomainException('existing_media_preserved');
  $target=nca_target($old,$key);if($r['cover_path']!==$target['coverPath']||nj_file($r['cover_path'])!==$target['targetBase'].'/'.$target['coverPath'])throw new DomainException('media_directory_changed');
  if($old){
   $evidence=json_decode((string)($old['source_evidence']??'null'),true);if($evidence===null)$evidence=[];if(!is_array($evidence))throw new DomainException('invalid_source_evidence');$evidence['coverSourceUrl']=$source;$evidence['coverSunoId']=$r['suno_id'];
   $db->prepare('UPDATE noa_jukebox_assets SET cover_path=?,cover_bytes=?,cover_sha256=?,source_evidence=? WHERE song_key=?')->execute([$r['cover_path'],$r['cover_bytes'],$r['cover_sha256'],json_encode($evidence,JSON_THROW_ON_ERROR),$key]);
   $after=nj_find($db,$key);nup_attach_asset($db,$key,$after);$db->prepare('INSERT INTO noa_jukebox_history(song_key,result) VALUES(?,?)')->execute([$key,json_encode(['action'=>'cover-only-repair','result'=>$r],JSON_THROW_ON_ERROR)]);
  }else nj_import($db,$r);$after=nj_find($db,$key);
  if($old)foreach(['source_url','suno_id','suno_title','audio_path','audio_bytes','audio_sha256','source_analysis','correction','final_analysis','status','catalog_context','errors','verified_at'] as $field)if(($after[$field]??null)!==($old[$field]??null))throw new RuntimeException('audio_preservation_failed');
  if(!nj_verified($after,'cover'))throw new RuntimeException('cover_readback_failed');$db->commit();$result=['ok'=>true,'key'=>$key,'coverUrl'=>nj_url($key,'cover'),'audioPreserved'=>true,'public'=>noa_sound_visible($d,false)];
 }else throw new DomainException('invalid_action');
}catch(Throwable $e){if(isset($db)&&$db->inTransaction())$db->rollBack();http_response_code(409);header('X-NOA-Cover-Error: '.get_class($e).'-'.preg_replace('/[^a-zA-Z0-9_-]/','',substr($e->getMessage(),0,120)));$result=['ok'=>false,'error'=>$e instanceof DomainException?$e->getMessage():'cover_control_failed'];}
while(ob_get_level()>$level)ob_end_clean();header('Content-Type: application/json');echo json_encode($result,JSON_THROW_ON_ERROR);
