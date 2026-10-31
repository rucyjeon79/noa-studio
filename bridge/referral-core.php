<?php
declare(strict_types=1);
require_once __DIR__.'/membership-core.php';
/** Opaque share codes resolve to native member IDs; balances stay in GnuBoard. */
function nrf_member(string $id,bool $lock=false):?array {
 return ns_one('SELECT mb_id,mb_datetime,mb_level,mb_leave_date,mb_intercept_date FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($id).($lock?' FOR UPDATE':''));
}
function nrf_active(?array $m):bool{return $m&&(int)$m['mb_level']>=2&&empty($m['mb_leave_date'])&&empty($m['mb_intercept_date']);}
function nrf_key(string $id):string{return 'referral:signup:'.hash('sha256',strtolower($id));}
function nrf_link(string $owner):string {
 return ns_atomic($owner,false,function()use($owner){
  $m=nrf_member($owner);if(!nrf_active($m))throw new DomainException('login_required');
  $key='referral:member:'.hash('sha256',$m['mb_id'].'|'.$m['mb_datetime']);$r=ns_doc($key,true);
  if(!$r){$code=bin2hex(random_bytes(24));$d=['code'=>$code,'ownerId'=>$m['mb_id'],'joinedAt'=>$m['mb_datetime']];ns_put('referral:code:'.$code,'referral_code',$d,0,$owner);ns_put($key,'referral_link',$d,0,$owner);}else $code=$r['data']['code'];
  return 'https://noastudio.ai.kr/?invite='.$code;
 });
}
function nrf_invite(mixed $code,int $now):?array {
 if(!is_string($code)||!preg_match('/^[a-f0-9]{48}$/D',$code))return null;
 $d=ns_doc('referral:code:'.$code)['data']??null;if(!$d)return null;$m=nrf_member($d['ownerId']);
 if(!nrf_active($m)||$m['mb_datetime']!==$d['joinedAt'])return null;
 return ['code'=>$code,'capturedAt'=>$now];
}
function nrf_session_invite(array $session,int $now):?array {
 $v=$session['noa_referral']??null;if(!is_array($v)||!is_int($v['capturedAt']??null)||$v['capturedAt']>$now)return null;
 return nrf_invite($v['code']??null,$v['capturedAt']);
}
/** Called only by verified native signup completion / approved NEW creator application. */
function nrf_complete(string $newId,array $invite,string $joinedAt):void {
 $code=$invite['code']??'';if(!is_string($code)||!preg_match('/^[a-f0-9]{48}$/D',$code))return;
 $d=ns_doc('referral:code:'.$code)['data']??null;if(!$d)return;
 ns_atomic($newId,true,function()use($newId,$invite,$joinedAt,$d){
  $m=nrf_member($newId,true);if(!nrf_active($m)||$m['mb_datetime']!==$joinedAt||strcasecmp($m['mb_id'],$d['ownerId'])===0)return;
  $key=nrf_key($m['mb_id']);if(ns_doc($key,true))return;
  ns_put($key,'referral_signup',['newId'=>$m['mb_id'],'newJoinedAt'=>$joinedAt,'inviterId'=>$d['ownerId'],'inviterJoinedAt'=>$d['joinedAt'],'state'=>'pending','pointsEach'=>500,'createdAt'=>time()],0,$m['mb_id']);
 });
 nrf_pay($newId);
}
function nrf_pay(string $newId):void {
 $key=nrf_key($newId);$r=ns_doc($key);if(!$r||$r['data']['state']!=='pending')return;
 ns_atomic('referral-awards',true,function()use($key){
  $r=ns_doc($key,true);if(!$r||$r['data']['state']!=='pending')return;$d=$r['data'];
  // Stable row order serializes simultaneous invitations with existing point transactions.
  $ids=[$d['newId'],$d['inviterId']];sort($ids,SORT_STRING);$members=[];foreach($ids as $id)$members[$id]=nrf_member($id,true);
  foreach(['newId'=>'newJoinedAt','inviterId'=>'inviterJoinedAt']as $id=>$date){$m=$members[$d[$id]];if(!nrf_active($m)||$m['mb_datetime']!==$d[$date]){$d['state']='ineligible';ns_put($key,'referral_signup',$d,$r['revision'],$d['newId']);return;}}
  nr_insert_points($d['inviterId'],500,'NOA 친구 초대 가입 보상','noa_referral',hash('sha256',$d['newId']),'invite');
  nr_insert_points($d['newId'],500,'NOA 초대 링크 가입 보상','noa_referral',hash('sha256',$d['newId']),'welcome');
  foreach($ids as $id)nr_sync_member($id,time());
  $d['state']='paid';$d['paidAt']=time();ns_put($key,'referral_signup',$d,$r['revision'],$d['newId']);
 });
}
function nrf_native_completed(string $id,string $previous,string $requestTime):bool {
 if($id===''||$id===$previous)return false;$m=nrf_member($id);
 return nrf_active($m)&&$m['mb_datetime']===$requestTime;
}
