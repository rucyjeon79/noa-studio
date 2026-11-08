<?php
declare(strict_types=1);
/** N80 JukeBox contract. Metadata only; never initializes audio, SQL or a worker. */
function n80_jukebox_module(): array {
    return [
        'label'=>'N80 JukeBox','owner'=>'jukebox','entry'=>'/noa-music.php',
        'managementEntry'=>'/noa-app/jukebox/',
        'events'=>['upload.requested','audio.ready','audio.failed','playback.started'],
        'runtime'=>['api'=>'N80JukeBox','scope'=>'one_audio_per_document','activation'=>'music_view',
            'state'=>'existing_tab_checkpoint','nativeBackend'=>'existing_android_bridge'],
        'components'=>[
            'references'=>'noa-app/engine/jukebox-references.php',
            'playback'=>'noa-app/jukebox/player.js',
            'presentation'=>'noa-app/jukebox/presentation.js',
            'systemMedia'=>'noa-app/jukebox/system-media.js',
            'navigation'=>'noa-app/jukebox/navigation-policy.js',
            'recovery'=>'noa-app/playback-recovery.js',
            'playlists'=>'noa-playlists.js','counting'=>'noa-playcount.js',
            'upload'=>'noa-app/jukebox/index.php','processing'=>'noa-app/jukebox/queue-core.php',
        ],
    ];
}
