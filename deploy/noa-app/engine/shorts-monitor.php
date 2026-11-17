<?php
declare(strict_types=1);
require_once __DIR__.'/hub.php';

/** Observe the existing clock and media store. Never generate media or issue AI requests here. */
function n80_shorts_monitor_snapshot(array $hub,array $lab,array $trial,string $owner,int $now):array {
 $checks=$trial['readOnlyChecks']??[];
 if(!isset($trial['id'],$trial['requestedAt']))$trial=[];
 $operation=null;foreach($hub['operations']??[] as $op)if(($op['id']??'')==='ai.daily_shorts_clock'){$operation=$op;break;}
 $receipt=$trial['receipt']??($operation['last']??null);$campaign=$lab['campaigns']['daily_shorts']??[];
 $j=$lab['jobs'][$campaign['current']['jobId']??'']??null;
 if($j&&($j['agent']['owner']??'')!==$owner)$j=null;
 $job=null;
 if($j){
  $a=$j['agent'];$scenes=$a['scenes']??[];
  $images=count(array_filter($scenes,fn($s)=>!empty($s['image']['accepted'])));
  $videos=count(array_filter($scenes,fn($s)=>!empty($s['video']['accepted'])));
  $blocked=null;foreach($scenes as $scene)foreach(['image','video'] as $kind)if(empty($scene[$kind]['accepted'])){
   $attempts=(int)($a['attempts'][$kind.':'.$scene['n']]??0);
   $limit=max(3,min(6,(int)($a['retryLimits'][$kind.':'.$scene['n']]??3)));
   if($attempts>=$limit)$blocked=['scene'=>$scene['n'],'kind'=>$kind,'attempts'=>$attempts,'maxAttempts'=>$limit];
   break 2;
  }
  $job=['id'=>$j['id'],'title'=>$j['title'],'state'=>$j['state'],'updatedAt'=>$j['updatedAt'],
   'scenes'=>(int)($a['target']??0),'planned'=>count($scenes),'images'=>$images,'videos'=>$videos,
   'finals'=>count($j['outputs']??[]),'subtitles'=>$a['subtitles']['status']??'pending','retryBlock'=>$blocked,
   'duration'=>isset($a['selection'])?round($a['selection']['end']-$a['selection']['start'],3):null,'controller'=>$a['controller']??null];
 }
 $matching=$trial&&$receipt&&($receipt['id']??'')!==($trial['priorReceiptId']??'')&&($receipt['startedAt']??0)>=($trial['requestedAt']??PHP_INT_MAX);
 $state='not_started';
 if($trial)$state=$matching?($receipt['state']==='running'?'checking':($receipt['state']==='failed'?'check_failed':(($receipt['outcome']['productionReady']??false)?'readiness_passed':'blocked_before_production'))):'requested';
 if(($trial['owner']??$owner)!==$owner){$trial=[];$state='not_started';$matching=false;}
 $moduleCheck=null;
 foreach($checks as $check)if(is_array($check)&&($check['owner']??null)===$owner)
  $moduleCheck=array_intersect_key($check,array_flip(['id','requestedAt','finishedAt','state','elapsedMs','clockState','sourceRevision','businessStateWritten','providerCalls','productionVerified','error','missing','nextPreparationAt','nextPublicationAt']));
 $activeJob=$job&&!in_array($job['state'],['cancelled','failed','completed','published'],true)&&!empty($job['controller']['enabled']);
 return ['ok'=>true,'checkedAt'=>$now,'heartbeatAt'=>$hub['heartbeatAt']??0,'runnerState'=>$hub['runnerState']??'not_verified','paused'=>!empty($hub['paused']),
  'moduleCheck'=>$moduleCheck,'needsPolling'=>(bool)$activeJob,
  'trial'=>$trial?['id'=>$trial['id'],'requestedAt'=>$trial['requestedAt'],'state'=>$state]:null,
  'receipt'=>$receipt,'trialReceiptMatched'=>$matching,'job'=>$job,
  'campaign'=>array_intersect_key($campaign,array_flip(['state','lastTickAt','nextPreparationAt','nextPublicationAt','readiness','productionReady'])),
  // The deployed worker only calls nd_shorts_tick: there is no outgoing ChatGPT transport.
  'chatgpt'=>['state'=>!empty($j['agent']['controller']['enabled'])?'active_receiver':'not_started','request'=>$j['agent']['controller']['request']??null,'automaticWakeVerified'=>false],
  'scope'=>'existing_clock_read_only_check'];
}

/** Read-only observation. Preserve retired trial evidence without writing on GET. */
function n80_shorts_monitor_observe(string $root):array {
 $hub=n80_hub_status($root);$trial=n80_hub_read($root,'shorts-trial.json');
 return compact('hub','trial');
}

