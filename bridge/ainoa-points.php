<?php
declare(strict_types=1);
require_once __DIR__.'/subscription-core.php';

/** Existing VIP levels represent paid membership. An explicit expired grant overrides them. */
function na_paid_member(array $member,?array $grant,int $now):bool{
 if(empty($member['mb_id']))return false;
 $raw=(int)($member['noa_raw_level']??$member['mb_level']??0);
 if(in_array($raw,[5,6],true))return true;
 if($grant!==null){
  if(($grant['baseLevel']??null)!==ns_family($raw)||($grant['ownerId']??'')!==$member['mb_id']||($grant['status']??'')!=='active'||!is_int($grant['until']??null)||$grant['until']<=$now)return false;
  return in_array(ns_effective_level($raw,$grant,$now),[4,8],true);
 }
 return in_array($raw,[4,8],true);
}
function na_chat_policy(array $config):array{
 $points=$config['chatPoints']??null;
 return ['enabled'=>($config['chatEnabled']??false)===true,'points'=>is_int($points)&&$points>0&&$points<=1000000?$points:null];
}
function na_provider_ready(array $state):bool{
 if(empty($state['config']['textEnabled'])||($state['config']['maxJobUsd']??0)<.1||empty(lab_unseal($state['secrets']??null)['openaiKey']))return false;
 $today=gmdate('Y-m-d');$used=(float)($state['ainoaUsage'][$today]??0);
 foreach($state['jobs']??[] as $job)if(substr($job['costReservedAt']??'',0,10)===$today)$used+=(float)($job['costReservedUsd']??0);
 return $used+.1<=(float)($state['config']['dailyBudgetUsd']??0);
}
function na_chat_status(array $member):array{
 $out=['conversation'=>false,'pointsPerReply'=>null,'balance'=>null];
 if(empty($member['mb_id'])||(int)($member['mb_level']??0)<4)return $out;
 try{
  require_once __DIR__.'/lab-core.php';$state=lab_read();$policy=na_chat_policy($state['config']);$out['pointsPerReply']=$policy['points'];
  $grant=ns_doc(ns_member_key((string)$member['mb_id']));
  if(!$policy['enabled']||!$policy['points']||!na_paid_member($member,$grant['data']??null,time())||!na_provider_ready($state)||!ns_storage(true)['ready'])return $out;
  $out['balance']=(int)($member['mb_point']??0);$out['conversation']=$out['balance']>=$policy['points'];
 }catch(Throwable $e){error_log('[noa-chat-readiness] '.get_class($e));}
 return $out;
}
/** One successful reply and its point debit commit together; retries return the same receipt. */
function na_paid_reply(string $owner,string $requestId,string $fingerprint,int $quotedPoints,callable $generate):array{
 ns_order_key($requestId);$key='ainoa:chat:'.hash('sha256',$owner.'|'.$requestId);
 return ns_atomic($owner,true,function()use($owner,$requestId,$fingerprint,$quotedPoints,$generate,$key){
  $member=ns_native_member($owner);$grant=ns_doc(ns_member_key($owner),true);
  if(!na_paid_member($member,$grant['data']??null,time()))throw new DomainException('paid_membership_required');
  $old=ns_doc($key,true);
  if($old){$receipt=$old['data'];if(($receipt['ownerId']??'')!==$owner||!hash_equals($receipt['fingerprint']??'',$fingerprint))throw new DomainException('chat_request_conflict');return ['text'=>$receipt['text'],'chargedPoints'=>$receipt['points'],'balance'=>(int)get_point_sum($owner),'replayed'=>true];}
  require_once __DIR__.'/lab-core.php';$state=lab_read();$policy=na_chat_policy($state['config']);
  if(!$policy['enabled']||!$policy['points']||!na_provider_ready($state))throw new DomainException('ai_not_configured');
  if($quotedPoints!==$policy['points'])throw new DomainException('chat_price_changed');
  ns_q('SELECT po_id FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner).' FOR UPDATE');
  if((int)get_point_sum($owner)<$policy['points'])throw new DomainException('insufficient_points');
  $text=$generate();if(!is_string($text)||trim($text)==='')throw new RuntimeException('empty_ai_result');
  $buffer=ob_get_level();ob_start(static fn($v)=>'');
  try{$ok=insert_point($owner,-$policy['points'],'AInoa AI 대화','noa_ainoa',$requestId,'reply');$unexpected=ob_get_contents();}finally{while(ob_get_level()>$buffer)ob_end_clean();}
  $point=ns_one('SELECT po_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner)." AND po_rel_table='noa_ainoa' AND po_rel_id=".ns_e($requestId)." AND po_rel_action='reply'");
  if($ok!==1||trim($unexpected)!==''||!$point||(int)$point['po_point']!==-$policy['points'])throw new RuntimeException('points_debit_failed');
  ns_put($key,'ainoa_chat',['ownerId'=>$owner,'fingerprint'=>$fingerprint,'text'=>$text,'points'=>$policy['points'],'createdAt'=>time()],0,$owner);
  return ['text'=>$text,'chargedPoints'=>$policy['points'],'balance'=>(int)get_point_sum($owner),'replayed'=>false];
 });
}
