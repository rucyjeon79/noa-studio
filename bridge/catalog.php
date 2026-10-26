<?php
declare(strict_types=1);
require_once dirname(__DIR__).'/common.php';
require_once __DIR__.'/storage.php';
require_once __DIR__.'/sound-core.php';
require_once dirname(__DIR__).'/noa-app/jukebox/core.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
try{
 $admin=!empty($is_member)&&($is_admin??'')==='super';$items=[];
 $db=noa_bridge_pdo();$trash=noa_sound_trash_index($db);$jukebox=nj_assets($db);$availability=is_file(__DIR__.'/media-status.php')?require __DIR__.'/media-status.php':[];
 foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','playlist','story') ORDER BY doc_key") as $row){
  $p=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);$b=$p['body']??[];
  
  $url=$b['youtubeUrl']??'';$id='';
  if(is_string($url)){
   $u=parse_url($url);$host=strtolower($u['host']??'');
   if(in_array($host,['youtu.be','www.youtu.be'],true))$id=trim($u['path']??'','/');
   elseif(in_array($host,['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com'],true)){
    parse_str($u['query']??'',$q);$id=is_string($q['v']??null)?$q['v']:'';
    if(!$id&&preg_match('~^/(?:embed|shorts)/([A-Za-z0-9_-]{11})(?:/|$)~',$u['path']??'',$m))$id=$m[1];
   }
  }
  if(!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id))$id='';
  if(!noa_sound_visible($p,$admin))continue;
  $publicVideo=$id&&(($availability['videos'][$id]['status']??'')==='public'||(($p['mediaAvailability']['youtubeId']??'')===$id&&($p['mediaAvailability']['status']??'')==='public'));
  if(!$admin&&!$publicVideo)$id='';
  $suno=noa_sound_suno($b);$audio=nj_resolve($jukebox,$row['doc_key'],$suno,'audio')?:noa_sound_audio($b,dirname(__DIR__));$card=nj_resolve($jukebox,$row['doc_key'],$suno,'cover')?:noa_sound_cover($b);
  if(!$admin&&!$id&&!$audio&&!$suno&&$row['kind']!=='playlist')continue;
  $items[]=['key'=>$row['doc_key'],'kind'=>$row['kind'],'genre'=>$p['genreId']??'',
   'title'=>($b['confirmedTitle']??'')?:($p['title']??''),'ep'=>$p['ep']??'','act'=>$p['act']??'',
   'tracklist'=>$b['tracklist']??'','lyrics'=>noa_sound_lyrics((string)($b['lyricsBlock']??'')),'cast'=>$b['thumbCast']??'','thumbnail'=>$card?:($id?($b['thumbUrl']??''):''),'coverImageUrl'=>$card,'sunoUrl'=>$suno,'audioVerified'=>(bool)$audio,
   'youtubeId'=>$id,'audioUrl'=>$audio,'confirmed'=>!empty($p['confirmed'])];
 }
 // Published recovery editions are additive to the legacy web/Android keys.
 // Never fall back to title matching and never overwrite an existing item.
 try{
  $recovered=$db->query("SELECT s.song_id,s.identity_json,s.genre_id,s.ep,v.fields_json,v.public_verified FROM noa_catalog_songs s JOIN noa_catalog_versions v ON v.entity_id=s.song_id AND v.entity_type='song' WHERE v.batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)");
  $seen=array_fill_keys(array_column($items,'youtubeId'),true);
  foreach($recovered as $row){if(isset($trash['ids'][$row['song_id']]))continue;$item=noa_sound_recovered($row,$admin);if($item&&!isset($seen[$item['youtubeId']])){$local=nj_resolve($jukebox,$item['key'],$item['sunoUrl'],'audio');$cover=nj_resolve($jukebox,$item['key'],$item['sunoUrl'],'cover');if($local){$item['audioUrl']=$local;$item['audioVerified']=true;}if($cover){$item['coverImageUrl']=$cover;$item['thumbnail']=$cover;}$items[]=$item;$seen[$item['youtubeId']]=true;}}
 }catch(PDOException $e){error_log('[noa-catalog-recovery-read] unavailable');}
 echo json_encode(['brand'=>'NOA STUDIO','access'=>$admin?'administrator':'public','items'=>$items],JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR);
}catch(Throwable $e){http_response_code(503);echo json_encode(['error'=>'목록을 불러오지 못했습니다.']);error_log('[noa-catalog] '.get_class($e));}
