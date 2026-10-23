<?php
declare(strict_types=1);
require_once dirname(__DIR__, 2) . '/deploy/noa-app/engine/registry.php';
$actual = noa_engine_registry_snapshot();
if ($actual['mode'] !== 'read_only' || count($actual['modules']) !== 9) {
    fwrite(STDERR, "Engine registry contract failed\n"); exit(1);
}
$ids = array_column($actual['modules'], 'id');
if (count($ids) !== count(array_unique($ids))) { fwrite(STDERR,"Duplicate module IDs\n");exit(1); }
foreach ($actual['modules'] as $module) {
    if ($module['health'] !== 'not_checked' || $module['status'] !== 'registered') {
        fwrite(STDERR,"Invalid inferred module status\n");exit(1);
    }
}
echo "NOA_ENGINE_REGISTRY_OK\n";
