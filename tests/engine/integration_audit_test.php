<?php
declare(strict_types=1);
require_once dirname(__DIR__,2).'/deploy/noa-app/engine/integration-audit.php';
$r=noa_engine_integration_audit(dirname(__DIR__,2).'/deploy');
if(!$r['ok']||$r['automaticDispatch']!=='disabled')exit(1);
if(count($r['checks'])!==7)exit(2);
echo "NOA_ENGINE_INTEGRATION_AUDIT_OK\n";
