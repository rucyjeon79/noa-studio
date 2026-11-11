<?php
declare(strict_types=1);
/** N80 Hub controls one approved subscription trial; the existing SQL task owns its result. */
require_once __DIR__.'/hub.php';
require_once dirname(__DIR__,2).'/noa-bridge/ainoa-automation.php';

function n80_codex_view(array $task):array {
 return ['taskId'=>$task['id'],'requestId'=>$task['requestId'],'state'=>$task['state'],'revision'=>$task['revision'],
  'result'=>$task['result']??null,'resultSha256'=>isset($task['result'])?hash('sha256',$task['result']):null,
  'usage'=>$task['usage']??null,'error'=>$task['error']??null,'songSaved'=>false];
}
function n80_codex_identity(array $body):array {
 $id=$body['requestId']??'';$run=$body['runId']??'';
 if(!is_string($id)||!preg_match('/^[a-f0-9]{32}$/D',$id)||!is_string($run)||!preg_match('/^[0-9]{1,24}$/D',$run))throw new DomainException('hub_codex_identity_invalid');
 return [$id,$run];
}
function n80_codex_handle(PDO $db,string $owner,string $root,array $body):array {
 [$id,$run]=n80_codex_identity($body);$action=$body['action']??'';
 if(!in_array($action,['codex.claim','codex.complete','codex.failed','codex.read'],true)||$owner==='')throw new DomainException('hub_codex_action_invalid');
 return n80_hub_locked($root,function()use($db,$owner,$root,$body,$id,$run,$action){
  $private=$root.'/codex';$policy=n80_hub_read($private,'probe.json');
  if(($policy['requestId']??'')!==$id||($policy['mode']??'')!=='single_trial'||($policy['apiFallback']??true)!==false)throw new DomainException('hub_codex_request_not_authorized');
  $task=n80_ai_read($db,n80_ai_id($owner,$id),$owner);
  if($action==='codex.read')return ['ok'=>true,'task'=>$task?n80_codex_view($task):null];
  if($action==='codex.claim'){
   // Existing evidence always wins: replaying a claim never returns a new execution lease.
   if($task)return ['ok'=>true,'execute'=>false,'task'=>n80_codex_view($task)];
   $control=n80_hub_read($root,'control.json');$connection=n80_hub_read($private,'connection.json');
   if(!empty($control['paused'])||!empty($control['stop'])||!in_array('ai.text',$control['activeOperations']??[],true))throw new DomainException('hub_codex_owner_inactive');
   if(($connection['state']??'')!=='authenticated'||empty($connection['vaultVerified']))throw new DomainException('hub_codex_auth_required');
   if(($policy['state']??'')!=='prepared')throw new DomainException('hub_codex_previous_execution_unconfirmed');
   $question=$policy['question']??'';
   if(!is_string($question)||trim($question)===''||mb_strlen($question)>2000)throw new DomainException('hub_codex_input_invalid');
   $lease=bin2hex(random_bytes(32));$db->beginTransaction();
   try{
    $task=n80_ai_enqueue($db,$owner,$id,'chat',['question'=>$question,'conversationId'=>$id,'trackKey'=>'']);
    if($task['state']!=='queued')throw new DomainException('hub_codex_task_changed');
    $task['state']='running';$task['startedAt']=time();$task['stage']='구독 응답 요청';
    $task['subscription']=['auth'=>'chatgpt','executor'=>'github_subordinate','runId'=>$run,'leaseHash'=>hash('sha256',$lease),'startedAt'=>time(),'maxSeconds'=>180,'automaticRetry'=>false];
    $task['history'][]=['stage'=>'subscription_started','at'=>gmdate('c')];n80_ai_save($db,$task);
    // No legacy worker can observe a queued canary: its insert and claim commit together.
    $db->commit();
   }catch(Throwable $e){if($db->inTransaction())$db->rollBack();throw $e;}
   $policy['state']='started';$policy['runId']=$run;$policy['taskId']=$task['id'];$policy['startedAt']=time();n80_hub_write($private,'probe.json',$policy);
   return ['ok'=>true,'execute'=>true,'taskId'=>$task['id'],'requestId'=>$id,'lease'=>$lease,'question'=>$question,'model'=>'gpt-6.1-sol','timeoutSeconds'=>180];
  }
  if(!$task)throw new DomainException('hub_codex_task_missing');
  $lease=$body['lease']??'';$sub=$task['subscription']??[];
  if(!is_string($lease)||!preg_match('/^[a-f0-9]{64}$/D',$lease)||($sub['runId']??'')!==$run||!hash_equals($sub['leaseHash']??'',hash('sha256',$lease)))throw new DomainException('hub_codex_lease_invalid');
  if($action==='codex.complete'){
   $text=$body['text']??'';$digest=$body['resultSha256']??'';
   if(!is_string($text)||trim($text)===''||mb_strlen($text)>2000||!is_string($digest)||!hash_equals(hash('sha256',$text),$digest))throw new DomainException('hub_codex_result_invalid');
   if($task['state']==='succeeded'){
    if(!hash_equals(hash('sha256',$task['result']),$digest))throw new DomainException('hub_codex_result_conflict');
    return ['ok'=>true,'duplicate'=>true,'task'=>n80_codex_view($task)];
   }
   if($task['state']!=='running')throw new DomainException('hub_codex_task_changed');
   $task['result']=$text;$task['state']='succeeded';$task['stage']='구독 응답 저장 완료';$task['lastSuccessfulStage']='AI 응답 SQL 보관';
   $usage=$body['usage']??[];$task['usage']=['auth'=>'chatgpt','provider'=>'codex_cli','model'=>'gpt-6.1-sol','costStatus'=>'subscription_usage','apiFallback'=>false];
   foreach(['input_tokens','cached_input_tokens','output_tokens']as $k)if(isset($usage[$k])&&is_int($usage[$k])&&$usage[$k]>=0)$task['usage'][$k]=$usage[$k];
  }else{
   if($task['state']!=='running')return ['ok'=>true,'duplicate'=>true,'task'=>n80_codex_view($task)];
   $task['state']='needs_review';$task['error']='ai_result_unconfirmed';$task['stage']='구독 실행 결과 확인 필요';
   $reason=$body['reason']??'';$task['subscription']['failure']=is_string($reason)&&preg_match('/^[a-z_]{1,80}$/D',$reason)?$reason:'execution_unconfirmed';
  }
  $task['finishedAt']=time();$task['history'][]=['stage'=>$task['state'],'at'=>gmdate('c')];n80_ai_save($db,$task);
  $policy['state']=$task['state'];$policy['finishedAt']=time();$policy['resultSha256']=isset($task['result'])?hash('sha256',$task['result']):null;n80_hub_write($private,'probe.json',$policy);
  return ['ok'=>true,'task'=>n80_codex_view($task)];
 });
}
