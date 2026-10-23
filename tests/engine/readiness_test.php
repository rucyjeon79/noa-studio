<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/readiness.php';
$r=n80_engine_readiness(dirname(__DIR__,2).'/deploy');
if($r['operationalReady']!==false||$r['automaticDispatch']!=='disabled'||!$r['legacyPreserved'])exit(1);
if(count($r['gates'])!==6)exit(2);
echo "N80_ENGINE_READINESS_OK\n";
