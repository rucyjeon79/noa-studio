<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
const NY_HANDLE='@ainoa_ramjunpapa';
function ny_video_id(string $url):?string{
 $p=parse_url($url);if(!is_array($p)||!in_array(strtolower($p['host']??''),['youtube.com','www.youtube.com','m.youtube.com','youtu.be'],true))return null;
 $path=$p['path']??'';$id=null;if(strtolower($p['host'])==='youtu.be')$id=trim($path,'/');elseif(preg_match('~^/(?:embed|shorts|live)/([^/]+)~',$path,$m))$id=$m[1];elseif($path==='/watch'){parse_str($p['query']??'',$q);$id=$q['v']??null;}
 return is_string($id)&&preg_match('/^[A-Za-z0-9_-]{11}$/D',$id)?$id:null;
}
function ny_suno_ids(string $text):array{preg_match_all('~https://(?:www[.])?suno[.]com/(?:song|s)/([A-Za-z0-9_-]+)~i',$text,$m);return array_values(array_unique($m[1]));}
function ny_normal(string $text):string{return mb_strtolower(preg_replace('/[\s\p{P}]+/u',' ',trim($text))??'');}
/** Only unique strong identifiers auto-link. Titles, EP/ACT, genres and versions are review evidence. */
function ny_match(array $video,array $songs):array{
 $strong=[];$candidates=[];$text=($video['snippet']['title']??'').'\n'.($video['snippet']['description']??'');$suno=ny_suno_ids($text);
 foreach($songs as $song){$f=$song['fields'];$reasons=[];foreach(['youtubeUrl','mvUrl'] as $key)if(ny_video_id((string)($f[$key]??''))===($video['id']??''))$reasons[]='existing_'.$key;
  if(array_intersect($suno,ny_suno_ids((string)($f['sunoShareUrl']??$f['sunoUrl']??''))))$reasons[]='exact_suno_id';
  // Stable NOA IDs must be explicitly labelled, never matched as arbitrary description substrings.
  if(preg_match('/\bNOA_SONG_ID\s*[:=]\s*'.preg_quote($song['song_id'],'/').'\b/i',$text))$reasons[]='explicit_noa_song_id';
  if($reasons)$strong[$song['song_id']]=$reasons;
  $title=ny_normal((string)($f['title']??''));if($reasons||$title!==''&&mb_strlen($title)>=3&&str_contains(ny_normal($text),$title))$candidates[]=['songId'=>$song['song_id'],'title'=>$f['title']??'','genre'=>$song['genre_id'],'ep'=>$song['ep'],'language'=>$song['language'],'version'=>$song['version_name'],'reasons'=>$reasons?:['title_only_review']];
 }
 return ['songId'=>count($strong)===1?array_key_first($strong):null,'status'=>count($strong)===1?'matched':(count($strong)>1?'conflict':'review'),'evidence'=>$strong,'candidates'=>$candidates];
}
function ny_page(array &$run,string $key,array $response):bool{
 $token=(string)($response['nextPageToken']??'');$run['pages']=($run['pages']??0)+1;
 if($token!==''&&isset($run['seenTokens'][$key][$token]))throw new DomainException('pagination_loop');
 if($token!=='')$run['seenTokens'][$key][$token]=true;$run['pageToken']=$token;return $token!=='';
}
function ny_rollup(array $metrics,array $ids):array{
 $out=['videos'=>0,'views'=>0,'estimatedMinutesWatched'=>0,'subscribersGained'=>0,'subscribersLost'=>0,'averageViewDuration'=>null,'averageViewPercentage'=>null];$duration=0;$percentage=0;$weight=0;
 foreach(array_unique($ids) as $id){if(!isset($metrics[$id]))continue;$m=$metrics[$id];$out['videos']++;foreach(['views','estimatedMinutesWatched','subscribersGained','subscribersLost'] as $key)$out[$key]+=(float)($m[$key]??0);$v=(float)($m['views']??0);$weight+=$v;$duration+=(float)($m['averageViewDuration']??0)*$v;$percentage+=(float)($m['averageViewPercentage']??0)*$v;}
 if($weight){$out['averageViewDuration']=$duration/$weight;$out['averageViewPercentage']=$percentage/$weight;}return $out;
}
