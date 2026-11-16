<?php
declare(strict_types=1);
require_once __DIR__.'/host-load-policy.php';
require_once __DIR__.'/hub-retirement-status.php';
/** N80 Hub owns host-side execution metadata; business queues stay with their modules. */
function n80_hub_module():array {
 return ['label'=>'N80 Hub','owner'=>'hub','entry'=>'/noa-hub.php','events'=>['operation.requested','deploy.verified','work.completed']];
}
function n80_hub_operations():array {
 return [
  'hub.verify'=>['handler'=>'hub.php','module'=>'hub','label'=>'호스트 연결 점검','interval'=>60,'timeout'=>20],
  'ai.text'=>['service'=>'n80_text_tick','handler'=>'lab.php','module'=>'lab','label'=>'AI 텍스트 작업','interval'=>60,'timeout'=>110],
  'ai.batch'=>['service'=>'n80_batch_watchdog','handler'=>'creator-lab.php','module'=>'creator_lab','label'=>'묶음 작업 복구','interval'=>60,'timeout'=>30],
  'catalog.index'=>['service'=>'n80_listening_index','handler'=>'catalog.php','module'=>'catalog','label'=>'곡 색인 갱신','interval'=>900,'timeout'=>110],
  'notifications.dispatch'=>['handler'=>'notify.php','module'=>'notify','label'=>'알림 전달','interval'=>60,'timeout'=>30],
  'popularity.calculate'=>['handler'=>'personalization.php','module'=>'personalization','label'=>'인기 집계','interval'=>3600,'timeout'=>110],
  'members.maintain'=>['handler'=>'sign.php','module'=>'sign','label'=>'회원 등급·갱신 정리','interval'=>900,'timeout'=>110],
  'covers.refresh'=>['handler'=>'media.php','module'=>'media','label'=>'누락된 곡 카드 이미지 보완','interval'=>180,'timeout'=>90],
  'ai.daily_shorts_clock'=>['service'=>'n80_daily_shorts_tick','handler'=>'lab.php','module'=>'lab','label'=>'쇼츠 일정·준비 상태','interval'=>900,'timeout'=>30],
 ];
}
function n80_hub_root():string { return dirname(__DIR__,3).'/noa-hub'; }
function n80_hub_directory(string $root):void {
 if(is_link($root)||!is_dir($root)||realpath($root)!==$root||(fileperms($root)&0077)!==0)throw new RuntimeException('hub_private_directory_required');
}
function n80_hub_read(string $root,string $name,array $default=[]):array {
 n80_hub_directory($root);
 if(!preg_match('/^[a-z][a-z0-9-]*[.]json$/D',$name))throw new InvalidArgumentException('hub_state_name');
 $p=$root.'/'.$name;if(!file_exists($p))return $default;
 if(is_link($p)||!is_file($p)||filesize($p)>16777216)throw new RuntimeException('hub_unsafe_state');
 $v=json_decode((string)file_get_contents($p),true,64,JSON_THROW_ON_ERROR);
 if(!is_array($v))throw new RuntimeException('hub_invalid_state');return $v;
}
function n80_hub_write(string $root,string $name,array $value):void {
 n80_hub_directory($root);
 if(!preg_match('/^[a-z][a-z0-9-]*[.]json$/D',$name)||is_link($root.'/'.$name))throw new RuntimeException('hub_unsafe_state');
 $tmp=$root.'/.hub-'.bin2hex(random_bytes(12));$f=fopen($tmp,'x');
 try{chmod($tmp,0600);$data=json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);if(fwrite($f,$data)!==strlen($data)||!fflush($f))throw new RuntimeException('hub_write_failed');if(function_exists('fsync'))fsync($f);}finally{fclose($f);}
 if(!rename($tmp,$root.'/'.$name)){unlink($tmp);throw new RuntimeException('hub_write_failed');}
}
function n80_hub_locked(string $root,callable $fn,int $waitMs=750):mixed {
 if($waitMs<0||$waitMs>2000)throw new InvalidArgumentException('hub_lock_wait_invalid');
 n80_hub_directory($root);$p=$root.'/state.lock';if(is_link($p))throw new RuntimeException('hub_unsafe_lock');$f=fopen($p,'c');
 if(!$f)throw new RuntimeException('hub_lock_unavailable');
 chmod($p,0600);
 // Reads, heartbeats and receipt commits share this lock. Brief contention is
 // normal; retry acquisition only, never replay the protected operation.
 $deadline=hrtime(true)+$waitMs*1000000;
 while(!flock($f,LOCK_EX|LOCK_NB)){
  $remaining=$deadline-hrtime(true);
  if($remaining<=0){fclose($f);throw new DomainException('hub_busy');}
  usleep((int)min(10000,max(1,intdiv($remaining,1000))));
 }
 try{return $fn();}finally{flock($f,LOCK_UN);fclose($f);}
}
/** Caller holds the Hub lock. Reconcile owner labels only; schedules and activation stay intact. */
function n80_hub_sync_scheduler_owners(string $root):int {
 $operations=n80_hub_read($root,'operations.json');$changed=0;
 foreach(n80_hub_operations()as $id=>$route){
  if(isset($operations[$id])&&is_array($operations[$id])&&($operations[$id]['module']??null)!==$route['module']){
   $operations[$id]['module']=$route['module'];$changed++;
  }
 }
 if($changed)n80_hub_write($root,'operations.json',$operations);
 return $changed;
}
function n80_hub_owner(string $operation,?string $root=null):string {
 $s=n80_hub_read($root??n80_hub_root(),'control.json');
 return in_array($operation,$s['activeOperations']??[],true)?'n80_hub':'legacy';
}
/** Clock ownership never captures Shorts transfer and completion commands. */
function n80_hub_service_operation(string $action,array $body=[]):?string {
 if($action==='n80_daily_shorts_tick'&&($body['command']??'')!=='')return null;
 if($action==='n80_tick')$action='n80_text_tick';
 foreach(n80_hub_operations()as $id=>$route)if(($route['service']??null)===$action)return $id;
 return null;
}
function n80_hub_legacy_action(string $action,?string $root=null):?string {
 $op=n80_hub_service_operation($action);
 return $op===null?null:n80_hub_owner($op,$root);
}
function n80_hub_request(string $operation,?string $root=null):string {
 $root??=n80_hub_root();if(!isset(n80_hub_operations()[$operation]))return 'unsupported';
  $policyControl=n80_hub_read($root,'control.json');if(($policyControl['stop']??true)!==false||($policyControl['paused']??true)!==false)return 'paused';
 return n80_hub_locked($root,function()use($root,$operation){
  $c=n80_hub_read($root,'control.json');if(($c['stop']??true)!==false||($c['paused']??true)!==false)return 'paused';if(!in_array($operation,$c['activeOperations']??[],true))return 'not_migrated';
  $s=n80_hub_read($root,'requests.json');$s[$operation]=time();n80_hub_write($root,'requests.json',$s);return 'requested';
 });
}
function n80_hub_auth(string $raw,array $headers,string $key,int $now,int $limit=65536):bool {
 $ts=$headers['time']??'';$nonce=$headers['nonce']??'';$sig=$headers['signature']??'';
 return $limit<=12582912&&strlen($raw)<=$limit&&strlen($key)===64&&is_string($ts)&&ctype_digit($ts)&&abs($now-(int)$ts)<=180
 &&is_string($nonce)&&preg_match('/^[a-f0-9]{32}$/D',$nonce)&&is_string($sig)&&preg_match('/^[a-f0-9]{64}$/D',$sig)
 &&hash_equals(hash_hmac('sha256',"N80-HUB-1\n".hash('sha256',$raw)."\n".$ts."\n".$nonce,$key),$sig);
}
function n80_hub_nonce(string $root,string $nonce,int $now):void {
 n80_hub_locked($root,function()use($root,$nonce,$now){$s=n80_hub_read($root,'nonces.json');if(isset($s[$nonce]))throw new DomainException('hub_replay');$s=array_filter($s,fn($v)=>$v>$now-360);if(count($s)>10000)throw new RuntimeException('hub_nonce_limit');$s[$nonce]=$now;n80_hub_write($root,'nonces.json',$s);});
}
function n80_hub_status(string $root):array {
 $c=n80_hub_read($root,'control.json');$s=n80_hub_read($root,'status.json');$last=(int)($s['heartbeatAt']??0);
 $retirement=n80_hub_resident_retirement($root);
 $runnerState=$retirement['verified']?'retired':($retirement['state']==='needs_review'?'needs_review':($last>0&&$last<=time()&&time()-$last<180?'running':'not_verified'));
 // Read-only one-shot checklist; never reads secret bytes or runs a worker.
 require_once __DIR__.'/wake-preflight.php';
 $wakePreflight=n80_wake_preflight($root,dirname(__DIR__,2),n80_host_load_policy(),$c,
     n80_hub_read($root,'scheduled-wake-control.json'),$retirement);
 $ops=[];$history=n80_hub_read($root,'receipts.json');$latest=[];
 foreach($history as $receipt)$latest[$receipt['operation']??'']=$receipt;
 foreach(n80_hub_operations()as $id=>$row)$ops[]=['id'=>$id,'label'=>$row['label'],'module'=>$row['module'],'owner'=>in_array($id,$c['activeOperations']??[],true)?'n80_hub':'legacy','last'=>$latest[$id]??null];
 return ['ok'=>true,'module'=>'N80 Hub','revision'=>(int)($c['revision']??0),'paused'=>!empty($c['paused']),'heartbeatAt'=>$last,
  'runnerState'=>$runnerState,'residentRetirement'=>$retirement,'source'=>n80_hub_read($root,'source.json'),
  'wakePreflight'=>$wakePreflight,
  'operations'=>$ops,'dependencies'=>n80_hub_read($root,'dependencies.json'),'covers'=>n80_hub_read($root,'covers-result.json'),'receipts'=>array_slice($history,-30)];
}
/** One request identifier cannot run twice, including after an interrupted response. */
function n80_hub_execute(string $root,string $operation,string $id,callable $execute):array {
 if(!isset(n80_hub_operations()[$operation])||!preg_match('/^[a-f0-9]{32}$/D',$id))throw new InvalidArgumentException('hub_invalid_operation');
  n80_host_legacy_background_guard(n80_hub_read($root,'control.json'));
 $prior=n80_hub_locked($root,function()use($root,$operation,$id){
  $c=n80_hub_read($root,'control.json');n80_host_legacy_background_guard($c);if(!in_array($operation,$c['activeOperations']??[],true)||(!empty($c['paused'])&&$operation!=='hub.verify'))throw new DomainException('hub_operation_not_active');
  $s=n80_hub_read($root,'receipts.json');foreach($s as $r)if($r['id']===$id){if($r['operation']!==$operation)throw new DomainException('hub_identity_conflict');return $r;}
  $issued=(int)hexdec(substr($id,0,8));if($issued>time()+30||$issued<time()-180)throw new DomainException('hub_invocation_expired');
  foreach($s as $r)if($r['operation']===$operation&&$r['state']==='running')throw new DomainException('hub_previous_execution_unconfirmed');
  $s[]=['id'=>$id,'operation'=>$operation,'module'=>n80_hub_operations()[$operation]['module'],'state'=>'running','startedAt'=>time()];
  // Never prune unresolved execution evidence.
  if(count($s)>500){$running=array_values(array_filter($s,fn($r)=>$r['state']==='running'));$done=array_values(array_filter($s,fn($r)=>$r['state']!=='running'));if(count($running)>100)throw new DomainException('hub_receipt_limit');$s=array_merge(array_slice($done,-(500-count($running))),$running);}
  n80_hub_write($root,'receipts.json',$s);return null;
 });
 if($prior)return ['ok'=>true,'duplicate'=>true,'receipt'=>$prior];
 try{$result=$execute($operation);if(!is_array($result)||($result['ok']??false)!==true)throw new RuntimeException('hub_specialist_failed');if($operation==='covers.refresh'&&($result['executionId']??null)!==$id)
    throw new RuntimeException('hub_cover_execution_id_missing');
   $state='succeeded';$error=null;}
 catch(Throwable $e){$result=[];$state='failed';$error=preg_match('/^[a-z][a-z0-9_]{1,90}$/D',$e->getMessage())?$e->getMessage():'hub_execution_failed';}
 // The specialist has finished. Retry only final receipt locking,
  // never repeat the business handler.
  $commit=function()use($root,$operation,$id,$result,$state,$error){
  $s=n80_hub_read($root,'receipts.json');foreach($s as &$r)if($r['id']===$id){$r+=['finishedAt'=>time(),'resultSha256'=>hash('sha256',json_encode($result,JSON_THROW_ON_ERROR))];$r['state']=$state;if($error)$r['error']=$error;
   if($operation==='ai.daily_shorts_clock'&&$state==='succeeded'){require_once __DIR__.'/hub-shorts.php';$r['outcome']=n80_hub_shorts_outcome($result);}
   if($operation==='ai.batch'&&$state==='succeeded'){
    // Signed business result categories; a watchdog receipt is not generation proof.
    $r['batchEvidence']=[
      'pipelineState'=>(string)($result['autoPipeline']['state']??'unavailable'),
      'epRecordsCreated'=>(int)($result['autoPipeline']['epRecordsCreated']??0),
      'actRecordsCreated'=>(int)($result['autoPipeline']['actRecordsCreated']??0),
      'aiGenerated'=>(int)($result['autoPipeline']['aiGenerated']??0),
      'tracklistMaintenance'=>(string)($result['actTracklistMaintenance']['state']??'not_checked'),
      'tracklistCorrected'=>(int)($result['actTracklistMaintenance']['corrected']??0),
       'tracklistErrorClass'=>(string)($result['actTracklistMaintenance']['errorClass']??''),
       'tracklistErrorCode'=>(string)($result['actTracklistMaintenance']['errorCode']??''),
      'assistantQueue'=>(string)($result['assistantQueue']['state']??'not_checked')
    ];
   }
   if($operation==='covers.refresh'&&$state==='succeeded'){
    $r['coverEvidence']=['executionId'=>$id,'checkedAt'=>(int)($result['checkedAt']??0),
     'attempted'=>(int)($result['attempted']??0),'recovered'=>(int)($result['recovered']??0),
     'remaining'=>(int)($result['remaining']??0),'audioFilesChanged'=>(int)($result['audioFilesChanged']??-1),
     'resultSha256'=>hash('sha256',json_encode($result,JSON_THROW_ON_ERROR))];
   }

   $receipt=$r;break;}unset($r);
  n80_hub_write($root,'receipts.json',$s);return ['ok'=>true,'receipt'=>$receipt];
 };
 for($attempt=0;$attempt<3;$attempt++){
  try{return n80_hub_locked($root,$commit,2000);}
  catch(DomainException $e){
   if($e->getMessage()!=='hub_busy'||$attempt===2)throw $e;
   usleep(100000);
  }
 }
 throw new RuntimeException('hub_receipt_commit_unavailable');
}

/** Retired after Dothome shared-host CPU/RAM suspension.
 * Never start or resume a resident Node runner from web requests.
 */
function n80_hub_start(string $root):string {
 throw new DomainException('hub_resident_runner_retired');
}
