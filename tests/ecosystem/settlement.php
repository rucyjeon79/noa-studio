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
