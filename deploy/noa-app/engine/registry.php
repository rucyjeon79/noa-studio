<?php
declare(strict_types=1);
/**
 * NOA ENGINE v1 read-only module registry.
 * No database connections, file writes, network calls or worker execution.
 */
require_once __DIR__.'/workspaces.php';
require_once __DIR__.'/jukebox.php';
function noa_engine_modules(): array {
    $modules = [
        'music' => ['label'=>'MUSIC','owner'=>'music','entry'=>'/noa-music.php','events'=>['audio.ready']],
        'jukebox' => n80_jukebox_module(),
        'youtube' => ['label'=>'YOUTUBE','owner'=>'youtube','entry'=>'/noa-youtube.php','events'=>['sync.requested','youtube.synced']],
        'world' => ['label'=>'NOA WORLD','owner'=>'world','entry'=>'/noa-world.php','events'=>['youtube.synced','world.updated']],
        'playlist' => ['label'=>'MY PLAYLIST','owner'=>'playlist','entry'=>'/noa-music.php#my-playlists','events'=>['audio.ready','playlist.updated']],
        'creator_lab'=>['label'=>'CREATOR LAB','owner'=>'creator_lab','entry'=>'/noa-channel-workspace.php','events'=>['audio.ready','playlist.updated']],
        'ai_lab' => ['label'=>'AI LAB','tools'=>array_keys(n80_lab_tools()),'owner'=>'ai_lab','entry'=>'/noa-ai-lab.php','events'=>['ai.requested','ai.completed','ai.failed']],
        'admin' => ['label'=>'홈페이지 설정','owner'=>'admin','entry'=>'/noa-library.php','events'=>['operation.requested','operation.approved','deploy.verified','work.completed']],
        'community' => ['label'=>'COMMUNITY','owner'=>'gnuboard','entry'=>'/bbs/board.php?bo_table=free','events'=>[]],
        'database' => ['label'=>'DATABASE','owner'=>'database','entry'=>'/noa-app/database/','events'=>[]],
    ];
    $modules += [
        'identity'=>['label'=>'회원·권한','owner'=>'identity','entry'=>'/noa-membership.php','events'=>[]],
        'commerce'=>['label'=>'결제·포인트·후원','owner'=>'commerce','entry'=>'/noa-support.php','events'=>[]],
        'notifications'=>['label'=>'알림','owner'=>'notifications','entry'=>'/noa-notifications.php','events'=>[]],
        'catalog'=>['label'=>'분류·곡 색인','owner'=>'catalog','entry'=>'/noa-app/taxonomy/','events'=>[]],
        'personalization'=>['label'=>'개인화·추천','owner'=>'personalization','entry'=>'/noa-music.php','events'=>[]],
        'app_lifecycle'=>['label'=>'앱 업데이트','owner'=>'app_lifecycle','entry'=>'/','events'=>[]],
    ];
    $sources=[
        'music'=>['noa-music.php'],
        'jukebox'=>array_merge(['noa-app/engine/jukebox.php'],array_values(n80_jukebox_module()['components'])),
        'youtube'=>['noa-youtube.php'], 'world'=>['noa-world.php'], 'playlist'=>['noa-playlists.js'],
        'creator_lab'=>['noa-channel-workspace.php','noa-app/engine/workspaces.php'],
        'ai_lab'=>array_values(array_unique(array_merge(['noa-app/engine/creative.php','noa-bridge/creative.php','noa-bridge/creative-core.php','noa-bridge/creative-publication.php','noa-bridge/muvy-core.php','noa-bridge/lab-publication.php','noa-app/engine/service-runtime.php','noa-ai-lab.php','noa-app/engine/ai-lab.php','noa-app/engine/explorer.php','noa-channel-explorer.js','noa-explorer.css','noa-ai-lab.js','noa-muvy-panel.php'],array_column(n80_lab_tools(),'page')))),
        'admin'=>['noa-library.php','noa-app/engine/workspaces.php'], 'community'=>['bbs/board.php'],
        'database'=>['noa-app/database/core.php'],
        'identity'=>['noa-bridge/member-access.php','noa-bridge/subscription-access.php','noa-app/engine/session-policy.php'],
        'commerce'=>['noa-bridge/support.php','noa-bridge/ainoa-points.php'],
        'notifications'=>['noa-bridge/notifications.php'],
        'catalog'=>['noa-app/taxonomy/index.php','noa-app/engine/personal-song-index.php'],
        'personalization'=>['noa-app/engine/personal-listening.php'],
        'app_lifecycle'=>['noa-app/engine/app-lifecycle.php'],
    ];
    $observes=[
        'music'=>['music','media','taxonomy'],'jukebox'=>['jukebox','media'],'playlist'=>['playlist','music'],
        'youtube'=>['youtube','taxonomy'],'world'=>['world','youtube'],'creator_lab'=>['music','playlist','youtube'],
        'ai_lab'=>['ai_lab'],'admin'=>['admin','settings','members'],'community'=>['community','members'],
        'database'=>['database'],'identity'=>['members'],'commerce'=>[],
        'notifications'=>[],'catalog'=>['taxonomy'],'personalization'=>['ranking'], 'app_lifecycle'=>[],
    ];
    foreach($modules as $id=>&$module){$module['sources']=$sources[$id];$module['observes']=$observes[$id];}
    unset($module);return $modules;
}
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
    return ['schemaVersion'=>1,'engine'=>'N80 Engine','workspaces'=>n80_workspaces(),'controller'=>'Chat Assistant','mode'=>'read_only','modules'=>array_values($modules)];
}
