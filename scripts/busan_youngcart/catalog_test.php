<?php
define('_GNUBOARD_',true);
require __DIR__.'/../../deploy/busan/youngcart/theme/Busan_PointZone/lib/catalog.php';
function reject($f){try{$f();}catch(DomainException $e){return;}throw new RuntimeException('invalid input accepted');}
$d=BusanCatalog::draft(['category'=>'a1','name'=>'테스트','price'=>'100','stock'=>'0']);
if($d['price']!==100||$d['stock']!==0)throw new RuntimeException('valid draft');
foreach(['-1','0','1.5','1e3','2147483648','01',[],null] as $v)reject(fn()=>BusanCatalog::number($v,1));
reject(fn()=>BusanCatalog::category('00'));reject(fn()=>BusanCatalog::category('a!'));reject(fn()=>BusanCatalog::text(str_repeat('가',101),100));reject(fn()=>BusanCatalog::item('invalid'));reject(fn()=>BusanCatalog::mutate('item_create',[]));
echo "BUSAN_CATALOG_DRAFT_CONTRACT_OK\n";
