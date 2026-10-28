<?php
require __DIR__.'/../navigation/fixture.php';
foreach(glob('bridge/*.php') as $file)copy($file,$root.'/noa-bridge/'.basename($file));
// Render the real song page; the PWA fixture's placeholder cannot catch hidden paths.
@mkdir($root.'/noa-app/jukebox',0700,true);
foreach(['noa-music.php','noa-music.css','noa-music-detail.php','noa-history.js','noa-playlists.js','noa-playcount.js','noa-app/p0-player.js','noa-app/p0-media.css','noa-app/jukebox/core.php','noa-app/jukebox/upload.css','noa-creator.php','noa-creator.js','noa-creator.css','noa-channel-menu.php','noa-channel-explorer.js','noa-channel-controls.js','noa-channel-rules.php','noa-channel-rules.js','noa-creator-symbol.php']as $file)copy('deploy/'.$file,$root.'/'.$file);
foreach(['noa-record-form.js','noa-record-form.css','noa-quality.php','noa-quality.js','noa-quality.css','noa-library.php','noa-workspace.php','noa-catalog.php','noa-catalog.js','noa-record-action.php','noa-inline-edit.php','noa-editor.php','noa-ai-lab.php','noa-ai-lab.js','noa-ai-lab.css','noa-workspace.js','noa-muvy-panel.php','noa-muvy.css','noa-muvy.js','noa-sitemap.php']as $file)copy('deploy/'.$file,$root.'/'.$file);
$common=file_get_contents($root.'/common.php');$common=str_replace("\$role=\$_COOKIE", "if((\$_SERVER['HTTP_ORIGIN']??'')==='http://127.0.0.1:8079')\$_SERVER['HTTP_ORIGIN']='https://noastudio.ai.kr';\$role=\$_COOKIE",$common);file_put_contents($root.'/common.php',$common);
echo "WORKSPACE_HTTP_FIXTURE_READY\n";
