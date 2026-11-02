<?php
declare(strict_types=1);
ini_set('display_errors','0');
header('Cache-Control: no-store');
header('Content-Type: application/json');
if(time()>__EXPIRY__ || !hash_equals('__TOKEN_SHA__',hash('sha256',$_SERVER['HTTP_X_NOA_DIAGNOSTIC']??''))){http_response_code(403);exit;}
require dirname(__DIR__).'/common.php';
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
require_once __DIR__.'/storage.php';
require_once __DIR__.'/sound-core.php';
require_once __DIR__.'/inline-edit.php';
$db=noa_bridge_pdo();
$db->exec('SET TRANSACTION READ ONLY');
$db->beginTransaction();
try {
 $items=[];
 require_once __DIR__.'/youtube-store.php';
 $run=ny_latest($db);
 $songs=ny_songs($db,ny_batch($db));
 $videos=$run?ny_videos($db,$run,true,$songs):[];
 $conflicts=0;$unsafe=0;
 foreach($videos as $video){
  if(($video['match']['status']??'')!=='conflict')continue;
  $conflicts++;if(!empty($video['match']['songId']))$unsafe++;
 }
 $pool=nup_song_pool($db);$ambiguousAliases=count(array_filter($pool,fn($owners)=>count($owners)>1));
 $audit=['catalogSongs'=>count($songs),'videos'=>count($videos),'conflictingVideos'=>$conflicts,'conflictsStillLinked'=>$unsafe,'ambiguousSongAliases'=>$ambiguousAliases];
 if($unsafe)throw new RuntimeException('conflicting_video_still_linked');
 $bloomKey='catalog:a785dbc3e646c64b54cd1536048100e5ee66f55ec9be69d39e6b5251c91f4bba';
 $rows=$db->query("SELECT doc_key,payload FROM noa_documents WHERE kind IN ('single','story')")->fetchAll(PDO::FETCH_ASSOC);
 foreach($rows as $row){
  $doc=json_decode($row['payload'],true,512,JSON_THROW_ON_ERROR);
  if(!empty($doc['_noaTrash']))continue;
  $key=$row['doc_key'];
  $bloom=$key===$bloomKey;
  if(!$bloom && strcasecmp(trim(nup_fields($doc)['title']),'A Small Tremor')!==0)continue;
  $result=nie_resolve($db,['type'=>'song','source'=>'music','key'=>$key]);
  $history=$db->prepare('SELECT revision,payload FROM noa_document_history WHERE doc_key=? ORDER BY revision');
  $history->execute([$key]);$withBloom=[];$withIntro=[];
  foreach($history as $version){
   $body=json_decode($version['payload'],true)['body']??[];
   if(stripos((string)($body['youtubeTitle']??''),'BLOOM')!==false)$withBloom[]=(int)$version['revision'];
   if(str_contains((string)($body['youtubeDescription']??''),'오늘의 사연이 음악이 됩니다'))$withIntro[]=(int)$version['revision'];
  }
  $items[]=['record'=>$bloom?'BLOOM':'A Small Tremor','genre'=>$result['context']['genre'],'ep'=>$result['context']['ep'],'keyMatches'=>$result['writeKey']===$key,'revision'=>$result['revision'],'originalStatus'=>$result['original']['status']??null,'bloomInStoredTitle'=>stripos($result['fields']['youtubeTitle'],'BLOOM')!==false,'hasStoryLine'=>str_contains($result['fields']['description'],'오늘의 사연이 음악이 됩니다'),'titleHistory'=>$withBloom,'descriptionHistory'=>$withIntro];
 }
 echo json_encode(['ok'=>true,'databaseWrites'=>0,'items'=>$items,'catalogAudit'=>$audit],JSON_THROW_ON_ERROR);
}finally{$db->rollBack();}
