<?php
declare(strict_types=1);
require_once __DIR__.'/youtube-store.php';
require_once __DIR__.'/youtube-catalog.php';
require_once __DIR__.'/inline-edit.php';

function n80_public_listening_videos(array $songs,array $videos,array $features):array{
 $owners=[];$matches=[];
 foreach($songs as $identity=>$s)if(!empty($s['canonicalVideo']))$owners[$s['canonicalVideo']][$identity]=true;
 foreach($videos as $id=>$v){
  if(!preg_match('/^[A-Za-z0-9_-]{11}$/D',(string)$id)||($v['status']['privacyStatus']??'')!=='public'||($v['status']['embeddable']??false)!==true||!empty($v['legacy']))continue;
  if(in_array($v['match']['status']??'',['rejected','conflict'],true))continue;
  $identity=$v['match']['songId']??null;$explicit=$owners[$id]??[];
  if(count($explicit)>1||($identity&&$explicit&&!isset($explicit[$identity])))continue;
  $identity=$identity?:array_key_first($explicit);$s=$songs[$identity]??null;
  if(!$s||$s['kind']==='playlist')continue;
  if(!isset($matches[$identity])||isset($explicit[$identity]))$matches[$identity]=$id;
 }
 $out=[];
 foreach($matches as $identity=>$id){
  $s=$songs[$identity];$key=$s['key'];$tags=$features[$key]??[];
  $out[]=['key'=>$key,'title'=>$s['title'],'genre'=>$s['genre'],'ep'=>$s['ep'],'act'=>$s['act'],'registeredAt'=>$s['registeredAt'],'kind'=>'single','browseIdentity'=>$s['canonicalRecordKey']??$identity,'publicVideoId'=>(string)$id,'moodScores'=>$tags['moodScores']??[],'moodAffinity'=>$tags['moodAffinity']??[]];
 }
 return $out;
}
function n80_read_listening_videos(PDO $db):array{
 $run=ny_latest($db);if(!$run)return [];
 $songs=ny_listener_catalog($db,false,nie_overrides($db));
 return n80_public_listening_videos($songs,ny_videos($db,$run),n80_song_features($db));
}
