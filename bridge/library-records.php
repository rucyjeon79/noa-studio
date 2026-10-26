<?php
declare(strict_types=1);
require_once __DIR__.'/sound-core.php';
require_once __DIR__.'/inline-edit.php';
/** One current document per catalog identity; immutable import snapshots remain intact. */
function ncl_records(PDO $db,bool $admin,string $memberId='',bool $trash=false):array{
 $batch=$db->query("SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1")->fetchColumn();
 $documents=[];$aliases=[];$used=[];$rows=[];
 foreach($db->query("SELECT doc_key,kind,payload,revision FROM noa_documents WHERE kind IN ('single','story','playlist') ORDER BY doc_key") as $d){$d['document']=json_decode($d['payload'],true,512,JSON_THROW_ON_ERROR);$documents[$d['doc_key']]=$d;}
 if($batch){
  $q=$db->prepare('SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=?');$q->execute([$batch]);foreach($q as $a)if(isset($documents[$a['alias_key']]))$aliases[$a['entity_id']][$a['alias_key']]=$documents[$a['alias_key']];
  $q=$db->prepare('SELECT v.*,s.genre_id,s.ep,s.language,s.version_name,p.owner_id,a.genre_id AS act_genre,a.act_number FROM noa_catalog_versions v LEFT JOIN noa_catalog_songs s ON v.entity_id=s.song_id LEFT JOIN noa_catalog_playlists p ON v.entity_id=p.playlist_id LEFT JOIN noa_catalog_acts a ON p.act_id=a.act_id WHERE v.batch_id=? ORDER BY v.entity_id');$q->execute([$batch]);
  foreach($q as $r){
   $id=$r['entity_id'];$private=$r['owner_id']!==null;$own=$private&&$memberId!==''&&$r['owner_id']===$memberId;
   $candidates=$aliases[$id]??[];foreach($candidates as $key=>$candidate)$used[$key]=true;if(isset($documents['catalog:'.$id]))$candidates=['catalog:'.$id=>$documents['catalog:'.$id]];
   foreach($candidates as $key=>$candidate)$used[$key]=true;
   if(!$admin&&(($private&&!$own)||(!$own&&!$r['public_verified'])))continue;
   $source=count($candidates)===1?reset($candidates):null;$fields=json_decode($r['fields_json'],true,512,JSON_THROW_ON_ERROR);
   $d=$source['document']??['genreId'=>$r['genre_id']??$r['act_genre']??'unclassified','ep'=>$r['ep']??'','act'=>$r['act_number']??'','title'=>$fields['title']??'','visibility'=>$r['public_verified']?'public':'private','body'=>$fields];
   $deleted=!empty($d['_noaTrash']);if($trash!==$deleted||(!$admin&&!$own&&!noa_sound_visible($d,false)))continue;
   $key=$source['doc_key']??'catalog:'.$id;
   $rows[$id]=ncl_record($id,$key,$source['kind']??($r['entity_type']==='song'?'story':'playlist'),$d,(int)($source['revision']??0),count($candidates)>1);
  }
 }
 foreach($documents as $key=>$source){if(isset($used[$key]))continue;$d=$source['document'];$owner=$d['ownerId']??$d['owner_id']??null;$own=$owner!==null&&$memberId!==''&&$owner===$memberId;$deleted=!empty($d['_noaTrash']);if($trash!==$deleted||(!$admin&&!$own&&!noa_sound_visible($d,false)))continue;
  // Private personal lists retain their original owner restriction.
  $owner=$d['ownerId']??$d['owner_id']??null;if($owner!==null&&!$admin&&$owner!==$memberId)continue;
  $id=hash('sha256','document:'.$key);$rows[$id]=ncl_record($id,$key,$source['kind'],$d,(int)$source['revision'],false);$rows[$id]['orderKey']=$key;
 }
 $edits=nie_overrides($db);foreach($rows as &$row){$projected=nie_project($edits,[$row])[0];$row['title']=$projected['title'];$fields=nie_fields($edits,$row);if(!array_key_exists('songDescription',$fields)&&array_key_exists('description',$fields))$row['fields']['songDescription']=$fields['description'];foreach(['songDescription'=>'songDescription','lyrics'=>'lyricsBlock','cast'=>'thumbCast'] as $from=>$to)if(array_key_exists($from,$fields))$row['fields'][$to]=$fields[$from];}unset($row);
 return $rows;
}
function ncl_record(string $id,string $key,string $kind,array $d,int $revision,bool $ambiguous):array{
 $b=$d['body']??[];$genre=(string)($d['genreId']??'unclassified');$act=(int)($d['act']??0);$title=(string)(($b['confirmedTitle']??'')?:($d['title']??$key));
 $selector=null;if(!$ambiguous){if($kind!=='playlist')$selector=['type'=>'song','source'=>'music','key'=>$key];elseif(!empty($d['customPlaylistId']))$selector=['type'=>'playlist','id'=>$d['customPlaylistId']];elseif($act>0)$selector=['type'=>'act','genre'=>$genre,'act'=>(string)$act];}
 return ['id'=>$id,'key'=>$key,'orderKey'=>str_starts_with($key,'catalog:')?substr($key,8):$id,'kind'=>$kind,'title'=>$title,'genre'=>$genre,'ep'=>(string)($d['ep']??''),'act'=>(string)($d['act']??''),'customPlaylistId'=>$d['customPlaylistId']??null,'video'=>'','thumb'=>$b['thumbUrl']??'','revision'=>$revision,'selector'=>$selector,'deleted'=>!empty($d['_noaTrash']),'fields'=>$b,'members'=>$b['members']??[],'ambiguous'=>$ambiguous];
}
