<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/health.php';
$root=sys_get_temp_dir().'/noa-engine-test-'.getmypid();
mkdir($root,0700,true);
$snapshot=noa_engine_health_snapshot($root);
if(count($snapshot['modules'])!==9)exit(1);
foreach($snapshot['modules'] as $m){
 if($m['health']!=='not_checked'||$m['sourcePresence']!=='missing')exit(2);
}
rmdir($root);
echo "NOA_ENGINE_HEALTH_CONTRACT_OK\n";
