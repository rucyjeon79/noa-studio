<?php
declare(strict_types=1);
/** Monthly slots and native credits share the caller's member transaction. */
function nmb_rules(?int $now=null):?array {
 $p=nr_policy();$r=$p['monthlyBenefits']??[];$now??=time();
 return !empty($p['enabled'])&&!empty($r['enabled'])&&($r['multiplier']??0)===10&&($r['likePoints']??0)===10&&($r['activatedAt']??PHP_INT_MAX)<=$now?$r:null;
}
function nmb_month(int $now):string{return substr(nr_day($now),0,7);}
function nmb_key(string $owner,string $kind,int $now):string{return nr_key('monthly',$owner,nmb_month($now).'|'.$kind);}
function nmb_quote(string $owner,string $kind,int $base,int $now):array {
 $key=nmb_key($owner,$kind,$now);$first=nmb_rules($now)!==null&&!ns_doc($key,true);
 return ['key'=>$key,'first'=>$first,'base'=>$base,'points'=>$base*($first?10:1)];
}
function nmb_record(string $owner,string $kind,array $quote,string $event,int $now):void {
 if(!$quote['first'])return;
 ns_put($quote['key'],'membership_monthly',['ownerId'=>$owner,'month'=>nmb_month($now),'kind'=>$kind,'basePoints'=>$quote['base'],'points'=>$quote['points'],'multiplier'=>10,'event'=>$event,'createdAt'=>$now],0,$owner);
}
/** First authenticated visit of the KST month pays immediately; other days keep the daily activity rule. */
function nmb_login(string $owner,int $now):?array {
 if(!nmb_rules($now)||ns_doc(nmb_key($owner,'login',$now)))return null;
 return ns_atomic($owner,true,function()use($owner,$now){
  nr_member($owner);$q=nmb_quote($owner,'login',100,$now);if(!$q['first'])return null;
  $key=nr_key('login',$owner,nr_day($now));$old=ns_doc($key,true);$d=$old['data']??['ownerId'=>$owner,'day'=>nr_day($now),'createdAt'=>$now];
  // Deployment can happen after today's ordinary 100P was paid: top up to 1,000P, never 1,100P.
  $paid=($d['state']??'')==='paid'?(int)($d['points']??100):0;$credit=max(0,$q['points']-$paid);
  if($credit)nr_insert_points($owner,$credit,'NOA 매월 첫 로그인 · 10배 혜택','noa_monthly',nmb_month($now),'login');
  nmb_record($owner,'login',$q,$key,$now);$m=nr_sync_member($owner,$now);
  $d=array_replace($d,['state'=>'paid','points'=>$q['points'],'paidAt'=>$now,'monthly'=>true]);ns_put($key,'membership_login',$d,$old['revision']??0,$owner);return $d;
 });
}
/** Only persisted positive likes created after activation qualify. One credit per member and target, forever. */
function nmb_like(string $owner,string $entity,int $now):?array {
 $rules=nmb_rules($now);if(!$rules)return null;
 return ns_atomic($owner,true,function()use($owner,$entity,$now,$rules){
  $key=nr_key('like_reward',$owner,$entity);$old=ns_doc($key,true);if($old)return $old['data'];nr_member($owner);
  $like=ns_one('SELECT active FROM noa_post_likes WHERE entity='.ns_e($entity).' AND owner='.ns_e($owner).' FOR UPDATE');if(!$like||!(int)$like['active'])return null;
  $event=ns_one('SELECT MIN(created_at) AS created FROM noa_post_like_events WHERE entity='.ns_e($entity).' AND owner='.ns_e($owner).' AND active=1');
  if(!$event||$event['created']===null||(int)$event['created']<(int)$rules['activatedAt'])return null;
  $q=nmb_quote($owner,'like',10,$now);nr_insert_points($owner,$q['points'],'NOA 좋아요'.($q['first']?' · 매월 첫 활동 10배':''),'noa_like',hash('sha256',$entity),'like');
  nmb_record($owner,'like',$q,$key,$now);$m=nr_sync_member($owner,$now);$result=['ownerId'=>$owner,'kind'=>'like','points'=>$q['points'],'monthly'=>$q['first'],'balance'=>(int)$m['mb_point'],'createdAt'=>$now];
  ns_put($key,'membership_reward',$result,0,$owner);return $result;
 });
}
