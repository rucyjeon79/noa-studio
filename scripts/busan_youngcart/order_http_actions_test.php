<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/busan/youngcart/pointzone-actions.php';
function ckAction($v):void{if(!$v)throw new RuntimeException('action assertion');}
function rejectsAction(callable $fn):void{try{$fn();}catch(DomainException $e){return;}throw new RuntimeException('unexpected dispatch');}
$called=0;$a=new BusanPointZoneActions(function($action,$member,$cart,$post)use(&$called){$called++;return ['action'=>$action,'member'=>$member,'cart'=>$cart];});
$actor=['member'=>'alice','active'=>true,'super'=>false];$admin=['member'=>'admin','active'=>true,'super'=>true];$cart='123456789012345';
$post=['action'=>'purchase','csrf'=>'token','request_id'=>str_repeat('1',32)];
ckAction($a->handle($actor,'token',$cart,'POST',$post)['member']==='alice');
foreach(['member'=>'bob','amount'=>'1','method'=>'CASH','cart'=>$cart] as $key=>$value)rejectsAction(fn()=>$a->handle($actor,'token',$cart,'POST',$post+[$key=>$value]));
rejectsAction(fn()=>$a->handle($actor,'token',$cart,'GET',$post));
rejectsAction(fn()=>$a->handle($actor,'other',$cart,'POST',$post));
rejectsAction(fn()=>$a->handle(['member'=>'alice','active'=>false],'token',$cart,'POST',$post));
$review=['action'=>'review_pending','csrf'=>'token','order'=>$cart,'target'=>'bob'];
rejectsAction(fn()=>$a->handle($actor,'token',$cart,'POST',$review));
ckAction($a->handle($admin,'token',$cart,'POST',$review)['action']==='review_pending');
$finish=['action'=>'finish_pending','csrf'=>'token','order'=>$cart,'target'=>'bob','point_id'=>'42'];
ckAction($a->handle($admin,'token',$cart,'POST',$finish)['action']==='finish_pending');
rejectsAction(fn()=>$a->handle($admin,'token',$cart,'POST',array_replace($finish,['point_id'=>'-1'])));
$set=['action'=>'cart_set','csrf'=>'token','item'=>str_repeat('a',20),'qty'=>'1'];
ckAction($a->handle($actor,'token',$cart,'POST',$set)['action']==='cart_set');
rejectsAction(fn()=>$a->handle($actor,'token',$cart,'POST',array_replace($set,['qty'=>'0'])));
rejectsAction(fn()=>$a->handle($actor,'token',$cart,'POST',array_replace($set,['qty'=>['1']])));
ckAction($called===4);
require __DIR__.'/../../deploy/busan/youngcart/checkout-readiness.php';
rejectsAction(fn()=>BusanCheckoutReadiness::liveCheckout());
echo "BUSAN_POINTZONE_HTTP_ACTIONS_OK\n";