/** Explicit administrator POST: one read-only specialist call, never a wake request. */
function n80_shorts_monitor_start(string $root,string $owner,string $requestId):array {
 if($owner===''||!preg_match('/^[a-f0-9]{32}$/D',$requestId))throw new DomainException('invalid_trial_id');
 $claim=n80_hub_locked($root,function()use($root,$owner,$requestId){
  $control=n80_hub_read($root,'control.json');
  if(($control['paused']??null)!==true||($control['stop']??null)!==true)throw new DomainException('clock_check_requires_retired_runner');
  $old=n80_hub_read($root,'shorts-trial.json');
  $checks=$old['readOnlyChecks']??[];
  if(!is_array($checks))throw new DomainException('clock_check_store_invalid');
  if(isset($checks[$requestId])){
   if(($checks[$requestId]['owner']??null)!==$owner)throw new DomainException('clock_check_owner_mismatch');
   return ['new'=>false,'record'=>$checks[$requestId]];
  }
  if(count($checks)>=32)throw new DomainException('clock_check_history_full');
  foreach($checks as $check){
   if(!is_array($check)||!in_array($check['state']??null,['checked','check_failed'],true))throw new DomainException('clock_check_unconfirmed');
   if(($check['requestedAt']??0)>time()-30)throw new DomainException('trial_recently_requested');
  }
  $record=['id'=>$requestId,'owner'=>$owner,'requestedAt'=>time(),'state'=>'checking',
   'scope'=>'existing_clock_on_snapshot','productionVerified'=>false];
  $old['readOnlyChecks'][$requestId]=$record;n80_hub_write($root,'shorts-trial.json',$old);
  return ['new'=>true,'record'=>$record];
 });
 if(!$claim['new'])return $claim['record'];
 $start=hrtime(true);$summary=['state'=>'check_failed','error'=>'clock_check_failed','productionVerified'=>false];
 try{
  require_once __DIR__.'/service-runtime.php';
  $r=n80_service_execute('n80_daily_shorts_tick',[],['authenticatedByServer'=>true,
   'principal'=>'n80_lab_worker','permissions'=>['media:worker'],'method'=>'POST','admin'=>$owner,
   'hostOperation'=>'ai.daily_shorts_clock','readOnlyClockCheck'=>true]);
  $check=$r['readOnlyCheck']??[];
  if(($r['ok']??null)!==true||($r['processed']??null)!==0||($r['uploads']??null)!==0
   ||($r['runtime']['module']??null)!=='lab'||($r['runtime']['operation']??null)!=='n80_daily_shorts_tick'
   ||($check['scope']??null)!=='existing_clock_on_snapshot'||($check['businessStateWritten']??null)!==false
   ||($check['providerCalls']??null)!==0||($check['productionVerified']??null)!==false
   ||!is_int($check['sourceRevision']??null)||$check['sourceRevision']<0
   ||!in_array($r['state']??null,['paused','connection_required','waiting_schedule','ready'],true))throw new RuntimeException('clock_check_result_invalid');
  $summary=['state'=>'checked','clockState'=>$r['state'],'sourceRevision'=>$check['sourceRevision'],
   'businessStateWritten'=>false,'providerCalls'=>0,'productionVerified'=>false];
  $allowed=['persistent_browser_executor_required','chatgpt_unattended_dispatch_not_verified',
   'google_drive_authorization_required','google_drive_readback_verification_required',
   'youtube_offline_connection_required','youtube_auto_publication_not_enabled','youtube_related_video_adapter_not_verified'];
  $summary['missing']=array_values(array_intersect($allowed,$r['campaign']['readiness']['missing']??[]));
  foreach(['nextPreparationAt','nextPublicationAt'] as $field){
   $date=$r['campaign'][$field]??null;
   if(is_string($date)&&preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+]09:00$/D',$date))$summary[$field]=$date;
  }
 }catch(Throwable $e){
  if($e->getMessage()==='storage_busy')$summary['error']='clock_check_storage_busy';
 }
 $summary['elapsedMs']=round((hrtime(true)-$start)/1000000,3);$summary['finishedAt']=time();
 return n80_hub_locked($root,function()use($root,$requestId,$owner,$summary):array {
  $old=n80_hub_read($root,'shorts-trial.json');$record=$old['readOnlyChecks'][$requestId]??[];
  if(($record['owner']??null)!==$owner||($record['state']??null)!=='checking')throw new DomainException('clock_check_receipt_conflict');
  $record=array_replace($record,$summary);$old['readOnlyChecks'][$requestId]=$record;
  n80_hub_write($root,'shorts-trial.json',$old);return $record;
 });
}
