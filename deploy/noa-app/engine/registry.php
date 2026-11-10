<?php
declare(strict_types=1);
/**
 * NOA ENGINE v1 read-only module registry.
 * No database connections, file writes, network calls or worker execution.
 */
require_once __DIR__.'/workspaces.php';
require_once __DIR__.'/jukebox.php';
require_once __DIR__.'/module-contract.php';
// Preserve an installed Hub while its source/activation remains owned by the Hub release.
if(is_file(__DIR__.'/hub.php'))require_once __DIR__.'/hub.php';
function noa_engine_modules(): array {
    $modules = [
        'music' => ['label'=>'MUSIC','owner'=>'music','entry'=>'/noa-music.php','events'=>['audio.ready']],
        'jukebox' => n80_jukebox_module(),
        'youtube' => ['label'=>'YOUTUBE','owner'=>'youtube','entry'=>'/noa-youtube.php','events'=>['sync.requested','youtube.synced']],
        'world' => ['label'=>'NOA WORLD','owner'=>'world','entry'=>'/noa-world.php','events'=>['youtube.synced','world.updated']],
        'playlist' => ['label'=>'MY PLAYLIST','owner'=>'playlist','entry'=>'/noa-music.php#my-playlists','events'=>['audio.ready','playlist.updated']],
        'creator_lab'=>['label'=>'CREATOR LAB','owner'=>'creator_lab','entry'=>'/noa-channel-workspace.php','events'=>['audio.ready','playlist.updated']],
        'admin' => ['label'=>'홈페이지 설정','owner'=>'admin','entry'=>'/noa-library.php','events'=>['operation.requested','operation.approved','deploy.verified','work.completed']],
        'community' => ['label'=>'COMMUNITY','owner'=>'gnuboard','entry'=>'/bbs/board.php?bo_table=free','events'=>[]],
    ];
    $modules += [
        'catalog'=>['label'=>'분류·곡 색인','owner'=>'catalog','entry'=>'/noa-app/taxonomy/','events'=>[]],
        'personalization'=>['label'=>'개인화·추천','owner'=>'personalization','entry'=>'/noa-music.php','events'=>[]],
    ];
    $sources=[
        'music'=>['noa-music.php'],
        'jukebox'=>array_merge(['noa-app/engine/jukebox.php'],array_values(n80_jukebox_module()['components'])),
        'youtube'=>['noa-youtube.php'], 'world'=>['noa-world.php'], 'playlist'=>['noa-playlists.js'],
        'creator_lab'=>['noa-app/engine/creator-lab.php','noa-channel-workspace.php','noa-app/engine/workspaces.php'],
        'admin'=>['noa-library.php','noa-app/engine/workspaces.php'], 'community'=>['bbs/board.php'],
        'catalog'=>['noa-app/engine/catalog.php','noa-app/taxonomy/index.php','noa-app/engine/personal-song-index.php'],
        'personalization'=>['noa-app/engine/personalization.php','noa-app/engine/personal-listening.php'],
    ];
    $observes=[
        'music'=>['music','media','taxonomy'],'jukebox'=>['jukebox','media'],'playlist'=>['playlist','music'],
        'youtube'=>['youtube','taxonomy'],'world'=>['world','youtube'],'creator_lab'=>['music','playlist','youtube'],
        'admin'=>['admin','settings','members'],'community'=>['community','members'],
    ];
    $observes+=['catalog'=>['taxonomy'],'personalization'=>['ranking']];
    if(function_exists('n80_hub_module')){
        $modules['hub']=n80_hub_module();
        $sources['hub']=['noa-hub.php','noa-hub-owner.php','noa-app/engine/hub.php','noa-app/engine/hub-release.php','noa-app/engine/hub-specialists.php','noa-app/engine/hub-covers.php','noa-app/engine/hub-chatgpt.php','noa-bridge/hub-worker.php','noa-bridge/hub-admin.php'];
        $observes['hub']=['admin'];
    }
    foreach($modules as $id=>&$module){$module['sources']=$sources[$id];$module['observes']=$observes[$id];}
    unset($module);return $modules+n80_specialist_modules();
}
function n80_module(string $id):?array {return noa_engine_modules()[n80_module_id($id)]??null;}

/** Every operational audit derives its module links from the same registry as source inventory. */
function n80_module_links():array {return array_map(static fn(array $module):array=>$module['observes'],noa_engine_modules());}

function noa_engine_registry_snapshot(): array {
    $modules = noa_engine_modules();
    foreach ($modules as $id => &$module) {
        $module['id'] = $id;
        $module['status'] = 'registered';
        $module['health'] = 'not_checked';
    }
    unset($module);
    return ['schemaVersion'=>1,'engine'=>'N80 Engine','workspaces'=>n80_workspaces(),'controller'=>'Chat Assistant','mode'=>'read_only','moduleAliases'=>n80_module_aliases(),'modules'=>array_values($modules)];
}
