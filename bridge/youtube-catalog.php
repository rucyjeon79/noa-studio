<?php
declare(strict_types=1);
/** Metadata-only projection of the same visible documents used by MUSIC. No writes. */
require_once __DIR__.'/sound-core.php';
require_once __DIR__.'/music-readmodel.php';
function ny_listener_catalog(PDO $db,bool $admin,array $edits=[]):array{
 $documents=[];
 foreach($db->query("SELECT d.doc_key,d.kind,d.payload,UNIX_TIMESTAMP(h.changed_at) AS registered_at FROM noa_documents d LEFT JOIN noa_document_history h ON h.doc_key=d.doc_key AND h.revision=1 WHERE d.kind IN ('single','story','playlist') ORDER BY d.doc_key") as $r){$d=json_decode($r['payload'],true);if(is_array($d)){$d['_listenerKind']=$r['kind'];$d['_registeredAt']=(int)$r['registered_at'];$documents[$r['doc_key']]=$d;}}
 foreach(noa_music_recovered_catalog($db) as $key=>$d)if(!isset($documents[$key]))$documents[$key]=$d;
 $aliases=[];foreach($db->query("SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)") as $r)$aliases[$r['alias_key']][]=$r['entity_id'];
 $out=[];
 foreach($documents as $key=>$d){
  if(!noa_sound_visible($d,$admin))continue;$b=$d['body']??[];$ids=array_unique($aliases[$key]??[]);$identity=str_starts_with($key,'catalog:')?substr($key,8):(count($ids)===1?array_values($ids)[0]:$key);
  $r=['registeredAt'=>(int)($d['_registeredAt']??0),'key'=>$key,'orderKey'=>$identity,'title'=>(string)(($b['confirmedTitle']??'')?:($d['title']??$key)),'genre'=>(string)($d['genreId']??'other'),'ep'=>(string)($d['ep']??''),'act'=>(string)($d['act']??''),'kind'=>($d['_listenerKind']??'')==='playlist'?'playlist':'video','browsePriority'=>(str_starts_with($key,'catalog:')?0:2)+(!empty($d['packageSchema'])?1:0)];
  $fields=function_exists('nie_fields')?nie_fields($edits,$r):[];foreach(['title','genre','collectionIds','canonicalRecordKey'] as $field)if(array_key_exists($field,$fields))$r[$field]=$fields[$field];$r['originalArtist']=noa_music_original_artist($b,(string)($fields['originalArtist']??''));$r['_browseSuno']=(string)($fields['sunoUrl']??(($b['sunoUrl']??'')?:($b['sunoShareUrl']??'')));$r['canonicalVideo']=ny_video_id((string)($fields['youtubeUrl']??$b['youtubeUrl']??''));if(!empty($d['customPlaylistId'])){if(!$r['canonicalVideo'])continue;$r['customPlaylistId']=(string)$d['customPlaylistId'];}$out[$identity]=$r;
 }
 return $out;
}
/** View-only identity for copies with the same explicit video and classification.
 * Keep documents, imports, edit keys and distinct versions intact. Titles are not evidence.
 * Collection videos are separate records even when they share a song's video URL.
 */
function ny_browse_catalog(array $catalog,array $videos=[]):array{
 return noa_music_browse_catalog($catalog,$videos);
}
/** Only explicitly linked, verified public collection videos may reappear beside their playlist. */
function ny_act_public_sources(array $videos,array $catalog):array{
 $out=[];foreach($catalog as $r){if(($r['kind']??'')!=='playlist')continue;$id=$r['canonicalVideo']??'';$v=$videos[$id]??null;if($v&&($v['status']['privacyStatus']??'')==='public'&&!empty($v['status']['embeddable'])&&!in_array($v['match']['status']??'',['rejected','conflict'],true))$out[$id]=$v;}return $out;
}
function ny_coming_art(string $genre):array{
 $genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story'];
 if($genre==='cover-reborn')return ['thumb'=>'/noa-assets/splash/cover-reborn-g2-a.jpg','comingOverlay'=>true];
 return ['thumb'=>'/noa-assets/coming/'.(in_array($genre,$genres,true)?$genre:'kpop-original').'.jpg','comingOverlay'=>false];
}
/** Preserve playable rows; add explicit non-playable previews for private/missing videos. */
function ny_complete_catalog_rows(array $publicRows,array $videos,array $catalog,bool $playlistScoped=false):array{
 $rows=$publicRows;$byVideo=[];$represented=[];$catalog=ny_browse_catalog($catalog,$videos);$videoOwners=[];
 foreach($catalog as $identity=>$r)if($r['canonicalVideo'])$videoOwners[$r['canonicalVideo']][]=$identity;
 foreach($videoOwners as $video=>$ids){$groups=[];foreach($ids as $id)$groups[$catalog[$id]['browseIdentity']??$id]=true;if(count($groups)===1)$byVideo[$video]=$ids[0];}
 foreach($rows as &$r){$identity=(string)(isset($catalog[$r['orderKey']??''])?$r['orderKey']:($byVideo[$r['video']??'']??$r['orderKey']??''));if(isset($catalog[$identity])&&!in_array($videos[$r['video']??'']['match']['status']??'',['rejected','conflict'],true)){$represented[$identity]=true;$r['orderKey']=$identity;if(($catalog[$identity]['kind']??'')==='playlist'){foreach(['title','genre','ep','act','kind'] as $field)$r[$field]=$catalog[$identity][$field];$r['musicKey']=$catalog[$identity]['key'];if(isset($catalog[$identity]['customPlaylistId']))$r['customPlaylistId']=$catalog[$identity]['customPlaylistId'];$r['preferredVideo']=$catalog[$identity]['canonicalVideo']===($r['video']??'');}}}unset($r);
 foreach($videos as $id=>$v){
  if(($v['status']['privacyStatus']??'')==='public'&&!empty($v['status']['embeddable']))continue;
  if(in_array($v['match']['status']??'',['rejected','conflict'],true))continue;
  $identity=(string)(($v['match']['songId']??'')?:($byVideo[$id]??''));if(!isset($catalog[$identity]))continue;$r=$catalog[$identity];$represented[$identity]=true;
  // Private provider titles, descriptions, URLs and video IDs are not serialized.
  $rows[]=array_merge($r,ny_coming_art($r['genre']),['key'=>'coming:'.hash('sha256','video:'.$id),'musicKey'=>$r['key'],'video'=>'','comingSoon'=>true,'preferredVideo'=>$r['canonicalVideo']===$id,'availability'=>'coming-soon']);
 }
 foreach($catalog as $identity=>$r){if($playlistScoped||isset($represented[$identity]))continue;$playable=ny_act_public_sources($videos,[$r]);if($playable){$id=array_key_first($playable);$rows[]=array_merge($r,['key'=>$id,'musicKey'=>$r['key'],'video'=>$id,'preferredVideo'=>true]);continue;}$rows[]=array_merge($r,ny_coming_art($r['genre']),['key'=>'coming:'.hash('sha256','song:'.$identity),'musicKey'=>$r['key'],'video'=>'','comingSoon'=>true,'preferredVideo'=>true,'availability'=>'coming-soon']);}
 foreach($rows as &$r){$source=$catalog[$r['orderKey']??'']??[];foreach(['originalArtist','registeredAt','browseIdentity','browseKeys','canonicalRecordKey','collectionIds'] as $field)if(array_key_exists($field,$source))$r[$field]=$source[$field];if(isset($source['browseIdentity']))$r['browsePriority']=$source['browsePriority']??0;unset($r['canonicalVideo'],$r['_browseSuno']);}unset($r);return $rows;
}
