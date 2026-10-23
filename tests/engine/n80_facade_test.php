<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/n80.php';
$s=n80_engine_snapshot(dirname(__DIR__,2).'/deploy');
if($s['identity']['name']!=='N80 ENGINE'||!$s['audit']['ok']||$s['dispatchEnabled']!==false)exit(1);
echo "N80_ENGINE_FACADE_OK\n";
