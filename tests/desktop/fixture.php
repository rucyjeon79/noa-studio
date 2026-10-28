<?php
/** Disposable native page bootstraps; production APIs are never mutated by browser QA. */
require __DIR__.'/../navigation/fixture.php';
foreach(['noa-notifications.js','noa-ainoa.js','noa-ainoa.css','noa-ainoa-admin.js','noa-desktop.js','noa-desktop.css','noa-member-badges.js','noa-member-badges.css','noa-app/p0-media.css']as $file)copy('deploy/'.$file,$root.'/'.$file);
@mkdir($root.'/noa-assets/splash',0700,true);copy('public/splash/kpop-original-g2-a.jpg',$root.'/noa-assets/splash/kpop-original-g2-a.jpg');
copy('public/ainoa/ainoa-symbol.png',$root.'/noa-assets/ainoa-symbol.png');
$common=file_get_contents($root.'/common.php');
$common=str_replace("'mb_level'=>\$role==='vip'?4:3", "'mb_nick'=>'검증 아티스트','mb_level'=>['admin'=>10,'vip'=>4,'five'=>5,'six'=>6][\$role]??3",$common);
$common=str_replace("require __DIR__.'/extend/noa.design.php';", "require __DIR__.'/extend/noa.design.php';ob_start(static fn(\$html)=>str_replace('</head>','<link rel=\"stylesheet\" href=\"/noa-member-badges.css\"><script src=\"/noa-member-badges.js\" defer></script><script type=\"application/json\" id=\"noa-notifications-context\">{\"member\":true}</script><script src=\"/noa-notifications.js\" defer></script></head>',\$html));",$common);
file_put_contents($root.'/common.php',$common);
file_put_contents($root.'/noa-desktop-fixture.php', <<<'PHP'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>음원 검증</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-app/p0-media.css"><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main><h1>내 음악</h1><p>독립된 본문</p></main><section class="noa-transport"><strong>재생 중인 음악</strong><button>일시 정지</button></section></body></html>
PHP);
echo "DESKTOP_NATIVE_FIXTURE_READY\n";
