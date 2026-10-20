<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
/** Read-model ranking only. Never infer song identity from a title. */
function nh_views(mixed $value):?int{
 if(is_int($value))return $value>=0?$value:null;
 if(!is_string($value)||!preg_match('/^(?:0|[1-9][0-9]{0,18})$/D',$value))return null;
 $number=filter_var($value,FILTER_VALIDATE_INT);return $number===false?null:$number;
}
function nh_build(array $videos,array $songs,array $playlists,array $members,string $channel):array{
 $genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];$ranked=[];$eligible=[];$playlistVideos=[];$missing=0;
 foreach($videos as $v){$id=$v['id']??'';$sid=$v['match']['songId']??null;$song=$songs[$sid??'']??null;
  if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)||($v['snippet']['channelId']??'')!==$channel||($v['status']['privacyStatus']??'')!=='public'||empty($v['status']['embeddable']))continue;
  $views=nh_views($v['statistics']['viewCount']??null);if($views===null){if($song)$missing++;continue;}
  $playlistVideos[$id]=['videoId'=>$id,'views'=>$views,'thumbnail'=>'/noa-bridge/youtube-thumbnail.php?id='.$id];
  if(!$song||($v['match']['status']??'')==='rejected')continue;
  $genre=$song['genre_id']??'';$row=['videoId'=>$id,'songId'=>$sid,'title'=>(string)($v['snippet']['title']??''),'genre'=>in_array($genre,$genres,true)?$genre:'unclassified','ep'=>$song['ep']??null,'language'=>$song['language']??'und','version'=>$song['version_name']??'','views'=>$views,'thumbnail'=>'/noa-bridge/youtube-thumbnail.php?id='.$id,'href'=>'/noa-youtube.php?track='.rawurlencode($id).'&play=1'];
  $eligible[$id]=$row;
 }
 $ranked=array_values($eligible);usort($ranked,fn($a,$b)=>($b['views']<=>$a['views'])?:strcmp($a['videoId'],$b['videoId']));
 $ep=[];foreach($ranked as $row)if(in_array($row['genre'],$genres,true)&&(int)$row['ep']>0&&!isset($ep[$row['genre']]))$ep[$row['genre']]=$row;
 $epRows=[];foreach($genres as $genre)if(isset($ep[$genre]))$epRows[]=$ep[$genre];
 $lists=[];foreach($playlists as $p){$id=$p['id']??'';$title=(string)($p['snippet']['title']??'');
  if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{10,100}$/D',$id)||!empty($p['systemUploads'])||($p['status']['privacyStatus']??'')!=='public'||($p['snippet']['channelId']??'')!==$channel||!preg_match('/연속\s*듣기|continuous\s*listening|連続再生/iu',$title))continue;
  $seen=[];$known=[];foreach($members[$id]??[] as $video){if(!is_string($video)||isset($seen[$video]))continue;$seen[$video]=true;if(isset($playlistVideos[$video]))$known[]=$playlistVideos[$video];}
  if(!$known)continue;$sum=0;foreach($known as $row){if($sum>PHP_INT_MAX-$row['views'])throw new OverflowException('playlist_score_overflow');$sum+=$row['views'];}
  $lists[]=['playlistId'=>$id,'title'=>$title,'score'=>$sum,'scoreKind'=>'sum_public_owner_member_video_views','countedVideos'=>count($known),'excludedVideos'=>count($seen)-count($known),'videoId'=>$known[0]['videoId'],'thumbnail'=>$known[0]['thumbnail'],'href'=>'/noa-youtube.php?playlist='.rawurlencode($id)];
 }
 usort($lists,fn($a,$b)=>($b['score']<=>$a['score'])?:strcmp($a['playlistId'],$b['playlistId']));
 return ['featured'=>array_slice($ranked,0,10),'ep'=>$epRows,'stories'=>array_slice(array_values(array_filter($ranked,fn($r)=>$r['genre']==='your-story')),0,10),'covers'=>array_slice(array_values(array_filter($ranked,fn($r)=>$r['genre']==='cover-reborn')),0,10),'playlists'=>array_slice($lists,0,10),'counts'=>['rankableVideos'=>count($ranked),'linkedPublicVideosWithoutViewCount'=>$missing,'epGenres'=>count($epRows),'continuousPlaylists'=>count($lists)],'basis'=>'public_embeddable_owner_videos_with_confirmed_song_link_and_recorded_view_count','playlistBasis'=>'해당 채널의 공개·재생 허용·조회수가 확인된 수록 영상의 누적 조회수 합산. 개별 곡 연결 여부와 관계없이 ACT 합본을 포함합니다. 같은 영상은 목록 안에서 한 번만 합산하며 공식 재생목록 조회수가 아닙니다.'];
}
