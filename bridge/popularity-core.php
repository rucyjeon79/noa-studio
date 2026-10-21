<?php
declare(strict_types=1);
/** Pure aggregation. Canonical IDs and video IDs are independent identities. */
const NP_VERSION='integrated-v1';
const NP_CHANNEL='UCwYy9xsAqDFat6AV5UKrfgA';
const NP_STORIES='PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB';
const NP_COVERS='PLEPMKciKgvcjGmuO2ZcqrkHGfD5Qbb_Eb';
const NP_MV='PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY';
function np_add(int $a,int $b):int{if($a<0||$b<0||$a>PHP_INT_MAX-$b)throw new OverflowException('metric_overflow');return $a+$b;}
function np_movement(?int $previous,int $rank,bool $hasPrevious):array{
 if(!$hasPrevious)return ['previousRank'=>null,'rankDelta'=>null,'rankState'=>'unknown'];
 if($previous===null)return ['previousRank'=>null,'rankDelta'=>null,'rankState'=>'new'];
 $d=$previous-$rank;return ['previousRank'=>$previous,'rankDelta'=>$d,'rankState'=>$d>0?'up':($d<0?'down':'same')];
}
function np_order(array $rows):array{usort($rows,fn($a,$b)=>($b['score']<=>$a['score'])?:strcmp($a['contentId'],$b['contentId']));return $rows;}
/** Each aggregate uses sets, never sums preaggregated child/category scores. */
function np_metric(array $ids,array $videos,array $plays,array $extraSongs=[]):array{
 $yt=0;$songSet=array_fill_keys($extraSongs,true);$seen=[];foreach($ids as $id){if(isset($seen[$id])||!isset($videos[$id]))continue;$seen[$id]=true;$v=$videos[$id];$yt=np_add($yt,$v['youtubeViews']);if($v['songId'])$songSet[$v['songId']]=true;}
 $jp=0;foreach($songSet as $sid=>$_)$jp=np_add($jp,(int)($plays[$sid]??0));return ['youtubeViews'=>$yt,'jukeboxPlays'=>$jp,'score'=>np_add($yt,$jp),'countedVideos'=>count($seen),'countedSongs'=>count($songSet)];
}
function np_build(array $raw,array $songs,array $lists,array $membership,array $plays,array $categories,array $songCats):array{
 require_once __DIR__.'/home-core.php';$videos=[];$publicLists=[];$memberOf=[];
 foreach($lists as $p)if(nh_public($p,NP_CHANNEL)&&empty($p['systemUploads'])){$publicLists[$p['id']]=$p;foreach(array_unique($membership[$p['id']]??[])as $id)$memberOf[$id][$p['id']]=true;}
 foreach($raw as $v){$id=$v['id']??'';if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)||isset($videos[$id])||!nh_public($v,NP_CHANNEL,true)||($v['match']['status']??'')==='rejected')continue;
  $views=nh_views($v['statistics']['viewCount']??null);if($views===null)continue;$sid=$v['match']['songId']??null;if(!isset($songs[$sid??'']))$sid=null;$song=$songs[$sid??'']??[];
  $videos[$id]=['contentId'=>$id,'contentType'=>'video','videoId'=>$id,'songId'=>$sid,'title'=>(string)($v['snippet']['title']??''),'genre'=>$song['genre_id']??'unclassified','ep'=>$song['ep']??null,'categories'=>$v['sqlCategories']??[],'thumbnail'=>'/noa-bridge/youtube-thumbnail.php?id='.$id,'href'=>'/noa-youtube.php?track='.rawurlencode($id).'&play=1','youtubeViews'=>$views,'views'=>$views,'jukeboxPlays'=>$sid?(int)($plays[$sid]??0):0];$videos[$id]['score']=np_add($views,$videos[$id]['jukeboxPlays']);
 }
 $groups=array_fill_keys(['featured','ep','stories','covers','playlists','genres','genre_totals','collections','jukebox','mv','songs'],[]);$rankable=[];
 foreach($videos as $id=>$v){if($v['songId'])$rankable[]=$v;}
 $groups['featured']=array_slice(np_order($rankable),0,10);$excluded=array_fill_keys(array_column($groups['featured'],'videoId'),true);
 foreach($videos as $id=>$v){$continuous=nh_continuous($v['title']);
  if(!isset($excluded[$id])&&!$continuous){if($v['songId']&&(int)$v['ep']>0)$groups['ep'][]=$v;if(isset($memberOf[$id][NP_STORIES]))$groups['stories'][]=$v;if(isset($memberOf[$id][NP_COVERS])&&in_array('cover-reborn',$v['categories'],true))$groups['covers'][]=$v;}
  if(isset($memberOf[$id][NP_MV]))$groups['mv'][]=$v;
  if($continuous)$groups['playlists'][]=$v+['scoreKind'=>'single_video_plus_unique_song_plays'];
 }
 foreach($publicLists as $id=>$p){if(!nh_continuous((string)($p['snippet']['title']??'')))continue;$ids=array_values(array_filter(array_unique($membership[$id]??[]),fn($v)=>isset($videos[$v])));if(!$ids)continue;$first=$videos[$ids[0]];$m=np_metric($ids,$videos,$plays);$groups['playlists'][]=['contentId'=>$id,'contentType'=>'youtube_playlist','playlistId'=>$id,'title'=>$p['snippet']['title'],'videoId'=>$first['videoId'],'thumbnail'=>$first['thumbnail'],'href'=>'/noa-youtube.php?playlist='.rawurlencode($id),'scoreKind'=>'unique_public_member_video_views_plus_unique_song_plays']+$m;}
 $bySong=[];$byGenre=[];foreach($videos as $id=>$v){if($v['songId'])$bySong[$v['songId']][]=$id;if($v['genre']!=='unclassified')$byGenre[$v['genre']][]=$id;}
 $map=array_column($categories,null,'category_id');$categorySongs=[];$collectionGenres=[];
 foreach($songCats as $sid=>$cats)foreach($cats as $cat){$seen=[];while(isset($map[$cat])&&!isset($seen[$cat])){$seen[$cat]=true;$categorySongs[$cat][$sid]=true;if($cat==='collection'&&isset($songs[$sid]))$collectionGenres[$songs[$sid]['genre_id']]=true;$cat=$map[$cat]['parent_id'];if($cat===null)break;}}
 foreach($plays as $sid=>$n)if($n>0&&isset($songs[$sid]))$byGenre[$songs[$sid]['genre_id']]??=[];
 foreach($byGenre as $id=>$ids){$sids=[];foreach($songs as $sid=>$s)if($s['genre_id']===$id)$sids[]=$sid;$m=np_metric($ids,$videos,$plays,$sids);$group=isset($collectionGenres[$id])?'collections':'genres';$row=['contentId'=>$id,'contentType'=>'genre','title'=>np_genre_titles()[$id]??$id,'genre'=>$id,'genreFamily'=>$group==='collections'?'collection':(str_ends_with($id,'-original')?'original':'special'),'href'=>'/noa-music.php?genre='.rawurlencode($id)]+$m;$groups['genre_totals'][]=$row;if($group==='collections'||str_ends_with($id,'-original'))$groups[$group][]=$row;}
 foreach($songs as $sid=>$s){$ids=$bySong[$sid]??[];$jp=(int)($plays[$sid]??0);if(!$ids&&!$jp)continue;$m=np_metric($ids,$videos,$plays,[$sid]);$first=$ids?np_order(array_map(fn($id)=>$videos[$id],$ids))[0]:null;$row=['contentId'=>$sid,'contentType'=>'song','songId'=>$sid,'title'=>($s['fields']['confirmedTitle']??'')?:($s['fields']['title']??$s['title']??$sid),'genre'=>$s['genre_id'],'ep'=>$s['ep']??null,'videoId'=>$first['videoId']??null,'thumbnail'=>$first['thumbnail']??null,'href'=>$first['href']??'/noa-music.php','youtubeVideoIds'=>$ids]+$m;$groups['songs'][]=$row;if($jp)$groups['jukebox'][]=$row;}
 foreach($groups as $type=>&$rows){$rows=np_order($rows);if(in_array($type,['ep','stories','covers'],true))$rows=array_slice($rows,0,10);}unset($rows);
 return ['groups'=>$groups,'totals'=>np_metric(array_keys($videos),$videos,$plays,array_keys($plays)),'missingViewCountExcluded'=>count($raw)-count($videos)];
}

/** Existing public genre labels; no category/genre reassignment. */
function np_genre_titles():array{return ['kpop-original'=>'K-POP Original','jpop-original'=>'J-POP Original','pop-original'=>'POP Original','thai-original'=>'Thai Original','joseon-ballad'=>'Joseon Ballad','echoes-of-joseon'=>'Echoes of Joseon','groovy-airy-pop'=>'Groovy Airy Pop','narrative-piano-indie'=>'Narrative Piano Indie','dreamy-deep-house'=>'Dreamy Deep House','fantasy-ambient-edm'=>'Fantasy Ambient EDM','edm-kpop-club'=>'EDM K-POP Club','latin-afrobeats-edm'=>'Latin Afrobeats EDM','panpop'=>'PANPOP','your-story'=>'당신의 이야기, 우리의 음악','cover-reborn'=>'AInoa의 유명곡 커버'];}
