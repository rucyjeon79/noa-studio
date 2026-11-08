<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/session-shorts.php';

/** Preparation runs under the existing worker and campaign; no second queue or timer. */
function nd_prepare_claim(array &$s,array $p,int $now):array {
 $c=&$s['campaigns']['daily_shorts'];
 if(empty($c['enabled'])||empty($s['config']['workerEnabled']))return ['ok'=>true,'claimed'=>false,'state'=>'paused'];
 $local=(new DateTimeImmutable('@'.$now))->setTimezone(new DateTimeZone($p['timezone']));
 $target=$local->setTime(12,0);if($local>=$target)$target=$target->modify('+1 day');$date=$target->format('Y-m-d');
 $a=$c['preparation']??null;
 if($a&&($a['leaseUntil']??0)>$now)return ['ok'=>true,'claimed'=>false,'state'=>'preparing'];
 if($a&&$a['date']===$date&&$a['state']==='analyzed')return ['ok'=>true,'claimed'=>false,'state'=>'analyzed'];
 // Bootstrap once immediately; following dates use the established morning preparation time.
 if($a&&$a['date']!==$date&&$local<$target->setTime(8,0))return ['ok'=>true,'claimed'=>false,'state'=>'waiting_schedule'];
 // Reauthorization is a new dependency version, so the existing worker can
 // resume without requiring this conversation or another manual reset.
 $connection=hash('sha256',(string)($s['channels'][$p['channelId']]['tokens']??''));
 $same=$a&&$a['date']===$date&&($a['protocolVersion']??1)===2&&($a['connectionReceipt']??'')===$connection;
 if($same&&($a['attempts']??0)>=3)return ['ok'=>true,'claimed'=>false,'state'=>'preparation_retry_limit'];
 $a=['protocolVersion'=>2,'connectionReceipt'=>$connection,'date'=>$date,'publishAt'=>$target->format(DATE_ATOM),'state'=>'preparing','attempts'=>$same?$a['attempts']+1:1,
  'lease'=>bin2hex(random_bytes(24)),'leaseUntil'=>$now+1800,'startedAt'=>gmdate('c',$now),'sources'=>[],
  'report'=>$same?($a['report']??null):null];
 $c['preparation']=$a;
 return ['ok'=>true,'claimed'=>true,'lease'=>$a['lease'],'date'=>$date,'publishAt'=>$a['publishAt'],'policy'=>$p];
}
function nd_prepare_authorize(array $s,array $b,int $now):array {
 $c=$s['campaigns']['daily_shorts']??[];$a=$c['preparation']??[];
 if(empty($c['enabled'])||empty($s['config']['workerEnabled']))throw new DomainException('daily_shorts_paused');
 if(($a['state']??'')!=='preparing'||($a['leaseUntil']??0)<=$now||!is_string($b['lease']??null)||!hash_equals($a['lease']??'',$b['lease']))throw new DomainException('preparation_lease_expired');
 return $a;
}
function nd_prepare_catalog():array {
 require_once __DIR__.'/storage.php';require_once __DIR__.'/youtube-store.php';
 require_once __DIR__.'/youtube-catalog.php';require_once __DIR__.'/inline-edit.php';
 $db=noa_bridge_pdo();$rows=ny_listener_catalog($db,false,nie_overrides($db));
 $out=[];foreach($rows as $r){if($r['kind']==='playlist'||!$r['canonicalVideo'])continue;
  $out[]=array_intersect_key($r,array_flip(['key','title','genre','ep','canonicalVideo']));}
 return $out;
}
/** A fixed read-only YouTube surface. OAuth secrets never leave the hosting server. */
function nd_prepare_youtube_query(array $b,array $p):array {
 $kind=$b['resource']??'';$page=$b['pageToken']??'';
 if(!is_string($page)||strlen($page)>1024)throw new InvalidArgumentException('invalid_page_token');
 if($kind==='playlists')return ['playlists',['part'=>'id,snippet,contentDetails','channelId'=>$p['channelId'],'maxResults'=>50,'pageToken'=>$page]];
 if($kind==='playlistItems'){
  $id=$b['playlistId']??'';if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{10,100}$/D',$id))throw new InvalidArgumentException('invalid_playlist_id');
  return ['playlistItems',['part'=>'contentDetails,snippet','playlistId'=>$id,'maxResults'=>50,'pageToken'=>$page]];
 }
 $ids=$b['ids']??[];
 if(!is_array($ids)||!array_is_list($ids)||!count($ids)||count($ids)>50)throw new InvalidArgumentException('invalid_video_ids');
 foreach($ids as $id)if(!is_string($id)||!preg_match('/^[A-Za-z0-9_-]{11}$/D',$id))throw new InvalidArgumentException('invalid_video_id');
 if($kind==='videos')return ['videos',['part'=>'id,snippet,status,contentDetails,statistics,fileDetails','id'=>implode(',',$ids),'maxResults'=>50]];
 if($kind==='analytics')return ['analytics',['ids'=>'channel=='.$p['channelId'],'startDate'=>gmdate('Y-m-d',time()-31*86400),'endDate'=>gmdate('Y-m-d',time()-86400),
  'filters'=>'video=='.implode(',',$ids),'dimensions'=>'video','metrics'=>'views,averageViewDuration,averageViewPercentage,likes,comments,shares','maxResults'=>50]];
 throw new InvalidArgumentException('unsupported_read_resource');
}
function nd_prepare_report(array $report,array $sources):array {
 if(strlen(json_encode($report,JSON_THROW_ON_ERROR))>180000||!is_array($report['candidates']??null)||count($report['candidates'])<3||count($report['candidates'])>3)throw new InvalidArgumentException('three_analyzed_candidates_required');
 $seen=[];
 foreach($report['candidates'] as $r){
  $key=$r['trackKey']??'';$source=$sources[$key]??null;
  if(!$source||isset($seen[$key])||($r['sourceRevision']??null)!==$source['revision']||($r['audioSha256']??'')!==$source['audioSha256']||($r['videoId']??'')!==$source['videoId'])throw new DomainException('analysis_source_mismatch');
  $seen[$key]=true;$a=$r['audioAnalysis']??[];
  if(!is_numeric($a['duration']??null)||abs((float)$a['duration']-$source['duration'])>.25||empty($a['candidates'])||count($a['candidates'])>4||($a['alignmentVerified']??null)!==false)throw new DomainException('analysis_not_verified');
  foreach($a['candidates'] as $w){
   foreach(['start','end','score'] as $f)if(!is_numeric($w[$f]??null)||!is_finite((float)$w[$f]))throw new DomainException('invalid_measured_window');
   $len=$w['end']-$w['start'];if($w['start']<0||$w['end']>$a['duration']+.001||$len<48.999||$len>59.001)throw new DomainException('invalid_measured_window');
  }
 }
 // Measured candidates are preparation, never an accepted movie or a claimed publication.
 $report['state']='analyzed';$report['publicationReady']=false;$report['audioListeningReviewed']=false;
 return $report;
}
function nd_prepare_dispatch(array $b,array $p):array {
 $command=$b['command']??'';
 if($command==='claim_preparation')return lab_lock(fn(&$s)=>nd_prepare_claim($s,$p,time()));
 $state=lab_read();$a=nd_prepare_authorize($state,$b,time());
 if($command==='catalog')return ['ok'=>true,'items'=>nd_prepare_catalog()];
 if($command==='youtube'){
  require_once __DIR__.'/youtube-store.php';[$method,$query]=nd_prepare_youtube_query($b,$p);
  // Hosting replaces HTTP error bodies. Return a bounded, explicit failure receipt
  // through the already authenticated operation; never expose Google's raw body.
  $stage='token_refresh';
  try{$token=ny_token($state,$p['channelId']);$stage='youtube_read';$data=ny_get($token,$method,$query);}
  catch(Throwable $e){
   $reason='youtube_dependency_failed';$status=0;
   if($e instanceof NoaOAuthFailure){$reason=$e->reason;$status=$e->remoteStatus;}
   elseif($e instanceof DomainException){
    if(preg_match('/^youtube_[a-z_]{1,70}$/D',$e->getMessage()))$reason=$e->getMessage();
    elseif(preg_match('/^Google API HTTP (\d+) \/ ([A-Za-z_]{1,64})/',$e->getMessage(),$m)){$status=(int)$m[1];$reason=$m[2];}
   }
   if(!preg_match('/^[A-Za-z0-9_.-]{1,80}$/D',$reason))$reason='youtube_dependency_failed';
   return ['ok'=>true,'dependencyOk'=>false,'reason'=>'youtube_dependency_failed','diagnostic'=>['providerStage'=>$stage,'providerReason'=>$reason,'providerStatus'=>$status,'errorType'=>get_class($e)]];
  }
  if($method==='playlists'){
   require_once __DIR__.'/taxonomy-core.php';
   foreach($data['items'] as &$item){$title=$item['snippet']['title']??'';$genres=nt_declared_genres($title);
    if(count($genres)===1&&$genres[0]!=='kpop-original'&&!preg_match('/shorts|쇼츠|\\bACT\\b|전체|모음|연속|continuous|full\\s*album/iu',$title))$item['n80Genre']=$genres[0];
   }unset($item);
  }
  return ['ok'=>true,'data'=>$data];
 }
 if($command==='source'){
  require_once __DIR__.'/session-agent.php';$key=$b['trackKey']??'';$video=$b['videoId']??'';
  $matching=array_values(array_filter(nd_prepare_catalog(),fn($r)=>$r['key']===$key&&$r['canonicalVideo']===$video));
  if(count($matching)!==1||$matching[0]['genre']==='kpop-original')throw new DomainException('source_video_mismatch');
  $source=sa_source($key);$source['videoId']=$video;
  lab_lock(function(&$s)use($b,$source){nd_prepare_authorize($s,$b,time());$a=&$s['campaigns']['daily_shorts']['preparation'];
   if(count($a['sources'])>=10&&!isset($a['sources'][$source['key']]))throw new DomainException('source_attempt_limit');
   $safe=$source;unset($safe['audioPath'],$safe['lyrics'],$safe['imageGuidance'],$safe['description']);$a['sources'][$source['key']]=$safe;});
  return ['ok'=>true,'source'=>$source];
 }
 if($command==='complete_preparation'){
  $report=nd_prepare_report($b['report']??[],$a['sources']);
  require_once __DIR__.'/session-agent.php';foreach($report['candidates'] as $r){$source=sa_source($r['trackKey']);if($source['revision']!==$r['sourceRevision']||$source['audioSha256']!==$r['audioSha256'])throw new DomainException('source_changed_replan_required');}
  return lab_lock(function(&$s)use($b,$report){$a=nd_prepare_authorize($s,$b,time());$a['state']='analyzed';$a['report']=$report;$a['finishedAt']=gmdate('c');$a['lease']='';$a['leaseUntil']=0;$a['sources']=[];$s['campaigns']['daily_shorts']['preparation']=$a;lab_event($s,'daily_shorts_analyzed','','n80_auto');return ['ok'=>true,'state'=>'analyzed','candidateCount'=>count($report['candidates'])];});
 }
 if($command==='fail_preparation')return lab_lock(function(&$s)use($b){nd_prepare_authorize($s,$b,time());$a=&$s['campaigns']['daily_shorts']['preparation'];$a['state']='preparation_failed';$a['reason']=preg_match('/^[A-Za-z0-9_]{1,100}$/D',(string)($b['reason']??''))?$b['reason']:'preparation_failed';$d=$b['diagnostic']??[];if(is_array($d)&&strlen(json_encode($d))<4000)$a['diagnostic']=$d;$a['lease']='';$a['leaseUntil']=0;return ['ok'=>true,'state'=>$a['state']];});
 throw new InvalidArgumentException('unknown_preparation_command');
}
