<?php
require __DIR__.'/fixture.php';
copy('deploy/noa-starlight.css',$root.'/noa-starlight.css');
$page=<<<'HTML'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-starlight.css"><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main><h1>메뉴 검증</h1><p>기존 페이지의 본문</p></main></body></html>
HTML;
foreach(['menu-fixture.php','noa-lounge.php','noa-shop.php']as $file)file_put_contents($root.'/'.$file,$page);
file_put_contents($root.'/bbs/board.php',str_replace("__DIR__.'/common.php'","dirname(__DIR__).'/common.php'",$page));

// Real home template and assets, with deterministic read-only API data.
foreach(['noa-home.js','noa-ecosystem-links.js']as $file)copy('deploy/'.$file,$root.'/'.$file);
@mkdir($root.'/noa-assets/splash',0700,true);
foreach(['kpop-original-g2-a','joseon-g2-a','your-story-g2-a','cover-reborn-g2-a']as $image)copy('public/splash/'.$image.'.jpg',$root.'/noa-assets/splash/'.$image.'.jpg');
$rows=[];for($i=0;$i<12;$i++)$rows[]=['videoId'=>'audit'.$i,'title'=>'검증 음악 '.$i,'href'=>'/noa-music.php','thumbnail'=>'/noa-assets/papa-logo.png','views'=>1250000,'score'=>1250000,'jukeboxPlays'=>0,'genre'=>'kpop-original'];
file_put_contents($root.'/home-audit.json',json_encode(['ok'=>true,'featured'=>$rows,'ep'=>$rows,'stories'=>$rows,'covers'=>$rows,'playlists'=>$rows,'collectedAt'=>'2026-10-29T00:00:00Z']));
$router=file_get_contents($root.'/router.php');$router=str_replace("if(str_starts_with(\$path,'/noa-bridge/'))", "if(\$path==='/noa-bridge/home.php'){header('Content-Type: application/json');readfile(__DIR__.'/home-audit.json');return true;}\nif(str_starts_with(\$path,'/noa-bridge/'))",$router);file_put_contents($root.'/router.php',$router);
$home=file_get_contents($root.'/noa-app/home.php');$home=str_replace('</head>','<script src="/noa-ecosystem-links.js" defer></script></head>',$home);file_put_contents($root.'/noa-app/home.php',$home);
