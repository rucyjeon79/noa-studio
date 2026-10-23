<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/lease-inbox.php';
$s=noa_engine_lease_new('e1','music');
$a=n80_lease_apply_fenced($s,'claim',100,null,10);
if(!$a['ok']||$a['state']['generation']!==1)exit(1);
$old=$a['state'];
$b=n80_lease_apply_fenced($old,'claim',111,null,10);
if(!$b['ok']||$b['state']['generation']!==2)exit(2);
$current=$b['state'];
if(n80_lease_apply_fenced($current,'ack',112,1)['ok'])exit(3);
if(n80_lease_apply_fenced($current,'fail',112,1)['ok'])exit(4);
if(n80_lease_apply_fenced($current,'ack',122,2)['ok'])exit(5);
$ack=n80_lease_apply_fenced($current,'ack',112,2);
if(!$ack['ok']||$ack['state']['status']!=='succeeded')exit(6);
echo "N80_LEASE_FENCING_OK\n";
