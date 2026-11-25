<?php
declare(strict_types=1);
require __DIR__.'/../../deploy/busan/youngcart/point-contract.php';
function check($v,$name){if(!$v)throw new RuntimeException($name);echo "PASS $name\n";}
function reject($fn,$name){try{$fn();}catch(DomainException $e){check(true,$name);return;}throw new RuntimeException($name);}
$cart=[['price'=>1500,'qty'=>2,'stock'=>3],['price'=>2000,'qty'=>1,'stock'=>1]];
check(BusanPointOnlyPolicy::quote($cart,5000)===5000,'exact balance allowed');
reject(fn()=>BusanPointOnlyPolicy::quote($cart,4999),'insufficient points rejected');
reject(fn()=>BusanPointOnlyPolicy::quote([['price'=>10,'qty'=>2,'stock'=>1]],100),'stock rejected');
reject(fn()=>BusanPointOnlyPolicy::quote([['price'=>0,'qty'=>1,'stock'=>1]],100),'zero rejected');
reject(fn()=>BusanPointOnlyPolicy::quote([['price'=>PHP_INT_MAX,'qty'=>2,'stock'=>2]],PHP_INT_MAX),'overflow rejected');
$request=['method'=>'POINT','request_id'=>str_repeat('a',32),'csrf'=>'test'];
BusanPointOnlyPolicy::authorize($request,5000);check(true,'point method accepted');
foreach(['CARD','BANK','CASH','VIRTUAL','MOBILE','KAKAO','PG'] as $m)
    reject(fn()=>BusanPointOnlyPolicy::authorize(array_replace($request,['method'=>$m]),5000),'reject '.$m);
reject(fn()=>BusanPointOnlyPolicy::authorize($request+['cash_amount'=>1],5000),'reject mixed payment');
reject(fn()=>BusanPointOnlyPolicy::authorize($request+['price'=>1],5000),'reject client price override');
echo "BUSAN_POINT_ONLY_CONTRACT_OK\n";
