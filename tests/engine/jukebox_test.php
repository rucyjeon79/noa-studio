<?php
require __DIR__.'/../../deploy/noa-app/engine/registry.php';
$modules=noa_engine_modules();$module=$modules['jukebox'];
if($module['label']!=='N80 JukeBox'||$module['runtime']['api']!=='N80JukeBox'||$module['owner']!=='jukebox')throw new RuntimeException('jukebox_owner');
foreach($module['components'] as $source)if(!is_file(__DIR__.'/../../deploy/'.$source))throw new RuntimeException('missing_jukebox_component:'.$source);
if(in_array('playback.started',$modules['music']['events'],true)||!in_array('playback.started',$module['events'],true))throw new RuntimeException('duplicate_playback_owner');
echo "N80_JUKEBOX_SINGLE_OWNER_OK\n";
