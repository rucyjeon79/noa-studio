<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}

/** N80 scene timing. Fades are in-place; only a crossfade overlaps clips. */
function mu_timeline(array $input):array {
 $seconds=[];
 foreach(['durationSeconds'=>null,'clipSeconds'=>8,'overlapSeconds'=>1,'fadeInSeconds'=>.5,'fadeOutSeconds'=>.5] as $key=>$default){
  $v=$input[$key]??$default;
  if(!is_numeric($v)||!is_finite((float)$v))throw new InvalidArgumentException('audio_duration_required');
  $seconds[$key]=(float)$v;
 }
 $d=(int)ceil($seconds['durationSeconds']*1000);$c=(int)round($seconds['clipSeconds']*1000);$o=(int)round($seconds['overlapSeconds']*1000);
 if($d<1||$d>3600000||$c<2000||$c>30000||$o<0||$o>$c/2||min($seconds['fadeInSeconds'],$seconds['fadeOutSeconds'])<0||max($seconds['fadeInSeconds'],$seconds['fadeOutSeconds'])>2)throw new InvalidArgumentException('invalid_scene_timing');
 $step=$c-$o;$count=max(1,(int)ceil(($d-$o)/$step));$scenes=[];
 for($i=0;$i<$count;$i++){
  $start=$i*$step;$end=min($d,$start+$c);$used=$end-$start;
  $scenes[]=['n'=>$i+1,'start'=>$start/1000,'end'=>$end/1000,'duration'=>$used/1000,'trimEnd'=>($c-$used)/1000,'overlapIn'=>$i?$o/1000:0,'fadeIn'=>$i===0?min($seconds['fadeInSeconds'],$used/2000):0,'fadeOut'=>$i===$count-1?min($seconds['fadeOutSeconds'],$used/2000):0];
 }
 return ['version'=>1,'durationSeconds'=>$d/1000,'clipSeconds'=>$c/1000,'overlapSeconds'=>$o/1000,'fadeInSeconds'=>$seconds['fadeInSeconds'],'fadeOutSeconds'=>$seconds['fadeOutSeconds'],'cutCount'=>$count,'scenes'=>$scenes];
}
function mu_expected_cuts(array $pack):int {return isset($pack['timing'])?mu_timeline($pack['timing'])['cutCount']:count($pack['cuts']??[]);}
function mu_chapter_range(array $pack,int $chapter):array {
 if($chapter<1||$chapter>3)throw new InvalidArgumentException('invalid_stage');
 $n=mu_expected_cuts($pack);$base=intdiv($n,3);$rest=$n%3;
 return ['start'=>($chapter-1)*$base+min($chapter-1,$rest),'count'=>$base+($chapter<=$rest?1:0)];
}
function mu_chapter_cuts(array $pack,int $chapter,?int $batch=null):array {
 $r=mu_chapter_range($pack,$chapter);$rows=array_slice($pack['cuts'],$r['start'],$r['count']);
 if($batch!==null){if($batch<0||$batch>=ceil($r['count']/5))throw new InvalidArgumentException('invalid_batch');$rows=array_slice($rows,$batch*5,5);}
 return $rows;
}
/** Current verified Jukebox asset; no scan, network call, new queue or guessed duration. */
function mu_asset_timing(PDO $db,string $key,string $suno):?array {
 $q=$db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=?');$q->execute([$key]);$a=$q->fetch(PDO::FETCH_ASSOC);
 if(!$a||!hash_equals((string)$a['source_url'],$suno)||!nj_verified($a,'audio'))return null;
 $probe=json_decode((string)($a['final_analysis']??''),true);
 if(!is_numeric($probe['duration']??null)||($probe['decode_errors']??true)!==false)return null;
 return ['durationSeconds'=>(float)$probe['duration'],'audioSha256'=>$a['audio_sha256']];
}
