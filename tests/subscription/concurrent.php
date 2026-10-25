<?php
require __DIR__.'/native_fixture.php';try{$r=ns_create_order($argv[1],$argv[2],'vip','points',1800000000,1);echo json_encode(['ok'=>true,'status'=>$r['status']]);}catch(DomainException $e){echo json_encode(['ok'=>false,'error'=>$e->getMessage()]);}
