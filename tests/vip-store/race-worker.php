<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/vip-store-core.php';
if(!str_contains((string)getenv('NOA_MYSQL_DSN'),'dbname=noa_subscription_test;'))throw new RuntimeException('isolated_database_required');
$o=nv_buy('v_race','de000000-0000-4000-8000-000000000010',[['productId'=>'vip30','quantity'=>1]],1793441400);echo json_encode($o);
