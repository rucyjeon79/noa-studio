<?php
declare(strict_types=1);
require_once __DIR__.'/registry.php';
/** Read-only local source inventory; no DB, external HTTP or execution. */
function noa_engine_health_snapshot(string $root): array {
    $modules=noa_engine_registry_snapshot()['modules'];
    $sources=[
        'music'=>['noa-music.php'],
        'jukebox'=>['noa-app/jukebox/index.php','noa-app/jukebox/queue-core.php'],
        'youtube'=>['noa-youtube.php'],
        'world'=>['noa-world.php'],
        'playlist'=>['noa-playlists.js'],
        'ai_lab'=>array_unique(array_merge(['noa-ai-lab.php','noa-app/engine/ai-lab.php','noa-app/engine/explorer.php','noa-channel-explorer.js','noa-explorer.css','noa-ai-lab.js','noa-muvy-panel.php'],array_column(n80_lab_tools(),'page'))),
        'admin'=>['noa-settings.php'],
        'community'=>['bbs/board.php'],
        'database'=>['noa-app/database/core.php'],
    ];
    foreach ($modules as &$module) {
        $paths=$sources[$module['id']]??[];
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
