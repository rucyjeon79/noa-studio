<?php
declare(strict_types=1);
if(!defined('_GNUBOARD_')){http_response_code(403);exit;}
require_once __DIR__.'/session-agent.php';

/** One explicit movie request, one bounded external worker. No clock or resident process. */
function nm_dispatch(string $id,string $owner,?callable $sender=null):array {
 $ticket=lab_lock(function(&$s)use($id,$owner){
  $j=&$s['jobs'][$id];
  if(!$j||($j['type']??'')!=='agent_movie'||$j['agent']['owner']!==$owner||!empty($j['removedAt']))throw new DomainException('agent_job_unavailable');
  if(in_array($j['state'],['saved','cancelled','agent_paused'],true))return ['send'=>false,'job'=>sa_view($j,true)];
  $w=$j['agent']['worker']??[];
  if(($w['expiresAt']??0)>time()&&in_array($w['state']??'',['dispatching','queued','running','unconfirmed'],true))return ['send'=>false,'job'=>sa_view($j,true)];
  if(($j['agent']['leaseUntil']??0)>time())throw new DomainException('agent_already_claimed');
  $w=['id'=>bin2hex(random_bytes(16)),'state'=>'dispatching','requestedAt'=>time(),'expiresAt'=>time()+10800];
  $j['agent']['worker']=$w;$j['agent']['reason']='제작 실행기를 연결하고 있습니다.';lab_touch($j);lab_event($s,'movie_dispatch_requested',$id,$owner);
  return ['send'=>true,'dispatchId'=>$w['id']];
 });
 if(!$ticket['send'])return ['job'=>$ticket['job'],'replayed'=>true];
 if($sender===null){require_once dirname(__DIR__).'/noa-app/engine/github-runtime.php';$sender=fn($dispatchId)=>n80_github_request('movie_generation',$dispatchId,n80_github_dispatch_token());}
 $code=$sender($ticket['dispatchId']);
 return lab_lock(function(&$s)use($id,$ticket,$code,$owner){
  $j=&$s['jobs'][$id];$w=&$j['agent']['worker'];
  if(($w['id']??'')!==$ticket['dispatchId'])throw new DomainException('movie_dispatch_replaced');
  if($w['state']==='dispatching'){
   $w['state']=$code===204?'queued':($code===0?'unconfirmed':'failed');$w['httpStatus']=$code;
   $j['agent']['reason']=$code===204?'실행 대기 중입니다. 이 화면을 닫아도 제작은 이어집니다.':($code===0?'실행 요청의 수신 여부를 확인 중입니다. 중복 실행은 하지 않습니다.':'제작 실행기 연결에 실패했습니다. 연결 상태를 확인한 뒤 재개해 주세요.');
   if($code!==204&&$code!==0)$j['state']='agent_paused';lab_touch($j);
  }
  return ['job'=>sa_view($j,true),'dispatchAccepted'=>$code===204];
 });
}

/** The existing worker credential can access only the matching explicit dispatch. */
function nm_worker(string $op,array $b,string $owner,?callable $sourceReader=null):array {
 $dispatch=lab_id((string)($b['dispatchId']??''));$session=lab_id((string)($b['sessionId']??''));$found=null;
 foreach(lab_read()['jobs'] as $job)if(($job['agent']['worker']['id']??null)===$dispatch){$found=$job;break;}
 if(!$found||($found['type']??'')!=='agent_movie'||($found['agent']['owner']??'')!==$owner||!empty($found['removedAt']))throw new DomainException('movie_dispatch_unavailable');
 $w=$found['agent']['worker'];
 if(($w['expiresAt']??0)<=time()||in_array($found['state'],['cancelled','agent_paused'],true)||($w['state']??'')==='failed')throw new DomainException('movie_dispatch_inactive');
 if(isset($w['sessionId'])&&!hash_equals($w['sessionId'],$session))throw new DomainException('movie_worker_already_claimed');
 $id=$found['id'];
 if($op==='claim'){
  lab_lock(function(&$s)use($id,$dispatch,$session){
   $j=&$s['jobs'][$id];$w=&$j['agent']['worker'];
   if($w['id']!==$dispatch||in_array($j['state'],['saved','cancelled','agent_paused'],true))throw new DomainException('movie_dispatch_inactive');
   if(isset($w['sessionId'])&&$w['sessionId']!==$session)throw new DomainException('movie_worker_already_claimed');
   $w['sessionId']=$session;$w['state']='running';$w['startedAt']??=time();$j['agent']['reason']='ChatGPT가 장면 제작과 검수를 진행하고 있습니다.';lab_touch($j);
  });
  return sa_dispatch('agentStep',['id'=>$id,'action'=>'claim','sessionId'=>$session],$owner,$sourceReader);
 }
 if(($w['sessionId']??null)!==$session)throw new DomainException('movie_claim_required');
 if($op==='fail'){
  $reason=sa_string($b['reason']??null,500);
  return lab_lock(function(&$s)use($id,$dispatch,$reason,$owner){
   $j=&$s['jobs'][$id];if($j['agent']['worker']['id']!==$dispatch)throw new DomainException('movie_dispatch_replaced');
   if(!in_array($j['state'],['saved','cancelled','agent_paused'],true)){$j['state']='agent_paused';$j['agent']['reason']=$reason;$j['agent']['worker']['state']='failed';$j['agent']['lease']='';$j['agent']['leaseUntil']=0;lab_touch($j);lab_event($s,'movie_worker_paused',$id,$owner);}
   return ['job'=>sa_view($j,true)];
  });
 }
 $mapped=match($op){'read'=>'agentRead','step'=>'agentStep','file'=>'agentFile',default=>throw new InvalidArgumentException('unknown_movie_operation')};
 if($op==='step'&&in_array($b['action']??'',['claim','resume','cancel'],true))throw new DomainException('movie_worker_action_forbidden');
 unset($b['dispatchId'],$b['sessionId']);$b['id']=$id;
 return sa_dispatch($mapped,$b,$owner,$sourceReader);
}
