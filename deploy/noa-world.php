<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';require_once __DIR__.'/noa-bridge/sound-core.php';require_once __DIR__.'/noa-bridge/storage.php';require_once __DIR__.'/noa-bridge/youtube-store.php';require_once __DIR__.'/noa-bridge/world-core.php';require_once __DIR__.'/noa-bridge/world-mv.php';require_once __DIR__.'/noa-bridge/world-story.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
$acts=[];$songs=[];$tracks=[];$selected=null;$world=null;$error=false;$mvError=false;$missing=false;
$genre=is_string($_GET['genre']??null)?$_GET['genre']:'kpop-original';$id=is_string($_GET['act']??null)?$_GET['act']:'';$story=filter_var($_GET['story']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>4]])?:null;$episode=filter_var($_GET['ep']??null,FILTER_VALIDATE_INT,['options'=>['min_range'=>1,'max_range'=>999]])?:null;
if($episode&&!$story&&$id==='')$story=(int)ceil($episode/10);
try{$db=noa_bridge_pdo();$batch=ny_batch($db);$songs=ny_songs($db,$batch);
 $q=$db->prepare("SELECT a.act_id,a.genre_id,a.act_number,p.owner_id,v.public_verified,v.fields_json FROM noa_catalog_acts a JOIN noa_catalog_playlists p ON p.playlist_id=a.act_id JOIN noa_catalog_versions v ON v.entity_id=a.act_id AND v.entity_type='playlist' WHERE v.batch_id=? ORDER BY a.genre_id,a.act_number,a.act_id");$q->execute([$batch]);foreach($q as $a){if(!nw_public($a))continue;$a['fields']=json_decode($a['fields_json'],true,512,JSON_THROW_ON_ERROR);$acts[$a['act_id']]=$a;}
 if($id!==''){if(!isset($acts[$id])){$missing=true;http_response_code(404);}else{$selected=$acts[$id];$genre=$selected['genre_id'];$story=(int)$selected['act_number'];}}
 if(!$selected&&$story)foreach($acts as $a)if($a['genre_id']===$genre&&(int)$a['act_number']===$story){$selected=$a;break;}
 if($selected){$q=$db->prepare("SELECT DISTINCT t.song_id,t.position,s.ep,v.public_verified,v.fields_json FROM noa_catalog_tracks t JOIN noa_catalog_songs s ON s.song_id=t.song_id JOIN noa_catalog_versions v ON v.entity_id=t.song_id AND v.entity_type='song' AND v.batch_id=t.batch_id WHERE t.batch_id=? AND t.playlist_id=? ORDER BY t.position,t.song_id");$q->execute([$batch,$selected['act_id']]);foreach($q as $t){if(empty($t['public_verified'])||isset(noa_sound_trash_index($db)['ids'][$t['song_id']]))continue;$t['fields']=json_decode($t['fields_json'],true,512,JSON_THROW_ON_ERROR);$tracks[$t['song_id']]=$t;}}
 try{$world=nwm_load($db,$songs);}catch(Throwable $e){$mvError=true;error_log('[noa-world-mv] '.get_class($e));}
}catch(Throwable $e){$error=true;http_response_code(503);error_log('[noa-world] '.get_class($e));}
require __DIR__.'/noa-app/world-view.php';
