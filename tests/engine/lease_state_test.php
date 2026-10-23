<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/lease-state.php';
$dir=sys_get_temp_dir().'/n80-lease-state-'.getmypid();mkdir($dir,0700);
$a=n80_lease_state_transition($dir,'event1','music','claim',100,null,10);
if(!$a['ok']||$a['state']['generation']!==1)exit(1);
$b=n80_lease_state_transition($dir,'event1','music','claim',111,null,10);
if(!$b['ok']||$b['state']['generation']!==2)exit(2);
$c=n80_lease_state_transition($dir,'event1','music','ack',112,1,10);
if($c['ok']||$c['error']!=='stale_lease_generation')exit(3);
$d=n80_lease_state_transition($dir,'event1','music','ack',112,2,10);
if(!$d['ok']||$d['state']['status']!=='succeeded')exit(4);
$e=n80_lease_state_transition($dir,'event1','music','claim',113,null,10);
if($e['ok'])exit(5);
foreach(glob($dir.'/{*,.*}',GLOB_BRACE) as $f)if(is_file($f))unlink($f);
rmdir($dir);
echo "N80_DURABLE_LEASE_STATE_OK\n";
