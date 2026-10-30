<?php
require __DIR__.'/../payments/fixture.php';
foreach(['noa-vip.php','noa-vip.js','noa-vip.css']as $f)copy('deploy/'.$f,$root.'/'.$f);
foreach(glob('deploy/noa-assets/vip-*.webp')as $f)copy($f,$root.'/noa-assets/'.basename($f));
require_once __DIR__.'/../../bridge/vip-store-core.php';
// Only catalog data is server rendered. Purchase and account responses are isolated browser mocks.
$page=file_get_contents($root.'/noa-vip.php');$page=str_replace("require_once __DIR__.'/noa-bridge/vip-store-core.php';",'', $page);$page=str_replace('nv_products()',var_export(nv_products(),true),$page);$page=str_replace('<html lang="ko">','<html lang="ko" data-noa-style="starlight">',$page);$page=str_replace('</head>','<link rel="stylesheet" href="/noa-starlight.css"></head>',$page);file_put_contents($root.'/noa-vip.php',$page);
echo "VIP_STORE_FIXTURE_READY\n";
