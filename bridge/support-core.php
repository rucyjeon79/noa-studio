<?php
declare(strict_types=1);
require_once __DIR__.'/subscription-core.php';
require_once __DIR__.'/support-settlement.php';
function nsp_wallet_key(string $owner):string{return 'support:wallet:'.hash('sha256',$owner);}
function nsp_wallet(string $owner,bool $lock=false):array{
 $key=nsp_wallet_key($owner);
 if($lock)ns_q('INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES('.ns_e($key).",'support_wallet','{}',0,".ns_e($owner).')');
 $r=ns_doc($key,$lock);return ['key'=>$key,'revision'=>$r['revision']??0,'data'=>array_replace(['received'=>0,'count'=>0,'reserved'=>0,'paid'=>0],$r['data']??[])];
}
function nsp_member(string $id,bool $lock=false):array{
 $r=ns_one('SELECT mb_id,mb_level,mb_point,mb_leave_date,mb_intercept_date FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id).($lock?' FOR UPDATE':''));
 if(!$r||(int)$r['mb_level']<2||$r['mb_leave_date']!==''||$r['mb_intercept_date']!=='')throw new DomainException('member_unavailable');return $r;
}
function nsp_target(PDO $db,string $type,string $key):array{
 global $config;
 if($type==='channel'){
  if(!preg_match('/^[a-f0-9]{64}$/D',$key))throw new InvalidArgumentException('invalid_target');
  $channel=ns_doc('creator-channel:'.$key);$d=$channel['data']??[];$owner=(string)($d['ownerId']??'');
  if($owner===''||!hash_equals($key,hash('sha256',$owner)))throw new DomainException('recipient_unavailable');
  $entity='channel:'.$key;$title=(string)($d['title']??'크레이터 채널');
 }elseif($type==='music'){
  require_once __DIR__.'/engagement-targets.php';
  $t=ne_target($db,'music',$key);$entity=$t['entity'];$title=$t['title'];
  $r=ns_doc($key);$owner=(string)($r['data']['ownerId']??'');
  // Only verified catalog songs may fall back to the installed library owner.
  if($owner===''&&str_starts_with($entity,'song:'))$owner=(string)(ns_doc('meta:channel-ownership-v1')['data']['ownerId']??'');
  if($owner==='')throw new DomainException('recipient_unavailable');
  $channel=ns_doc('creator-channel:'.hash('sha256',$owner));$d=$channel['data']??[];
  if(($d['ownerId']??'')!==$owner)throw new DomainException('recipient_unavailable');
 }else throw new InvalidArgumentException('invalid_target');
 $member=nsp_member($owner);
 if(!in_array((int)$member['mb_level'],[5,6],true)&&$owner!==($config['cf_admin']??''))throw new DomainException('recipient_unavailable');
 return ['owner'=>$owner,'channelId'=>hash('sha256',$owner),'channelTitle'=>(string)($d['title']??'크레이터'),'entity'=>$entity,'title'=>$title];
}
function nsp_count(string $entity):int{return (int)(ns_doc('support:count:'.hash('sha256',$entity))['data']['count']??0);}
function nsp_public(array $t):array{return ['channelId'=>$t['channelId'],'channelTitle'=>$t['channelTitle'],'entity'=>$t['entity'],'title'=>$t['title'],'count'=>nsp_count($t['entity'])];}
function nsp_debit(string $sender,int $amount,string $id,string $title):void{
 [$relation,$action]=ns_point_relation($id,'support');
 ns_q('SELECT po_id FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($sender).' FOR UPDATE');
 if((int)get_point_sum($sender)<$amount)throw new DomainException('insufficient_points');
 $level=ob_get_level();ob_start(static fn($v)=>'');
 try{$ok=insert_point($sender,-$amount,'크레이터 후원 · '.mb_substr($title,0,30),'noa_support',$relation,$action);$unexpected=ob_get_contents();}finally{while(ob_get_level()>$level)ob_end_clean();}
 $r=ns_one('SELECT po_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($sender)." AND po_rel_table='noa_support' AND po_rel_id=".ns_e($relation).' AND po_rel_action='.ns_e($action));
 if($ok!==1||trim($unexpected)!==''||!$r||(int)$r['po_point']!==-$amount)throw new RuntimeException('points_debit_failed');
}
function nsp_send(string $sender,string $id,array $input,callable $resolve):array{
 ns_order_key($id);
 $amount=$input['amount']??null;$message=$input['message']??'';
 if(!is_int($amount)||$amount<1||$amount>2147483647)throw new InvalidArgumentException('positive_integer_required');
 if(!is_string($message)||mb_strlen($message)>500||str_contains($message,"\0"))throw new InvalidArgumentException('invalid_message');
 foreach(['type','key','channelId','entity']as $f)if(!is_string($input[$f]??null)||strlen($input[$f])>220)throw new InvalidArgumentException('invalid_target');
 if(($input['confirmed']??false)!==true)throw new DomainException('confirmation_required');
 $fingerprint=hash('sha256',json_encode([$input['type'],$input['key'],$input['channelId'],$input['entity'],$amount,$message],JSON_THROW_ON_ERROR));$key='support:receipt:'.hash('sha256',$sender.'|'.$id);
 return ns_atomic($sender,true,function()use($sender,$id,$input,$amount,$message,$fingerprint,$key,$resolve){
  $donor=nsp_member($sender,true);$old=ns_doc($key,true);
  if($old){if(!hash_equals($old['data']['fingerprint']??'',$fingerprint))throw new DomainException('request_conflict');return $old['data']['receipt']+['replayed'=>true];}
  $t=$resolve();if($t['owner']===$sender)throw new DomainException('self_support_denied');
  if(!hash_equals($input['channelId'],$t['channelId'])||!hash_equals($input['entity'],$t['entity']))throw new DomainException('recipient_changed');
  $w=nsp_wallet($t['owner'],true);
  $fundingBefore=nspp_snapshot($sender);
  nsp_debit($sender,$amount,$id,$t['channelTitle']);
  $funding=nspp_funding($fundingBefore,nspp_snapshot($sender),$amount);
  $w['data']['received']+=$amount;$w['data']['count']++;ns_put($w['key'],'support_wallet',$w['data'],$w['revision'],$sender);
  $countKey='support:count:'.hash('sha256',$t['entity']);ns_q('INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES('.ns_e($countKey).",'support_count','{}',0,".ns_e($sender).')');$c=ns_doc($countKey,true);$count=(int)($c['data']['count']??0)+1;ns_put($countKey,'support_count',['count'=>$count],$c['revision'],$sender);
  $receipt=['id'=>$id,'amount'=>$amount,'title'=>$t['title'],'channelTitle'=>$t['channelTitle'],'channelId'=>$t['channelId'],'count'=>$count,'balance'=>(int)get_point_sum($sender),'at'=>time()];
  ns_put($key,'support_receipt',['sender'=>$sender,'recipient'=>$t['owner'],'entity'=>$t['entity'],'fingerprint'=>$fingerprint,'message'=>$message,'funding'=>$funding,'receipt'=>$receipt],0,$sender);
  return $receipt+['replayed'=>false];
 });
}
function nsp_settlement(string $owner,string $id,string $kind):array{
 ns_order_key($id);if(!in_array($kind,['personal','business'],true))throw new InvalidArgumentException('invalid_settlement_kind');$key='support:settlement:'.hash('sha256',$owner.'|'.$id);
 return ns_atomic($owner,false,function()use($owner,$id,$kind,$key){
  nsp_member($owner,true);$old=ns_doc($key,true);if($old){if(($old['data']['kind']??'')!==$kind)throw new DomainException('request_conflict');return $old['data'];}
  $w=nsp_wallet($owner,true);$available=$w['data']['received']-$w['data']['reserved']-$w['data']['paid'];if($available<1)throw new DomainException('no_settlement_balance');
  $d=['id'=>$id,'owner'=>$owner,'kind'=>$kind,'gross'=>$available,'status'=>'requested','at'=>time()];
  $w['data']['reserved']+=$available;ns_put($w['key'],'support_wallet',$w['data'],$w['revision'],$owner);ns_put($key,'support_settlement',$d,0,$owner);return $d;
 });
}
function nsp_dashboard(string $owner):array{
 $w=nsp_wallet($owner);$prefix='support:receipt:';$items=[];
 // Indexed updated_by handles sent receipts; recipient is filtered in the private ledger.
 $q=ns_q("SELECT payload FROM noa_documents WHERE doc_key LIKE 'support:receipt:%' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.recipient'))=".ns_e($owner)." ORDER BY updated_at DESC LIMIT 50");
 while($r=sql_fetch_array($q)){$d=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);$items[]=['amount'=>$d['receipt']['amount'],'title'=>$d['receipt']['title'],'at'=>$d['receipt']['at'],'message'=>$d['message']];}
 $requests=[];$q=ns_q("SELECT payload FROM noa_documents WHERE doc_key LIKE 'support:settlement:%' AND JSON_UNQUOTE(JSON_EXTRACT(payload,'$.owner'))=".ns_e($owner)." ORDER BY updated_at DESC LIMIT 20");while($r=sql_fetch_array($q)){$d=json_decode($r['payload'],true,64,JSON_THROW_ON_ERROR);unset($d['owner']);$requests[]=$d;}
 return ['wallet'=>$w['data'],'items'=>$items,'requests'=>$requests];
}
function nsp_review(string $actor,string $key,string $decision,int $net,string $reference):array{
 global $config;if($actor!==($config['cf_admin']??''))throw new DomainException('administrator_required');
 if(!preg_match('/^support:settlement:[a-f0-9]{64}$/D',$key)||!in_array($decision,['paid','rejected'],true)||mb_strlen($reference)>120||trim($reference)==='')throw new InvalidArgumentException('invalid_review');
 $first=ns_doc($key);if(!$first||!is_string($first['data']['owner']??null))throw new DomainException('request_unavailable');$owner=$first['data']['owner'];
 return ns_atomic($owner,false,function()use($actor,$key,$decision,$net,$reference,$owner){
  $r=ns_doc($key,true);$d=$r['data'];if($net<0||$net>$d['gross']||($decision==='paid'&&$net<1))throw new InvalidArgumentException('invalid_net');
  if($d['status']!=='requested'){if($d['status']===$decision&&($d['net']??null)===$net&&($d['reference']??'')===$reference)return $d;throw new DomainException('request_already_reviewed');}
  $w=nsp_wallet($owner,true);if($w['data']['reserved']<$d['gross'])throw new RuntimeException('ledger_mismatch');$w['data']['reserved']-=$d['gross'];if($decision==='paid')$w['data']['paid']+=$d['gross'];
  $d=array_replace($d,['status'=>$decision,'net'=>$net,'reference'=>$reference,'reviewedAt'=>time(),'reviewedBy'=>$actor]);ns_put($w['key'],'support_wallet',$w['data'],$w['revision'],$actor);ns_put($key,'support_settlement',$d,$r['revision'],$actor);return $d;
 });
}
