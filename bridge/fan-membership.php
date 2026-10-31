<?php
declare(strict_types=1);
require_once __DIR__.'/membership-core.php';

const NOA_FAN_MONTHLY = [5=>1000, 6=>3000];

// Invoke only after the legacy creator accounts and grants have been migrated.
function nfan_monthly(string $owner,int $now):int{
 $month=substr(nr_day($now),0,7);
 return ns_atomic($owner,true,function()use($owner,$month){
  $member=nr_member($owner);
  $amount=NOA_FAN_MONTHLY[(int)$member['mb_level']]??0;
  if(!$amount||!nfan_appointed($member))return 0;
  $key=nr_key('fan-month',$owner,$month);
  if(ns_doc($key,true))return 0;
  nr_insert_points($owner,$amount,'별무리 팬클럽 월 충전','noa_fan_month',$month,'credit');
  ns_put($key,'fan_monthly',['ownerId'=>$owner,'month'=>$month,'points'=>$amount],0,$owner);
  return $amount;
 });
}

function nfan_gift(string $sender,string $recipient,int $amount,string $requestId):array{
 ns_order_key($requestId);
 if($amount<1||$sender===$recipient)throw new InvalidArgumentException('invalid_gift');
 return ns_atomic($sender,true,function()use($sender,$recipient,$amount,$requestId){
  $key=nr_key('fan-gift',$sender,$requestId);
  $prior=ns_doc($key,true);
  if($prior){
   $gift=$prior['data'];
   if($gift['recipient']!==$recipient||$gift['points']!==$amount)throw new DomainException('gift_conflict');
   return $gift;
  }
  $members=[];
  $ids=[$sender,$recipient];sort($ids,SORT_STRING);
  foreach($ids as $id)$members[$id]=nfan_active($id);
  if(!nfan_appointed($members[$sender])||
    !in_array((int)$members[$recipient]['mb_level'],[2,3,4],true)||
    $members[$sender]['mb_id']===$members[$recipient]['mb_id'])throw new DomainException('gift_not_allowed');
  $relation=hash('sha256',$sender.'|'.$requestId);
  if((int)get_point_sum($sender)<$amount)throw new DomainException('insufficient_points');
  nr_record_points($sender,-$amount,'칭찬 포인트 선물','noa_fan_gift',$relation,'send');
  nr_record_points($recipient,$amount,'칭찬 포인트 받음','noa_fan_gift',$relation,'receive');
  $rebate=(int)$members[$sender]['mb_level']===6?intdiv($amount,10):0;
  if($rebate>0)nr_record_points($sender,$rebate,'스타 클러스터 칭찬 선물 10% 환급','noa_fan_gift',$relation,'rebate');
  $gift=['ownerId'=>$sender,'recipient'=>$recipient,'points'=>$amount,'rebate'=>$rebate];
  ns_put($key,'fan_gift',$gift,0,$sender);
  return $gift;
 });
}

// Call with the authenticated actor id and the locked native member row.
function nfan_may_appoint(array $actor,string $superId,int $destination):bool{
 $id=(string)($actor['mb_id']??'');
 if($id===''||!empty($actor['mb_leave_date'])||!empty($actor['mb_intercept_date']))return false;
 $super=$superId!==''&&hash_equals($superId,$id);
 return match($destination){
  6=>$super,
  5=>$super||in_array((int)($actor['mb_level']??0),[6,9,10],true),
  default=>false,
 };
}

function nfan_active(string $id):array{
 $m=ns_one('SELECT mb_id,mb_level,mb_leave_date,mb_intercept_date FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id).' FOR UPDATE');
 if(!$m||$m['mb_leave_date']!==''||$m['mb_intercept_date']!=='')throw new DomainException('member_unavailable');
 return $m;
}

function nfan_appointed(array $m):bool{
 $grant=ns_doc(nr_key('fan-rank',$m['mb_id']))['data']??[];
 return isset(NOA_FAN_MONTHLY[(int)$m['mb_level']])&&($grant['level']??0)===(int)$m['mb_level'];
}

const NOA_FAN_AIDE_LIMIT = 2;

function nfan_aide_count(?string $chair):int{
 // Existing appointments predate the pool field and belong to the appointing chair.
 $pool="COALESCE(JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$.aidePool')),'chair')";
 $scope=$chair===null?$pool."='staff'":$pool."='chair' AND JSON_UNQUOTE(JSON_EXTRACT(d.payload,'$.appointedBy'))=".ns_e($chair);
 $row=ns_one("SELECT COUNT(*) AS total FROM ".ns_table('member_table')." m
   JOIN noa_documents d ON d.doc_key=CONCAT('membership:fan-rank:',SHA2(CONCAT(m.mb_id,'|'),256))
   WHERE m.mb_level=5 AND m.mb_leave_date='' AND m.mb_intercept_date=''
     AND d.kind='fan_rank' AND ".$scope);
 return (int)$row['total'];
}

function nfan_appoint(string $sender,string $target,int $level):void{
 global $config;
 // Different administrators can compete for the same final seat.
 ns_atomic($level===5?'fan:advisor-appointments':$sender,false,function()use($sender,$target,$level,$config){
  $actor=nfan_active($sender);$member=nfan_active($target);
  $chairSeat=$level===5&&(int)$actor['mb_level']===6&&$actor['mb_id']!==$config['cf_admin'];
  if(!nfan_may_appoint($actor,(string)$config['cf_admin'],$level)||($chairSeat&&!nfan_appointed($actor)))throw new DomainException('appointment_denied');
  if($member['mb_id']===$actor['mb_id']||$member['mb_id']===$config['cf_admin'])throw new DomainException('appointment_denied');
  if(!in_array((int)$member['mb_level'],$level===6?[2,3,4,5]:[2,3,4],true))throw new DomainException('appointment_target_invalid');
  if($level===5&&nfan_aide_count($chairSeat?$actor['mb_id']:null)>=NOA_FAN_AIDE_LIMIT)
   throw new DomainException($chairSeat?'aide_limit_reached':'staff_aide_limit_reached');
  $key=nr_key('fan-rank',$member['mb_id']);$old=ns_doc($key,true);
  $grant=['level'=>$level,'appointedBy'=>$actor['mb_id'],'appointedAt'=>time()];
  if($level===5)$grant['aidePool']=$chairSeat?'chair':'staff';
  ns_put($key,'fan_rank',$grant,$old['revision']??0,$actor['mb_id']);
  ns_q('UPDATE '.ns_table('member_table').' SET mb_level='.$level.' WHERE mb_id='.ns_e($member['mb_id']));
 });
}
