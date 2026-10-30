<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/support-core.php';
function ck($v,$m){if(!$v)throw new RuntimeException($m);}function nope($f,$m){try{$f();}catch(DomainException|InvalidArgumentException $e){ck($e->getMessage()===$m,$e->getMessage());return;}throw new RuntimeException('missing_'.$m);}
$config['cf_admin']='s_admin';$sender='s_empty';$owner='s_other';$id='ab000000-0000-4000-8000-000000000050';$key='support:receipt:'.hash('sha256',$sender.'|'.$id);
$target=['owner'=>$owner,'channelId'=>hash('sha256',$owner),'channelTitle'=>'수령 채널','entity'=>'song:refund','title'=>'환불 검수'];$input=['type'=>'music','key'=>'refund','channelId'=>$target['channelId'],'entity'=>$target['entity'],'amount'=>5,'message'=>'검수','confirmed'=>true];nsp_send($sender,$id,$input,fn()=>$target);
$dash=nspp_dashboard($owner);ck($dash['metrics']['eligible']===0&&$dash['metrics']['unverifiedPoints']===5,'unknown_not_cash');nope(fn()=>nspp_request($owner,'ab000000-0000-4000-8000-000000000051','personal'),'cash_settlement_pending');
nspp_refund_request($sender,$key,'중복으로 잘못 보냈어요');nspp_refund_review('s_admin',['key'=>$key,'decision'=>'refunded','reference'=>'검수 근거']);nspp_refund_review('s_admin',['key'=>$key,'decision'=>'refunded','reference'=>'검수 근거']);ck(get_point_sum($sender)===10,'refund_once');ck(nsp_wallet($owner)['data']['received']===0,'wallet_restored');
nope(fn()=>nspp_policy_save('s_other',['enabled'=>true]),'administrator_required');
$funding=nspp_funding([1=>['used'=>0]],[1=>['used'=>600,'paid'=>['order'=>'paid-order','pointId'=>1],'free'=>false]],1000);ck($funding['paid']===600&&$funding['unverified']===400,'funding_split');
// A verified source is invalidated conservatively if its payment is reversed.
ns_atomic('test-paid',false,fn()=>ns_put('toss:order:test-paid','payment',['mode'=>'live','state'=>'paid','credited'=>true,'paidReversed'=>0],0,'s_admin'));
$d=['funding'=>['paid'=>100,'sources'=>[['order'=>'test-paid','amount'=>100]]]];ck(nspp_eligible($d)===100,'verified_eligible');$r=ns_doc('toss:order:test-paid');$r['data']['state']='canceled';ns_atomic('test-paid',false,fn()=>ns_put('toss:order:test-paid','payment',$r['data'],$r['revision'],'s_admin'));ck(nspp_eligible($d)===0,'canceled_not_eligible');
echo "SETTLEMENT_FAIL_CLOSED_PROVENANCE_REFUND_REPLAY_OK\n";
// Full approval state machine, isolated documents only.
nspp_policy_save('s_admin',['enabled'=>true,'legalReviewed'=>true,'providerReviewed'=>true,'taxReviewed'=>true,'reference'=>'isolated fixture approval']);
nspp_profile($owner,['kind'=>'personal','note'=>'fixture']);nspp_profile_review('s_admin',['owner'=>$owner,'status'=>'verified','reference'=>'fixture identity']);
$paidId='ab000000-0000-4000-8000-000000000060';$receiptKey='support:receipt:'.hash('sha256','s_race|'.$paidId);$input['amount']=100;
nsp_send('s_race',$paidId,$input,fn()=>$target);
ns_atomic('source-fixture',false,fn()=>ns_put('toss:order:verified-fixture','payment',['mode'=>'live','state'=>'paid','credited'=>true,'paidReversed'=>0],0,'s_admin'));
$rr=ns_doc($receiptKey);$rr['data']['funding']=['paid'=>100,'free'=>0,'unverified'=>0,'sources'=>[['order'=>'verified-fixture','amount'=>100]]];ns_atomic('source-fixture',false,fn()=>ns_put($receiptKey,'support_receipt',$rr['data'],$rr['revision'],'s_admin'));
$reqId='ab000000-0000-4000-8000-000000000061';$req=nspp_request($owner,$reqId,'personal');ck($req['gross']===100,'only_verified_reserved');$sk='support:settlement:'.hash('sha256',$owner.'|'.$reqId);
nope(fn()=>nspp_review('s_admin',['key'=>$sk,'decision'=>'paid','reference'=>'bad','externalPaidConfirmed'=>true]),'external_payment_confirmation_required');
nspp_review('s_admin',['key'=>$sk,'decision'=>'verified','reference'=>'transactions checked']);nspp_review('s_admin',['key'=>$sk,'decision'=>'approved','reference'=>'tax approved','taxWon'=>3,'net'=>97,'classification'=>'fixture only']);nspp_review('s_admin',['key'=>$sk,'decision'=>'paid','reference'=>'external fixture payment','externalPaidConfirmed'=>true]);
ck(nsp_wallet($owner)['data']['paid']===100&&nsp_wallet($owner)['data']['reserved']===0,'approved_paid_ledger');
nope(fn()=>nspp_refund_request('s_race',$receiptKey,'bad'),'settlement_in_progress');
echo "SETTLEMENT_APPROVAL_STATE_MACHINE_PAID_ORIGIN_ONLY_OK\n";
