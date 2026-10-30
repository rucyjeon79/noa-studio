<?php
require __DIR__.'/fixture.php';
copy('deploy/noa-starlight.css',$root.'/noa-starlight.css');
$page=<<<'HTML'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-starlight.css"><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main><h1>메뉴 검증</h1><p>기존 페이지의 본문</p></main></body></html>
HTML;
foreach(['menu-fixture.php','noa-lounge.php','noa-shop.php']as $file)file_put_contents($root.'/'.$file,$page);
file_put_contents($root.'/bbs/board.php',str_replace("__DIR__.'/common.php'","dirname(__DIR__).'/common.php'",$page));
