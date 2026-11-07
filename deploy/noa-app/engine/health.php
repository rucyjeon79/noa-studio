<?php
declare(strict_types=1);
require_once __DIR__.'/registry.php';
/** Read-only local source inventory; no DB, external HTTP or execution. */
function noa_engine_health_snapshot(string $root): array {
    $modules=noa_engine_registry_snapshot()['modules'];
    foreach ($modules as &$module) {
        $paths=$module['sources'];
        $present=true;
        foreach ($paths as $relative) {
            if (!is_file(rtrim($root,'/').'/'.$relative)) { $present=false; break; }
        }
        $module['sourcePresence']=$present?'present':'missing';
        $module['health']='not_checked';
        $module['status']='registered';
    }
    unset($module);
    return ['schemaVersion'=>1,'engine'=>'NOA ENGINE','mode'=>'read_only','checkedAt'=>gmdate('c'),'modules'=>$modules];
}
