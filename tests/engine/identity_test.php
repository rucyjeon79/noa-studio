<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/identity.php';
$identity=n80_engine_identity();
if($identity['name']!=='N80 ENGINE'||$identity['legacyName']!=='NOA ENGINE'||$identity['runtimeActivation']!=='disabled')exit(1);
echo "N80_ENGINE_IDENTITY_OK\n";
