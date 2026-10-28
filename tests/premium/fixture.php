<?php
require __DIR__.'/../rhythm/fixture.php';
foreach(['noa-premium.js','noa-creator.js']as $f)copy('deploy/'.$f,$root.'/'.$f);
@mkdir($root.'/noa-app/jukebox',0700,true);foreach(['upload.js','upload.css','upload-transport.js']as $f)copy('deploy/noa-app/jukebox/'.$f,$root.'/noa-app/jukebox/'.$f);
copy('public/coming/kpop-original.jpg',$root.'/cover.jpg');
$h=file_get_contents($root.'/rhythm-music.php');$h=str_replace('</head>','<meta name="noa-jukebox-csrf" content="fixture"><link rel="stylesheet" href="/noa-app/jukebox/upload.css"><script src="/noa-premium.js" defer></script><script src="/noa-app/jukebox/upload-transport.js" defer></script><script src="/noa-app/jukebox/upload.js" defer></script></head>',$h);
$h=str_replace('</main>','<div id="songs" hidden><article class="song" data-key="fixture-song" data-jukebox-key="fixture-song" data-jukebox-status="processing" data-title="하루의 끝에" data-ep="1" data-genre="kpop-original" data-audio="/fixture.mp3" data-audio-sha="'.str_repeat('a',64).'"><span class="info"><strong>하루의 끝에</strong><small></small></span><div class="jukebox-actions"></div></article></div><div class="noa-transport" aria-label="음악 플레이어"><button>재생</button></div></main>',$h);file_put_contents($root.'/premium-music.php',$h);echo "PREMIUM_FIXTURE_READY\n";
