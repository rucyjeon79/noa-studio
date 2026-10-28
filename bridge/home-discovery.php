<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
/** Read-only discovery, independent of immutable popularity ranks and member points. */
function nh_discovery_build(array $candidates,array $ranked,array $previous=[],?int $comparisonSeconds=null,?int $now=null):array{
 $now??=time();$metrics=[];foreach($ranked as $row)if(!empty($row['videoId']))$metrics[$row['videoId']]=$row;
 $popular=[];$rising=[];$new=[];
 foreach($candidates as $row){
  $id=$row['videoId'];$latestViews=$row['views'];$row=array_replace($row,$metrics[$id]??[]);$row['views']=$latestViews;$row['score']??=$latestViews;
  $row['recommendationKind']='popular';$row['recommendationLabel']='인기 음악';$popular[]=$row;
  $published=is_string($row['publishedAt']??null)?strtotime($row['publishedAt']):false;
  if($published!==false&&$published>0&&$published<=$now){$fresh=$row;$fresh['recommendationKind']='new';$fresh['recommendationLabel']='최근 공개';$new[]=$fresh;}
  // Only measured positive growth over comparable snapshots can be called rising.
  if($comparisonSeconds!==null&&$comparisonSeconds>=3600&&$comparisonSeconds<=259200&&isset($previous[$id])){
   $gain=(int)$row['views']-$previous[$id];if($gain>0){$up=$row;$up['viewGain']=$gain;$up['recommendationKind']='rising';$up['recommendationLabel']='조회수 상승';$rising[]=$up;}
  }
 }
 usort($popular,fn($a,$b)=>($b['score']<=>$a['score'])?:strcmp($a['videoId'],$b['videoId']));
 usort($rising,fn($a,$b)=>($b['viewGain']<=>$a['viewGain'])?:strcmp($a['videoId'],$b['videoId']));
 usort($new,fn($a,$b)=>(strtotime($b['publishedAt'])<=>strtotime($a['publishedAt']))?:strcmp($a['videoId'],$b['videoId']));
 $pools=['popular'=>$popular,'rising'=>$rising,'new'=>$new];$indices=array_fill_keys(array_keys($pools),0);$mixed=[];$seen=[];
 while(count($mixed)<8){$added=false;foreach(['popular','rising','new']as $type){while(isset($pools[$type][$indices[$type]])&&isset($seen[$pools[$type][$indices[$type]]['videoId']]))$indices[$type]++;if(!isset($pools[$type][$indices[$type]]))continue;$row=$pools[$type][$indices[$type]++];$mixed[]=$row;$seen[$row['videoId']]=true;$added=true;if(count($mixed)===8)break;}if(!$added)break;}
 return ['mixed'=>$mixed,'popular'=>array_slice($popular,0,8),'rising'=>array_slice($rising,0,8),'new'=>array_slice($new,0,8),'comparisonHours'=>$comparisonSeconds===null?null:round($comparisonSeconds/3600,1),'basis'=>'인기 점수 · 이전 수집 대비 조회수 증가 · 실제 공개일'];
}
function nh_discovery_load(PDO $db,array $run,array $data):array{
 $previous=[];$seconds=null;$at=strtotime($run['created_at'].' UTC');
 if($at!==false){
  // Pick the latest verified snapshot at least 24 hours earlier, bounded to 72 hours.
  $q=$db->prepare('SELECT run_id,created_at FROM noa_youtube_runs WHERE channel_id=? AND created_at<=? AND created_at>=? ORDER BY created_at DESC,run_id DESC LIMIT 1');
  $q->execute([$run['channel_id'],gmdate('Y-m-d H:i:s',$at-86400),gmdate('Y-m-d H:i:s',$at-259200)]);$old=$q->fetch(PDO::FETCH_ASSOC);
  if($old){$seconds=$at-strtotime($old['created_at'].' UTC');$q=$db->prepare('SELECT video_id,payload FROM noa_youtube_videos WHERE run_id=?');$q->execute([$old['run_id']]);foreach($q as $saved){$v=json_decode($saved['payload'],true,512,JSON_THROW_ON_ERROR);$views=nh_views($v['statistics']['viewCount']??null);if($views!==null&&nh_public($v,$run['channel_id'],true))$previous[$saved['video_id']]=$views;}}
 }
 $ranked=[];foreach(['featured','ep','stories','covers']as $section)foreach($data[$section]??[]as $row)$ranked[]=$row;
 return nh_discovery_build($data['discoveryCandidates']??[],$ranked,$previous,$seconds);
}
