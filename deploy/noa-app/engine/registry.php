<?php
declare(strict_types=1);
/**
 * NOA ENGINE v1 read-only module registry.
 * No database connections, file writes, network calls or worker execution.
 */
function noa_engine_modules(): array {
    return [
        'music' => ['label'=>'MUSIC','owner'=>'music','entry'=>'/noa-music.php','events'=>['audio.ready','playback.started']],
        'jukebox' => ['label'=>'JUKEBOX','owner'=>'jukebox','entry'=>'/noa-app/jukebox/','events'=>['upload.requested','audio.ready','audio.failed']],
        'youtube' => ['label'=>'YOUTUBE','owner'=>'youtube','entry'=>'/noa-youtube.php','events'=>['sync.requested','youtube.synced']],
        'world' => ['label'=>'NOA WORLD','owner'=>'world','entry'=>'/noa-world.php','events'=>['youtube.synced','world.updated']],
        'playlist' => ['label'=>'MY PLAYLIST','owner'=>'playlist','entry'=>'/noa-music.php#my-playlists','events'=>['audio.ready','playlist.updated']],
        'ai_lab' => ['label'=>'AI LAB','owner'=>'ai_lab','entry'=>'/noa-ai-lab.php','events'=>['ai.requested','ai.completed','ai.failed']],
        'admin' => ['label'=>'ADMIN','owner'=>'admin','entry'=>'/noa-settings.php','events'=>['operation.requested','operation.approved','deploy.verified','work.completed']],
        'community' => ['label'=>'COMMUNITY','owner'=>'gnuboard','entry'=>'/bbs/board.php?bo_table=free','events'=>[]],
        'database' => ['label'=>'DATABASE','owner'=>'database','entry'=>'/noa-app/database/','events'=>[]],
    ];
}
function noa_engine_registry_snapshot(): array {
    $modules = noa_engine_modules();
    foreach ($modules as $id => &$module) {
        $module['id'] = $id;
        $module['status'] = 'registered';
        $module['health'] = 'not_checked';
    }
    unset($module);
    return ['schemaVersion'=>1,'engine'=>'NOA ENGINE','controller'=>'Chat Assistant','mode'=>'read_only','modules'=>array_values($modules)];
}
