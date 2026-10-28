<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/toss-core.php';
if(!str_contains((string)getenv('NOA_MYSQL_DSN'),'dbname=noa_subscription_test;'))throw new RuntimeException('isolated_database_required');
$p=json_decode(file_get_contents('/tmp/noa-toss-race.json'),true);echo json_encode(nt_view(nt_apply('bc000000-0000-4000-8000-000000000005',$p,time())));
