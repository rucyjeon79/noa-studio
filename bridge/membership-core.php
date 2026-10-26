<?php
declare(strict_types=1);
/** Native GnuBoard balance and SQL receipts. Never trust a client-supplied reward amount. */
require_once __DIR__.'/subscription-core.php';
const NR_POLICY='membership:rules';
function nr_day(int $now):string{return (new DateTimeImmutable('@'.$now))->setTimezone(new DateTimeZone('Asia/Seoul'))->format('Y-m-d');}
function nr_policy():array{$r=ns_doc(NR_POLICY);return $r&&($r['data']['version']??0)===1?$r['data']:['enabled'=>false];}
function nr_key(string $type,string $owner,string $id=''):string{return 'membership:'.$type.':'.hash('sha256',$owner.'|'.$id);}
function nr_member(string $owner,bool $lock=true):array{
 $r=ns_one('SELECT mb_id,mb_level,mb_point FROM '.ns_table('member_table').' WHERE mb_id='.ns_e($owner).($lock?' FOR UPDATE':''));
 if(!$r||(int)$r['mb_level']<2)throw new DomainException('login_required');return $r;
}
function nr_level(array $m,?array $grant,int $now):int{
 $raw=(int)$m['mb_level'];if(!in_array($raw,[2,3,4],true))return $raw;
 if(($grant['baseLevel']??0)===3&&($grant['status']??'')==='active'&&($grant['until']??0)>$now)return 4;
 return (int)$m['mb_point']>=1000?3:2;
}
function nr_sync_member(string $owner,int $now):array{
 $m=nr_member($owner);global $config;if($owner===($config['cf_admin']??''))return $m;
 $g=ns_doc(ns_member_key($owner));$level=nr_level($m,$g['data']??null,$now);
 if($level!==(int)$m['mb_level'])ns_q('UPDATE '.ns_table('member_table').' SET mb_level='.$level.' WHERE mb_id='.ns_e($owner).' AND mb_level='.(int)$m['mb_level']);
 $m['mb_level']=$level;return $m;
}
function nr_refresh(string $owner,int $now):array{return ns_atomic($owner,true,fn()=>nr_sync_member($owner,$now));}
function nr_pending_login(string $owner,int $now):array{
 $day=nr_day($now);$key=nr_key('login',$owner,$day);$row=ns_doc($key);if($row)return $row['data'];
 return ns_atomic($owner,false,function()use($owner,$now,$day,$key){$r=ns_doc($key,true);if($r)return $r['data'];$d=['ownerId'=>$owner,'day'=>$day,'state'=>'pending','points'=>100,'createdAt'=>$now];ns_put($key,'membership_login',$d,0,$owner);return $d;});
}
function nr_insert_points(string $owner,int $points,string $content,string $table,string $id,string $action):void{
 if($points<=0||$points>1000000)throw new InvalidArgumentException('invalid_points');
 $buffer=ob_get_level();ob_start(static fn($v)=>'');try{$ok=insert_point($owner,$points,$content,$table,$id,$action);$output=ob_get_contents();}finally{while(ob_get_level()>$buffer)ob_end_clean();}
 if($ok!==1||trim($output)!=='')throw new RuntimeException('reward_credit_failed');
 $r=ns_one('SELECT po_point FROM '.ns_table('point_table').' WHERE mb_id='.ns_e($owner).' AND po_rel_table='.ns_e($table).' AND po_rel_id='.ns_e($id).' AND po_rel_action='.ns_e($action));
 if(!$r||(int)$r['po_point']!==$points)throw new RuntimeException('reward_credit_failed');
}
function nr_reward(string $owner,string $kind,string $board,int $post,int $now):array{
 if(!in_array($kind,['write','comment'],true)||!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$board)||$post<1)throw new InvalidArgumentException('invalid_reward');
 $key=nr_key('reward',$owner,$kind.'|'.$board.'|'.$post);
 return ns_atomic($owner,true,function()use($owner,$kind,$board,$post,$now,$key){
  $old=ns_doc($key,true);if($old)return $old['data'];nr_member($owner);
  $points=$kind==='write'?50:30;$action=$kind==='write'?'쓰기':'댓글';
  // Native relation keys allow GnuBoard's own deletion/refund mechanism to remain effective.
  nr_insert_points($owner,$points,'NOA '.($kind==='write'?'글 작성':'댓글 작성'),$board,(string)$post,$action);
  $loginKey=nr_key('login',$owner,nr_day($now));$login=ns_doc($loginKey,true);$bonus=0;
  if($login&&($login['data']['state']??'')==='pending'){
   $bonus=100;nr_insert_points($owner,100,'NOA 첫 활동 로그인 보너스','noa_login',nr_day($now),'activity');
   $d=$login['data'];$d['state']='paid';$d['paidAt']=$now;$d['rewardKey']=$key;ns_put($loginKey,'membership_login',$d,$login['revision'],$owner);
  }
  $m=nr_sync_member($owner,$now);$result=['ownerId'=>$owner,'kind'=>$kind,'points'=>$points,'loginBonus'=>$bonus,'total'=>$points+$bonus,'balance'=>(int)$m['mb_point'],'level'=>(int)$m['mb_level'],'createdAt'=>$now];
  ns_put($key,'membership_reward',$result,0,$owner);return $result;
 });
}
function nr_verify_post(string $owner,string $board,int $post,bool $comment):bool{
 global $g5;if(!preg_match('/^[A-Za-z0-9_]{1,20}$/D',$board)||$post<1)return false;
 $prefix=$g5['write_prefix']??'';if(!preg_match('/^[A-Za-z0-9_]+$/D',$prefix))return false;
 $b=ns_one('SELECT bo_table FROM '.ns_table('board_table').' WHERE bo_table='.ns_e($board));if(!$b)return false;
 $r=ns_one('SELECT mb_id,wr_is_comment,wr_content FROM `'.$prefix.$board.'` WHERE wr_id='.$post);
 return $r&&hash_equals($owner,(string)$r['mb_id'])&&(bool)$r['wr_is_comment']===$comment&&trim((string)$r['wr_content'])!=='';
}
function nr_activity(string $kind,array $board,int $id,string $mode,int $now):void{
 global $member,$bo_table;if(empty($member['mb_id'])||!nr_policy()['enabled'])return;
 if(($kind==='write'&&!in_array($mode,['','r'],true))||($kind==='comment'&&$mode!=='c'))return;
 $name=(string)($board['bo_table']??$bo_table??'');$owner=(string)$member['mb_id'];
 if(!nr_verify_post($owner,$name,$id,$kind==='comment'))return;
 nr_pending_login($owner,$now);nr_reward($owner,$kind,$name,$id,$now);
}
function nr_auto_settings(string $owner):array{$r=ns_doc(nr_key('auto',$owner));return ['revision'=>$r['revision']??0,'values'=>$r['data']??['enabled'=>false,'agreedPoints'=>3000,'durationDays'=>30]];}
function nr_set_auto(string $owner,bool $enabled,int $revision,int $now):array{
 return ns_atomic($owner,false,function()use($owner,$enabled,$revision,$now){$m=nr_member($owner);if(!in_array((int)$m['mb_level'],[2,3,4],true))throw new DomainException('regular_or_creator_required');
  $d=['ownerId'=>$owner,'enabled'=>$enabled,'agreedPoints'=>3000,'durationDays'=>30,'consentedAt'=>$now,'lastError'=>null];$next=ns_put(nr_key('auto',$owner),'membership_auto',$d,$revision,$owner);return ['revision'=>$next,'values'=>$d];});
}
function nr_renew_id(string $owner,int $until):string{$h=hash('sha256','NOA-RENEW-1|'.$owner.'|'.$until);return substr($h,0,8).'-'.substr($h,8,4).'-4'.substr($h,13,3).'-8'.substr($h,17,3).'-'.substr($h,20,12);}
function nr_buy_vip(string $owner,string $request,int $policyRevision,int $now,?callable $authorize=null):array{
 $p=ns_policy();$v=$p['values']['plans']['vip'];if($p['revision']!==$policyRevision||$v['points']!==3000||($v['durationDays']??0)!==30)throw new DomainException('policy_changed');
 $m=nr_refresh($owner,$now);if(!ns_doc(ns_order_key($request))&&(int)$m['mb_point']<3000)throw new DomainException('insufficient_points');
 $order=ns_create_order($owner,$request,'vip','points',$now,$policyRevision,$authorize);nr_refresh($owner,$now);return $order;
}
function nr_renew(string $owner,int $now):array{
 $auto=nr_auto_settings($owner);$d=$auto['values'];if(empty($d['enabled']))return ['state'=>'disabled'];
 $m=nr_member($owner,false);if(!in_array((int)$m['mb_level'],[2,3,4],true))return ['state'=>'ineligible'];
 $g=ns_doc(ns_member_key($owner));$grant=$g['data']??null;
 if(!$grant||($grant['status']??'')!=='active'||($grant['baseLevel']??0)!==3)return ['state'=>'no_vip_pass'];
 if($grant['until']>$now)return ['state'=>'active'];
 if(($d['lastAttemptDay']??'')===nr_day($now)&&($d['lastAttemptUntil']??0)===$grant['until'])return ['state'=>'already_checked'];
 $id=nr_renew_id($owner,(int)$grant['until']);
 try{$p=ns_policy();$order=nr_buy_vip($owner,$id,$p['revision'],$now,function()use($owner,$grant){$fresh=nr_auto_settings($owner)['values'];$g=ns_doc(ns_member_key($owner),true)['data']??null;if(empty($fresh['enabled'])||($fresh['agreedPoints']??0)!==3000||($g['until']??0)!==$grant['until'])throw new DomainException('renewal_cancelled');});$state='renewed';$error=null;}
 catch(DomainException $e){$state='expired';$error=in_array($e->getMessage(),['insufficient_points','policy_changed','points_storage_not_ready'],true)?$e->getMessage():'renewal_unavailable';nr_refresh($owner,$now);}
 // Preserve a simultaneous opt-out; the purchase itself has its durable order ID.
 ns_atomic($owner,false,function()use($owner,$now,$grant,$auto,$d,$error){$latest=nr_auto_settings($owner);if($latest['revision']!==$auto['revision'])return;$d['lastAttemptDay']=nr_day($now);$d['lastAttemptUntil']=$grant['until'];$d['lastError']=$error;ns_put(nr_key('auto',$owner),'membership_auto',$d,$auto['revision'],$owner);});
 return ['state'=>$state,'error'=>$error];
}
function nr_topup_order(string $owner,string $request,int $points,int $now):array{
 ns_order_key($request);if($points<100||$points>1000000)throw new InvalidArgumentException('invalid_points');
 return ns_atomic($owner,false,function()use($owner,$request,$points,$now){$key=nr_key('topup',$owner,$request);$old=ns_doc($key,true);if($old){if($old['data']['points']!==$points)throw new DomainException('purchase_conflict');return $old['data'];}
  $p=ns_policy()['values'];if(!$p['paymentApprovalEnabled']||$p['provider']===''||$p['paymentInstructions']==='')throw new DomainException('payment_purchase_disabled');
  $d=['id'=>$request,'ownerId'=>$owner,'points'=>$points,'priceWon'=>$points,'state'=>'awaiting_payment','provider'=>$p['provider'],'createdAt'=>$now];ns_put($key,'membership_topup',$d,0,$owner);return $d;});
}
function nr_confirm_topup(string $owner,string $id,string $reference,int $amount,string $actor,int $now):array{
 ns_order_key($id);if(trim($reference)===''||mb_strlen($reference)>160)throw new InvalidArgumentException('payment_reference_required');
 return ns_atomic($owner,true,function()use($owner,$id,$reference,$amount,$actor,$now){$key=nr_key('topup',$owner,$id);$r=ns_doc($key,true);if(!$r)throw new DomainException('order_not_found');$d=$r['data'];
  if($d['state']==='paid'){if(($d['reference']??'')!==$reference||$d['priceWon']!==$amount)throw new DomainException('purchase_conflict');return $d;}
  if($d['state']!=='awaiting_payment'||$d['priceWon']!==$amount)throw new DomainException('payment_amount_mismatch');
  $receipt='subscription:receipt:'.hash('sha256',strtolower($d['provider'])."\n".$reference);if(ns_doc($receipt,true))throw new DomainException('payment_reference_already_used');
  nr_member($owner);nr_insert_points($owner,$d['points'],'NOA 포인트 충전','noa_topup',$id,'verified_payment');
  ns_put($receipt,'subscription_receipt',['orderId'=>$id,'ownerId'=>$owner,'verifiedBy'=>$actor,'verifiedAt'=>$now],0,$actor);
  $d['state']='paid';$d['paidAt']=$now;$d['reference']=$reference;$d['verifiedBy']=$actor;ns_put($key,'membership_topup',$d,$r['revision'],$actor);nr_sync_member($owner,$now);return $d;
 });
}
