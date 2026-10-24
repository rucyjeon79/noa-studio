<?php
declare(strict_types=1);
/** Official playlist identity observed in the existing channel collection on 2026-10-21. Read-only. */
const NWM_CHANNEL='UCwYy9xsAqDFat6AV5UKrfgA';
const NWM_PLAYLIST='PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY';
const NWM_ACT_PLAYLIST='PLEPMKciKgvcjkGC0rrzYE-NI8P-f-6tjN';
/** Membership proves official identity. A title only assigns an ACT after that proof. */
function nwm_act_build(array $playlist,array $items,array $videos):array{
 if(($playlist['id']??'')!==NWM_ACT_PLAYLIST||($playlist['snippet']['channelId']??'')!==NWM_CHANNEL||($playlist['status']['privacyStatus']??'')!=='public')throw new DomainException('official_act_playlist_not_verified');
 $rows=[];$seen=[];$excluded=0;
 foreach($items as $item){
  $id=$item['video_id']??$item['contentDetails']['videoId']??null;
  if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)||isset($seen[$id]))continue;
  $seen[$id]=true;$v=$videos[$id]??null;
  if(!$v||($v['id']??'')!==$id||($v['snippet']['channelId']??'')!==NWM_CHANNEL||($v['status']['privacyStatus']??'')!=='public'||empty($v['status']['embeddable'])){$excluded++;continue;}
  $title=(string)($v['snippet']['title']??'');
  preg_match_all('/(?<![A-Za-z])ACT[.\s]*([0-9]+)(?![0-9])/iu',$title,$matches);
  $numbers=array_values(array_unique(array_map('intval',$matches[1])));
  $act=count($numbers)===1&&$numbers[0]>=1&&$numbers[0]<=4?$numbers[0]:null;
  $rows[]=['videoId'=>$id,'title'=>$title,'description'=>(string)($v['snippet']['description']??''),'act'=>$act,'position'=>(int)($item['position']??$item['snippet']['position']??0),'thumbnail'=>'/noa-bridge/youtube-thumbnail.php?id='.$id];
 }
 usort($rows,fn($a,$b)=>(($a['act']??PHP_INT_MAX)<=>($b['act']??PHP_INT_MAX))?:($a['position']<=>$b['position'])?:strcmp($a['videoId'],$b['videoId']));
 return ['playlistId'=>NWM_ACT_PLAYLIST,'videos'=>$rows,'excluded'=>$excluded,'unassigned'=>count(array_filter($rows,fn($v)=>$v['act']===null))];
}
function nwm_act_load(PDO $db,array $run,array $videos):array{
 if(($run['channel_id']??'')!==NWM_CHANNEL)throw new DomainException('channel_collection_required');
 $q=$db->prepare('SELECT payload FROM noa_youtube_playlists WHERE run_id=? AND playlist_id=?');$q->execute([$run['run_id'],NWM_ACT_PLAYLIST]);$raw=$q->fetchColumn();
 if(!is_string($raw))throw new DomainException('official_act_playlist_not_collected');
 $q=$db->prepare('SELECT video_id,position FROM noa_youtube_items WHERE run_id=? AND playlist_id=? ORDER BY position,item_id');$q->execute([$run['run_id'],NWM_ACT_PLAYLIST]);
 return nwm_act_build(json_decode($raw,true,512,JSON_THROW_ON_ERROR),$q->fetchAll(PDO::FETCH_ASSOC),$videos);
}
function nwm_episode(string $title):?int{
 if(preg_match('/EP[.\s]*\d+\s*(?:~|〜|–|-)\s*(?:EP[.\s]*)?\d+/iu',$title))return null;
 preg_match_all('/(?<![A-Za-z])EP[.\s]*([0-9]{1,3})(?![0-9])/iu',$title,$m);
 $eps=array_unique(array_map('intval',$m[1]));return count($eps)===1&&$eps[0]>0?$eps[0]:null;
}
function nwm_build(array $playlist,array $items,array $videos,array $songs=[],array $songActs=[]):array{
 if(($playlist['id']??'')!==NWM_PLAYLIST||($playlist['snippet']['channelId']??'')!==NWM_CHANNEL||($playlist['status']['privacyStatus']??'')!=='public')throw new DomainException('official_playlist_not_verified');
 $rows=[];$seen=[];$excluded=0;$duplicate=0;$epMatched=0;$catalogMatched=0;$conflicts=0;
 foreach($items as $item){$id=$item['video_id']??$item['contentDetails']['videoId']??null;
  if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)){$excluded++;continue;}
  if(isset($seen[$id])){$duplicate++;continue;}$seen[$id]=true;$v=$videos[$id]??null;
  if(!$v||($v['id']??'')!==$id||($v['snippet']['channelId']??'')!==NWM_CHANNEL||($v['status']['privacyStatus']??'')!=='public'||empty($v['status']['embeddable'])){$excluded++;continue;}
  $title=(string)($v['snippet']['title']??'');$ep=nwm_episode($title);$sid=$v['match']['songId']??null;$song=$songs[$sid??'']??null;$linked=$song&&(!empty($song['public_verified'])||($v['match']['status']??'')==='auto_confirmed')&&empty($song['owner_id'])&&($v['match']['status']??'')!=='rejected';
  $conflict=$linked&&$ep!==null&&!empty($song['ep'])&&(int)$song['ep']!==$ep;
  if($conflict){$conflicts++;$linked=false;}
  if($ep===null&&$linked&&!empty($song['ep']))$ep=(int)$song['ep'];
  if($ep!==null)$epMatched++;if($linked)$catalogMatched++;
  $rows[]=['videoId'=>$id,'title'=>$title,'description'=>(string)($v['snippet']['description']??''),'ep'=>$ep,'storyAct'=>$ep!==null?(int)ceil($ep/10):null,'songId'=>$linked?$sid:null,'categories'=>$v['sqlCategories']??[],'catalogActs'=>$linked?($songActs[$sid]??[]):[],'conflict'=>$conflict,'position'=>(int)($item['position']??$item['snippet']['position']??0),'thumbnail'=>'/noa-bridge/youtube-thumbnail.php?id='.$id];
 }
 usort($rows,fn($a,$b)=>(($a['ep']??PHP_INT_MAX)<=>($b['ep']??PHP_INT_MAX))?:($a['position']<=>$b['position'])?:strcmp($a['videoId'],$b['videoId']));
 return ['playlistId'=>NWM_PLAYLIST,'playlistTitle'=>(string)($playlist['snippet']['title']??''),'playlistUrl'=>'https://www.youtube.com/playlist?list='.NWM_PLAYLIST,'reportedItemCount'=>isset($playlist['contentDetails']['itemCount'])?(int)$playlist['contentDetails']['itemCount']:null,'counts'=>['collectedEntries'=>count($items),'distinctVideoIds'=>count($seen),'duplicatesExcluded'=>$duplicate,'unavailableExcluded'=>$excluded,'displayed'=>count($rows),'epMatched'=>$epMatched,'epMissing'=>count($rows)-$epMatched,'catalogMatched'=>$catalogMatched,'catalogUnmatched'=>count($rows)-$catalogMatched,'conflictReview'=>$conflicts],'videos'=>$rows];
}
function nwm_load(PDO $db,array $songs):array{
 $run=ny_latest($db);if(!$run||$run['channel_id']!==NWM_CHANNEL)throw new DomainException('channel_collection_required');
 $q=$db->prepare('SELECT payload FROM noa_youtube_playlists WHERE run_id=? AND playlist_id=?');$q->execute([$run['run_id'],NWM_PLAYLIST]);$p=$q->fetchColumn();if(!$p)throw new DomainException('official_playlist_not_collected');
 $q=$db->prepare('SELECT video_id,position FROM noa_youtube_items WHERE run_id=? AND playlist_id=? ORDER BY position,item_id');$q->execute([$run['run_id'],NWM_PLAYLIST]);$items=$q->fetchAll(PDO::FETCH_ASSOC);
 $acts=[];$q=$db->prepare("SELECT DISTINCT t.song_id,a.act_id,a.act_number,a.genre_id FROM noa_catalog_tracks t JOIN noa_catalog_acts a ON a.act_id=t.playlist_id JOIN noa_catalog_playlists p ON p.playlist_id=a.act_id JOIN noa_catalog_versions v ON v.entity_id=a.act_id AND v.entity_type='playlist' AND v.batch_id=t.batch_id WHERE t.batch_id=? AND v.public_verified=1 AND p.owner_id IS NULL");$q->execute([ny_batch($db)]);foreach($q as $a)$acts[$a['song_id']][]=['id'=>$a['act_id'],'number'=>(int)$a['act_number'],'genre'=>$a['genre_id']];
 $videoIndex=ny_videos($db,$run);$data=nwm_build(json_decode($p,true,512,JSON_THROW_ON_ERROR),$items,$videoIndex,$songs,$acts);try{$data['actCollection']=nwm_act_load($db,$run,$videoIndex);}catch(Throwable $e){$data['actCollection']=['videos'=>[],'unavailable'=>true];error_log('[noa-world-act-mv] '.get_class($e));}$report=json_decode($run['report'],true,512,JSON_THROW_ON_ERROR);$data['collectedAt']=$report['completedAt']??$run['created_at'];return $data;
}
