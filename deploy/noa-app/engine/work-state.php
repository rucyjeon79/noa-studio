<?php
declare(strict_types=1);
require_once __DIR__.'/completion-receipt.php';
const N80_WORK_PARENT='integration-finish-20261024';
function n80_work_areas():array{return [
 'P0-01'=>'사이트맵 전체 완성','P0-02'=>'HOME 정상화','P0-03'=>'MUSIC 정상화','P0-04'=>'YouTube 정상화',
 'P0-05'=>'NOA WORLD 정상화','P0-06'=>'JUKEBOX 정상화','P0-07'=>'MY 정상화','P0-08'=>'공통 UI/UX',
 'P0-09'=>'전체 사이트 성능','P0-10'=>'N80 ENGINE','P0-11'=>'자동배포 정상화','P0-12'=>'서버·백업·데이터'];}
function n80_work_json($value):string{return json_encode($value,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);}
function n80_work_event_id(int $revision):string{return 'n80-workstate-'.N80_WORK_PARENT.'-r'.$revision;}
function n80_work_empty():array{
 $areas=[];foreach(n80_work_areas() as $id=>$label)$areas[$id]=['id'=>$id,'label'=>$label,'status'=>'needs_review','note'=>'운영 증거 및 전체 범위 확인 필요','evidence'=>[]];
 return ['parentTaskId'=>N80_WORK_PARENT,'revision'=>0,'areas'=>$areas,'instructions'=>[],'requestReceipts'=>[]];
}
function n80_work_file(string $path,int $max=1048576):?array{
 if(!file_exists($path)&&!is_link($path))return null;
 if(realpath($path)!==$path||is_link($path)||!is_file($path)||(fileperms($path)&0777)!==0600||filesize($path)>$max)throw new RuntimeException('unsafe_workstate_file');
 $raw=file_get_contents($path,false,null,0,$max+1);if($raw===false||strlen($raw)>$max)throw new RuntimeException('workstate_read_failed');
 $value=json_decode($raw,true,64,JSON_THROW_ON_ERROR);if(!is_array($value))throw new RuntimeException('invalid_workstate_file');return $value;
}
function n80_work_record(string $directory,int $revision):?array{
 $id=n80_work_event_id($revision);$record=n80_work_file($directory.'/'.hash('sha256',$id).'.json');if($record===null)return null;
 $e=$record['event']??[];$state=$e['workState']??[];
 if(!noa_engine_validate_event($e)['ok']||($e['id']??null)!==$id||($e['type']??null)!=='work.state.revised'
   ||($e['source']??null)!=='work_control'||($e['subjectId']??null)!==N80_WORK_PARENT||($record['plan']['steps']??null)!==[]
   ||($state['parentTaskId']??null)!==N80_WORK_PARENT||($state['revision']??null)!==$revision
   ||array_keys($state['areas']??[])!==array_keys(n80_work_areas())||!is_array($state['instructions']??null)||!is_array($state['requestReceipts']??null))
   throw new RuntimeException('corrupt_workstate_history');
 foreach($state['areas'] as $id=>$area)if(($area['id']??null)!==$id||!in_array($area['status']??null,['pending','in_progress','needs_review','error','complete'],true))throw new RuntimeException('corrupt_workstate_area');
 return ['event'=>$e,'state'=>$state,'eventSha256'=>hash('sha256',n80_work_json($e))];
}
/** Read only: journal is authoritative; the head cache may lag a committed event. */
function n80_work_read(string $directory):array{
 if(!file_exists($directory)&&!is_link($directory))return ['ok'=>true,'registered'=>false,'state'=>n80_work_empty(),'eventSha256'=>null];
 if(!n80_completion_directory_safe($directory,dirname(__DIR__,2)))throw new RuntimeException('unsafe_workstate_directory');
 $head=n80_work_file($directory.'/head.json',1024);$revision=0;$hash=null;$state=n80_work_empty();
 if($head!==null){
  if(!is_int($head['revision']??null)||$head['revision']<1||!n80_completion_hex($head['eventSha256']??null,64))throw new RuntimeException('corrupt_workstate_head');
  $record=n80_work_record($directory,$head['revision']);
  if($record===null||$record['eventSha256']!==$head['eventSha256'])throw new RuntimeException('workstate_head_mismatch');
  $revision=$head['revision'];$state=$record['state'];$hash=$record['eventSha256'];
 }
 for($recovered=0;$recovered<1000;$recovered++){
  $next=n80_work_record($directory,$revision+1);if($next===null)break;
  if(($next['event']['previousEventSha256']??null)!==$hash)throw new RuntimeException('workstate_chain_mismatch');
  $revision++;$state=$next['state'];$hash=$next['eventSha256'];
 }
 if($recovered===1000)throw new RuntimeException('workstate_recovery_limit');
 return ['ok'=>true,'registered'=>$revision>0,'state'=>$state,'eventSha256'=>$hash];
}
/** Existing persisted deployment proof only; no caller URL fetching or SQL. */
function n80_work_evidence(string $completionDirectory,string $eventId):array{
 if(!preg_match('/^n80-completion-[a-f0-9]{64}$/D',$eventId))throw new RuntimeException('invalid_operating_evidence_id');
 if(!n80_completion_directory_safe($completionDirectory,dirname(__DIR__,2)))throw new RuntimeException('unsafe_evidence_directory');
 $record=n80_work_file($completionDirectory.'/'.hash('sha256',$eventId).'.json');$event=$record['event']??[];
 $at=is_string($event['occurredAt']??null)?strtotime($event['occurredAt']):false;
 // Validate historical receipts as of their original verified time, retaining old evidence.
 if(!$at||!n80_completion_validate($event,$at)['ok']||($record['plan']['steps']??null)!==[]
   ||($event['id']??null)!==$eventId||!in_array($event['type'],['deploy.verified','work.completed'],true)
   ||($event['evidence']['taskId']!==N80_WORK_PARENT&&!str_starts_with($event['evidence']['taskId'],N80_WORK_PARENT.':')))throw new RuntimeException('operating_evidence_not_verified');
 return ['eventId'=>$eventId,'eventSha256'=>hash('sha256',n80_work_json($event)),'type'=>$event['type'],
   'commit'=>$event['evidence']['commit'],'verificationRun'=>$event['evidence']['verification']['runId'],'occurredAt'=>$event['occurredAt']];
}
function n80_work_head_write(string $directory,int $revision,string $hash):bool{
 $target=$directory.'/head.json';if(is_link($target))throw new RuntimeException('unsafe_workstate_head');
 $temp=tempnam($directory,'.work-head-');if($temp===false)return false;
 try{chmod($temp,0600);$h=fopen($temp,'wb');if(!$h)return false;
  try{$raw=n80_work_json(['revision'=>$revision,'eventSha256'=>$hash]);$n=fwrite($h,$raw);if($n!==strlen($raw)||!fflush($h)||(function_exists('fsync')&&!fsync($h)))return false;}finally{fclose($h);}
  if(!rename($temp,$target))return false;$temp=null;return true;
 }finally{if($temp!==null&&is_file($temp))unlink($temp);}
}
/** Revision CAS and stable request identity; no record is overwritten. */
function n80_work_revise(string $directory,string $completionDirectory,array $request,int $now):array{
 if(!n80_completion_keys($request,['requestId','expectedRevision','changes','appendInstructions'])
   ||!is_string($request['requestId'])||!preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$request['requestId'])
   ||!is_int($request['expectedRevision'])||$request['expectedRevision']<0
   ||!is_array($request['changes'])||!array_is_list($request['changes'])||count($request['changes'])>12
   ||!is_array($request['appendInstructions'])||!array_is_list($request['appendInstructions'])||count($request['appendInstructions'])>32)
   return ['ok'=>false,'error'=>'invalid_workstate_request'];
 if(!n80_completion_directory_safe($directory,dirname(__DIR__,2)))return ['ok'=>false,'error'=>'unsafe_workstate_directory'];
 if(is_link($directory.'/.workstate.lock'))return ['ok'=>false,'error'=>'unsafe_workstate_lock'];
 $lock=fopen($directory.'/.workstate.lock','c');if(!$lock)return ['ok'=>false,'error'=>'workstate_lock_unavailable'];
 try{if(!flock($lock,LOCK_EX))return ['ok'=>false,'error'=>'workstate_lock_failed'];
  $current=n80_work_read($directory);$state=$current['state'];$requestHash=hash('sha256',n80_work_json($request));$id=$request['requestId'];
  if(isset($state['requestReceipts'][$id])){
   if($state['requestReceipts'][$id]['requestSha256']!==$requestHash)return ['ok'=>false,'error'=>'request_identity_conflict'];
   return ['ok'=>true,'effect'=>'work_state_already_recorded','state'=>$state,'appliedRevision'=>$state['requestReceipts'][$id]['revision'],'readbackVerified'=>true];
  }
  if($state['revision']!==$request['expectedRevision'])return ['ok'=>false,'error'=>'revision_conflict','actualRevision'=>$state['revision']];
  if(count($state['requestReceipts'])>=5000)return ['ok'=>false,'error'=>'workstate_history_limit'];
  $seen=[];
  foreach($request['changes'] as $change){
   if(!is_array($change)||!n80_completion_keys($change,['areaId','status','note','evidenceIds'])
     ||!is_string($change['areaId'])||!isset($state['areas'][$change['areaId']])||isset($seen[$change['areaId']])
     ||!in_array($change['status'],['pending','in_progress','needs_review','error','complete'],true)
     ||!is_string($change['note'])||strlen($change['note'])>2000
     ||!is_array($change['evidenceIds'])||!array_is_list($change['evidenceIds'])||count($change['evidenceIds'])>32)
      return ['ok'=>false,'error'=>'invalid_workstate_change'];
   $area=$state['areas'][$change['areaId']];$links=[];foreach($area['evidence'] as $link)$links[$link['eventId']]=$link;
   foreach($change['evidenceIds'] as $evidenceId){if(!is_string($evidenceId))return ['ok'=>false,'error'=>'invalid_evidence_id'];$links[$evidenceId]=n80_work_evidence($completionDirectory,$evidenceId);}
   if($change['status']==='complete'){
    if(!$links||trim($change['note'])==='')return ['ok'=>false,'error'=>'completion_requires_operating_evidence'];
    foreach($links as $link)if(n80_work_evidence($completionDirectory,$link['eventId'])!==$link)return ['ok'=>false,'error'=>'operating_evidence_changed'];
   }
   $area['status']=$change['status'];$area['note']=$change['note'];$area['evidence']=array_values($links);$state['areas'][$change['areaId']]=$area;$seen[$change['areaId']]=true;
  }
  $instructions=[];foreach($state['instructions'] as $entry)$instructions[$entry['id']]=$entry;
  foreach($request['appendInstructions'] as $entry){
   if(!is_array($entry)||!n80_completion_keys($entry,['id','text','areaIds'])||!is_string($entry['id'])||!preg_match('/^[A-Za-z0-9_-]{1,128}$/D',$entry['id'])
      ||!is_string($entry['text'])||trim($entry['text'])===''||strlen($entry['text'])>2000||!is_array($entry['areaIds'])
      ||!array_is_list($entry['areaIds'])||!$entry['areaIds']||array_diff($entry['areaIds'],array_keys(n80_work_areas())))return ['ok'=>false,'error'=>'invalid_instruction'];
   if(isset($instructions[$entry['id']])){if($instructions[$entry['id']]['text']!==$entry['text']||$instructions[$entry['id']]['areaIds']!==$entry['areaIds'])return ['ok'=>false,'error'=>'instruction_identity_conflict'];continue;}
   if(count($instructions)>=256)return ['ok'=>false,'error'=>'instruction_queue_limit'];
   $instructions[$entry['id']]=$entry+['status'=>'pending','sequence'=>count($instructions)+1];
  }
  $state['instructions']=array_values($instructions);$state['revision']++;
  $state['requestReceipts'][$id]=['requestSha256'=>$requestHash,'revision'=>$state['revision']];
  $eventId=n80_work_event_id($state['revision']);$event=['id'=>$eventId,'type'=>'work.state.revised','source'=>'work_control',
   'subjectId'=>N80_WORK_PARENT,'occurredAt'=>gmdate('c',$now),'schemaVersion'=>1,'correlationId'=>$eventId,
   'previousEventSha256'=>$current['eventSha256'],'requestId'=>$id,'workState'=>$state];
  if(strlen(n80_work_json($event))>1040000)return ['ok'=>false,'error'=>'workstate_size_limit'];
  $stored=noa_engine_store_event($directory,$event);if(!$stored['ok'])return $stored;
  $hash=hash('sha256',n80_work_json($event));$cached=n80_work_head_write($directory,$state['revision'],$hash);
  $readback=n80_work_read($directory);if($readback['state']!==$state||$readback['eventSha256']!==$hash)return ['ok'=>false,'error'=>'workstate_readback_failed'];
  return ['ok'=>true,'effect'=>'work_state_revised','state'=>$state,'eventId'=>$eventId,'eventSha256'=>$hash,'headCacheUpdated'=>$cached,'readbackVerified'=>true];
 }catch(RuntimeException $e){
  $allowed=['invalid_operating_evidence_id','unsafe_evidence_directory','operating_evidence_not_verified'];
  return ['ok'=>false,'error'=>in_array($e->getMessage(),$allowed,true)?$e->getMessage():'workstate_storage_unavailable'];
 }finally{flock($lock,LOCK_UN);fclose($lock);}
}
/** Safe read model for the existing read-only app report; never writes a cache. */
function n80_work_summary(string $directory,string $completionDirectory='/hosting/noastudio/noa-ai-lab/n80-completion',?array $snapshot=null):array{
 try{$result=$snapshot??n80_work_read($directory);$state=$result['state'];$counts=array_fill_keys(['pending','in_progress','needs_review','error','complete'],0);$areas=[];
  foreach($state['areas'] as $area){
   if($area['status']==='complete'){
    try{if(!$area['evidence'])throw new RuntimeException('missing_evidence');foreach($area['evidence'] as $link)if(n80_work_evidence($completionDirectory,$link['eventId'])!==$link)throw new RuntimeException('changed_evidence');$area['evidenceStatus']='verified';}
    catch(Throwable $e){$area['recordedStatus']='complete';$area['status']='needs_review';$area['evidenceStatus']='missing_or_changed';}
   }
   $counts[$area['status']]++;$areas[]=$area;
  }
  return ['ok'=>true,'parentTaskId'=>N80_WORK_PARENT,'registered'=>$result['registered'],'revision'=>$state['revision'],
   'allAreasComplete'=>$counts['complete']===12,'counts'=>$counts,'areas'=>$areas,
   'instructionQueue'=>$state['instructions'],'workCompletedEventEmitted'=>false,'automaticDispatch'=>false,'databaseWrites'=>0];
 }catch(Throwable $e){return ['ok'=>false,'parentTaskId'=>N80_WORK_PARENT,'status'=>'needs_review','error'=>'workstate_unavailable',
  'allAreasComplete'=>false,'workCompletedEventEmitted'=>false,'automaticDispatch'=>false,'databaseWrites'=>0];}
}
