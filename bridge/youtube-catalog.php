<?php
declare(strict_types=1);
/** Metadata-only projection of the same visible documents used by MUSIC. No writes. */
require_once __DIR__.'/sound-core.php';
require_once __DIR__.'/music-readmodel.php';
function ny_listener_catalog(PDO $db,bool $admin,array $edits=[]):array{
 $documents=[];
 foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story') ORDER BY doc_key") as $r){$d=json_decode($r['payload'],true);if(is_array($d))$documents[$r['doc_key']]=$d;}
 foreach(noa_music_recovered_catalog($db) as $key=>$d)if(!isset($documents[$key]))$documents[$key]=$d;
 $aliases=[];foreach($db->query("SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)") as $r)$aliases[$r['alias_key']][]=$r['entity_id'];
 $out=[];
 foreach($documents as $key=>$d){
  if(!noa_sound_visible($d,$admin))continue;$b=$d['body']??[];$ids=array_unique($aliases[$key]??[]);$identity=str_starts_with($key,'catalog:')?substr($key,8):(count($ids)===1?array_values($ids)[0]:$key);
  $r=['key'=>$key,'orderKey'=>$identity,'title'=>(string)(($b['confirmedTitle']??'')?:($d['title']??$key)),'genre'=>(string)($d['genreId']??'other'),'ep'=>(string)($d['ep']??''),'act'=>(string)($d['act']??''),'kind'=>'video'];
  $fields=function_exists('nie_fields')?nie_fields($edits,$r):[];if(isset($fields['title']))$r['title']=$fields['title'];$r['canonicalVideo']=ny_video_id((string)($fields['youtubeUrl']??$b['youtubeUrl']??''));$out[$identity]=$r;
 }
 return $out;
}
function ny_coming_art(string $genre):array{
 $genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story'];
 if($genre==='cover-reborn')return ['thumb'=>'/noa-assets/splash/cover-reborn-g2-a.jpg','comingOverlay'=>true];
 return ['thumb'=>'/noa-assets/coming/'.(in_array($genre,$genres,true)?$genre:'kpop-original').'.jpg','comingOverlay'=>false];
}
/** Preserve playable rows; add explicit non-playable previews for private/missing videos. */
function ny_complete_catalog_rows(array $publicRows,array $videos,array $catalog):array{
 $rows=$publicRows;$byVideo=[];$represented=[];
 foreach($catalog as $identity=>$r)if($r['canonicalVideo'])$byVideo[$r['canonicalVideo']]=$identity;
 foreach($rows as &$r){$identity=(string)(($r['orderKey']??'')?:($byVideo[$r['video']??'']??''));if(isset($catalog[$identity])&&!in_array($videos[$r['video']??'']['match']['status']??'',['rejected','conflict'],true)){$represented[$identity]=true;$r['orderKey']=$identity;}}unset($r);
 foreach($videos as $id=>$v){
  if(($v['status']['privacyStatus']??'')==='public'&&!empty($v['status']['embeddable']))continue;
  if(in_array($v['match']['status']??'',['rejected','conflict'],true))continue;
  $identity=(string)(($v['match']['songId']??'')?:($byVideo[$id]??''));if(!isset($catalog[$identity]))continue;$r=$catalog[$identity];$represented[$identity]=true;
  // Private provider titles, descriptions, URLs and video IDs are not serialized.
  $rows[]=array_merge($r,ny_coming_art($r['genre']),['key'=>'coming:'.hash('sha256','video:'.$id),'musicKey'=>$r['key'],'video'=>'','comingSoon'=>true,'preferredVideo'=>$r['canonicalVideo']===$id,'availability'=>'coming-soon']);
 }
 foreach($catalog as $identity=>$r){if(isset($represented[$identity]))continue;$rows[]=array_merge($r,ny_coming_art($r['genre']),['key'=>'coming:'.hash('sha256','song:'.$identity),'musicKey'=>$r['key'],'video'=>'','comingSoon'=>true,'preferredVideo'=>true,'availability'=>'coming-soon']);}
 foreach($rows as &$r)unset($r['canonicalVideo']);unset($r);return $rows;
}
