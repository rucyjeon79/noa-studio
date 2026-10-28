<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
/** Public read model only: category evidence never creates a canonical song link. */
function nh_views(mixed $value):?int{
 if(is_int($value))return $value>=0?$value:null;
 if(!is_string($value)||!preg_match('/^(?:0|[1-9][0-9]{0,18})$/D',$value))return null;
 $number=filter_var($value,FILTER_VALIDATE_INT);return $number===false?null:$number;
}
function nh_public(array $item,string $channel,bool $video=false):bool{
 return ($item['snippet']['channelId']??'')===$channel&&($item['status']['privacyStatus']??'')==='public'&&(!$video||!empty($item['status']['embeddable']));
}
function nh_continuous(string $title):bool{
 return (bool)preg_match('/연속\s*듣기|continuous\s*listening|連続再生|\bACT\s*\.?\s*\d+\b[^\r\n]*\bPlaylist\b/iu',$title);
}
function nh_build(array $videos,array $songs,array $playlists,array $members,string $channel):array{
 $genres=['kpop-original','jpop-original','pop-original','thai-original','joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop','your-story','cover-reborn'];
 $eligible=[];$playlistVideos=[];$sections=['stories'=>[],'covers'=>[]];$lists=[];$missing=0;
 $diagnostics=[];foreach(['stories','covers','playlists'] as $section)$diagnostics[$section]=['candidates'=>0,'rankable'=>0,'returned'=>0,'unlinkedRankable'=>0,'reasons'=>[]];
 $reason=function(string $section,string $name)use(&$diagnostics):void{$diagnostics[$section]['reasons'][$name]=($diagnostics[$section]['reasons'][$name]??0)+1;};
 // These are existing owner lists, verified against the collected catalog. Titles
 // also support a recreated list. Membership is classification, not song identity.
 $categoryMembers=[];$continuousMembers=[];$officialStoryMembers=[];
 foreach($playlists as $p){if(!nh_public($p,$channel)||!empty($p['systemUploads']))continue;
  $pid=(string)($p['id']??'');if($pid==='PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB')foreach($members[$pid]??[] as $memberId)if(is_string($memberId))$officialStoryMembers[$memberId]=true;$title=(string)($p['snippet']['title']??'');$genre=null;
  if($pid==='PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB'||preg_match('/당신의\s*이야기\s*,\s*우리의\s*음악/u',$title))$genre='your-story';
  if($pid==='PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb'||preg_match('/AInoa의\s*유명곡\s*커버/iu',$title))$genre='cover-reborn';
  foreach($members[$pid]??[] as $id){if(!is_string($id))continue;if($genre)$categoryMembers[$id][$genre]=true;if(nh_continuous($title))$continuousMembers[$id]=true;}
 }
 $linkedSongs=[];foreach($videos as $v)if(!empty($v['match']['songId'])&&($v['match']['status']??'')!=='rejected')$linkedSongs[$v['match']['songId']]=true;
 foreach(['stories'=>'your-story','covers'=>'cover-reborn'] as $section=>$g){$registered=array_filter($songs,fn($song)=>($song['genre_id']??'')===$g);$diagnostics[$section]['catalogSongs']=count($registered);$diagnostics[$section]['catalogSongsWithoutCollectedVideo']=count(array_diff_key($registered,$linkedSongs));}
 $seen=[];
 foreach($videos as $v){$id=$v['id']??'';if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)||isset($seen[$id]))continue;$seen[$id]=true;
  $sid=$v['match']['songId']??null;$song=$songs[$sid??'']??null;$genre=$song['genre_id']??'';$title=(string)($v['snippet']['title']??'');
  $compilation=nh_continuous($title)||(isset($continuousMembers[$id])&&preg_match('/\b(?:ACT|Vol)\s*\.?\s*\d+|[0-9]+\s*곡|몰아듣기|모음/iu',$title));
  $evidence=$categoryMembers[$id]??[];foreach($v['sqlCategories']??[] as $sqlCategory)if(in_array($sqlCategory,['your-story','cover-reborn'],true))$evidence[$sqlCategory]=true;if(!empty($v['sqlClassificationReady'])||($v['sqlCategorySource']??'')==='manual'){$evidence=array_fill_keys(array_intersect($v['sqlCategories']??[],['your-story','cover-reborn']),true);}
  if(empty($v['sqlClassificationReady'])&&($v['sqlCategorySource']??'')!=='manual'&&in_array($genre,['your-story','cover-reborn'],true))$evidence[$genre]=true;
  // Explicit labels are fallback evidence only. Generic "Cover", ACT, or a
  // translated POP Original / J-POP version do not establish a famous-song cover.
  if(empty($v['sqlClassificationReady'])&&($v['sqlCategorySource']??'')!=='manual'&&preg_match('/사연곡/u',$title))$evidence['your-story']=true;
  if(empty($v['sqlClassificationReady'])&&($v['sqlCategorySource']??'')!=='manual'&&preg_match('/\bCover\s+by\s+AInoa\b/iu',$title))$evidence['cover-reborn']=true;
  // The official story playlist is authoritative; stale genre/title/SQL evidence cannot admit outsiders.
  if(isset($officialStoryMembers[$id]))$evidence['your-story']=true;else unset($evidence['your-story']);
  $targets=[];foreach(['stories'=>'your-story','covers'=>'cover-reborn'] as $section=>$g)if(isset($evidence[$g])){$targets[]=$section;$diagnostics[$section]['candidates']++;}
  if($compilation)$diagnostics['playlists']['candidates']++;
  $failure=!nh_public($v,$channel,true)?'not_public_owner_embeddable':(($v['match']['status']??'')==='rejected'?'rejected_match':null);
  $views=nh_views($v['statistics']['viewCount']??null);if(!$failure&&$views===null){$failure='missing_view_count';if($song)$missing++;}
  if($failure){foreach($targets as $section)$reason($section,$failure);if($compilation)$reason('playlists',$failure);continue;}
  $row=['contentType'=>'video','videoId'=>$id,'songId'=>$song?$sid:null,'title'=>$title,'genre'=>in_array($genre,$genres,true)?$genre:'unclassified','ep'=>$song['ep']??null,'language'=>$song['language']??'und','version'=>$song['version_name']??'','publishedAt'=>$v['snippet']['publishedAt']??null,'views'=>$views,'thumbnail'=>'/noa-bridge/youtube-thumbnail.php?id='.$id,'href'=>'/noa-youtube.php?track='.rawurlencode($id).'&play=1'];
  $playlistVideos[$id]=$row;
  if($song)$eligible[$id]=$row;
  foreach($targets as $section){
   if($compilation){$reason($section,'compilation_in_playlist_chart');continue;}
   if(count($evidence)>1){$reason($section,'classification_conflict');continue;}
   $r=$row;$r['genre']=$section==='stories'?'your-story':'cover-reborn';$r['classificationSource']=$section==='stories'?'official_playlist_membership':($genre===$r['genre']?'canonical_genre':(isset($categoryMembers[$id][$r['genre']])?'owner_playlist_membership':'explicit_owner_video_title'));$sections[$section][]=$r;if(!$song)$diagnostics[$section]['unlinkedRankable']++;
  }
  if($compilation)$lists[]=$row+['score'=>$views,'scoreKind'=>'video_view_count','countedVideos'=>1,'excludedVideos'=>0];
 }
 $sort=fn($a,$b)=>($b['views']<=>$a['views'])?:strcmp($a['videoId'],$b['videoId']);$ranked=array_values($eligible);usort($ranked,$sort);
 $featured=array_slice($ranked,0,10);$excluded=array_fill_keys(array_column($featured,'videoId'),true);
 $epRows=array_slice(array_values(array_filter($ranked,fn($row)=>(int)$row['ep']>0&&!isset($excluded[$row['videoId']]))),0,10);
 foreach($playlists as $p){$id=$p['id']??'';$title=(string)($p['snippet']['title']??'');
  if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{10,100}$/D',$id)||!empty($p['systemUploads'])||!nh_continuous($title))continue;
  $diagnostics['playlists']['candidates']++;
  if(!nh_public($p,$channel)){$reason('playlists','not_public_owner_playlist');continue;}
  $seenMembers=[];$known=[];foreach($members[$id]??[] as $video){if(!is_string($video)||isset($seenMembers[$video]))continue;$seenMembers[$video]=true;if(isset($playlistVideos[$video]))$known[]=$playlistVideos[$video];}
  if(!$known){$reason('playlists',count($seenMembers)?'no_rankable_member_metrics':'no_collected_members');continue;}
  $sum=0;foreach($known as $row){if($sum>PHP_INT_MAX-$row['views'])throw new OverflowException('playlist_score_overflow');$sum+=$row['views'];}
  $lists[]=['contentType'=>'youtube_playlist','playlistId'=>$id,'title'=>$title,'score'=>$sum,'scoreKind'=>'sum_public_owner_member_video_views','countedVideos'=>count($known),'excludedVideos'=>count($seenMembers)-count($known),'videoId'=>$known[0]['videoId'],'thumbnail'=>$known[0]['thumbnail'],'href'=>'/noa-youtube.php?playlist='.rawurlencode($id)];
 }
 usort($lists,fn($a,$b)=>($b['score']<=>$a['score'])?:strcmp(($a['playlistId']??$a['videoId']),($b['playlistId']??$b['videoId'])));
 foreach($sections as $section=>&$rows){usort($rows,$sort);$diagnostics[$section]['rankable']=count($rows);$rows=array_slice(array_values(array_filter($rows,fn($row)=>!isset($excluded[$row['videoId']]))),0,10);$diagnostics[$section]['returned']=count($rows);}unset($rows);
 $diagnostics['playlists']['rankable']=count($lists);$diagnostics['playlists']['returned']=min(10,count($lists));
 foreach($diagnostics as &$d)$d['emptyReason']=$d['returned']?null:($d['candidates']?'all_candidates_excluded':(!empty($d['catalogSongs'])?'catalog_video_mapping_missing':(!$videos?'no_registered_or_collected_data':'no_category_evidence')));unset($d);
 $genreFeatured=[];foreach($genres as $g)$genreFeatured[$g]=array_slice(array_values(array_filter($ranked,fn($r)=>$r['genre']===$g)),0,4);
 return ['discoveryCandidates'=>$ranked,'genreFeatured'=>$genreFeatured,'featured'=>$featured,'ep'=>$epRows,'stories'=>$sections['stories'],'covers'=>$sections['covers'],'playlists'=>array_slice($lists,0,10),'diagnostics'=>$diagnostics,'counts'=>['rankableVideos'=>count($ranked),'linkedPublicVideosWithoutViewCount'=>$missing,'epGenres'=>count(array_unique(array_column($epRows,'genre'))),'continuousPlaylists'=>count($lists)],'basis'=>'public_embeddable_owner_videos_with_confirmed_song_link_and_recorded_view_count','categoryBasis'=>'사연곡은 공식 사연곡 재생목록 소속 영상으로 선정합니다. 추천 음악과 겹치는 영상은 EP·사연곡·커버곡 순위에서 제외하고 다음 후보를 보충합니다.','playlistBasis'=>'공식 목록은 확인된 공개 수록 영상 조회수 합계, 연속듣기 단일 영상은 해당 영상 조회수로 정렬합니다. 서로 다른 지표이며 공식 재생목록 조회수가 아닙니다. 중복 수록은 한 번 집계하고 미확인 조회수는 제외합니다.'];
}
