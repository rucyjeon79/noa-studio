<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/lease-inbox.php';
$s=noa_engine_lease_new('e1','music');
$a=noa_engine_lease_apply($s,'claim',100,10);if(!$a['ok'])exit(1);$s=$a['state'];
if(noa_engine_lease_apply($s,'claim',105,10)['ok'])exit(2);
$a=noa_engine_lease_apply($s,'claim',111,10);if(!$a['ok']||$a['state']['attempts']!==2)exit(3);
$a=noa_engine_lease_apply($a['state'],'ack',112);if(!$a['ok']||$a['state']['status']!=='succeeded')exit(4);
if(noa_engine_lease_apply($a['state'],'claim',120)['ok'])exit(5);
echo "NOA_ENGINE_LEASE_INBOX_OK\n";
