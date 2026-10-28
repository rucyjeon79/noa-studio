<?php
require __DIR__.'/../subscription/native_fixture.php';require __DIR__.'/../../bridge/membership-core.php';require __DIR__.'/../../bridge/engagement-core.php';
$now=(new DateTimeImmutable('2026-10-28 12:00:00',new DateTimeZone('Asia/Seoul')))->getTimestamp();
if($argv[1]==='activity'){nr_pending_login('month_race',$now);$r=nr_reward('month_race','write','free',(int)$argv[2],$now);}
else{$db=new PDO(getenv('NOA_MYSQL_DSN'),getenv('NOA_MYSQL_USER'),getenv('NOA_MYSQL_PASSWORD'),[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$entity='song:race:'.$argv[2];ne_like($db,$entity,'month_like_race',true,false,$now);$r=nmb_like('month_like_race',$entity,$now);}
echo json_encode($r);
