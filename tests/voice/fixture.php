<?php
require __DIR__.'/../navigation/fixture.php';
foreach(['noa-ainoa.js','noa-ainoa.css','noa-voice.js','noa-sitemap.php']as $file)copy('deploy/'.$file,$root.'/'.$file);
copy('public/ainoa/ainoa-symbol.png',$root.'/noa-assets/ainoa-symbol.png');
$router=file_get_contents($root.'/router.php');$router=str_replace("if(\$path==='/noa2.php')", <<<'CODE'
if($path==='/noa-ainoa.php'){
 header('Content-Type: application/json');$role=$_COOKIE['qa_role']??'guest';$logged=$role!=='guest';echo json_encode(['ok'=>true,'member'=>$logged,'displayName'=>$logged?'검증회원':'방문자','accountKey'=>$role,'subscription'=>$role==='vip'?'구독 중':($logged?'구독 없음':'비로그인'),'balance'=>$logged?1234:null,'remainingDays'=>$role==='vip'?12:($logged?0:null),'capabilities'=>['home'=>true,'member'=>$logged,'music'=>in_array($role,['vip','admin']),'admin'=>$role==='admin'],'adminAssistant'=>false]);return true;
}
if($path==='/noa2.php')
CODE,$router);file_put_contents($root.'/router.php',$router);

@mkdir($root.'/adm',0700,true);
file_put_contents($root.'/adm/index.php', <<<'HTML'
<?php require dirname(__DIR__).'/common.php'; ?><!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>회원 관리</title></head><body><h1>회원 관리</h1><button onclick="alert('설정을 확인해 주세요.')">확인</button></body></html>
HTML);

foreach(['noa-world.css','noa-engagement.css','noa-engagement.js']as $file)copy('deploy/'.$file,$root.'/'.$file);
$world= <<<'HTML'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko" data-noa-precision="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-world.css"><link rel="stylesheet" href="/noa-engagement.css"><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main><article class="noa-world-chapter"><p class="noa-eyebrow">EP.1</p><h3>하루의 끝에</h3><details><summary>기존 곡 소개·제작 메모</summary><p class="noa-world-text">기존 곡 소개는 보존됩니다.</p></details><a href="/noa-catalog.php?id=fixture">곡 정보 보기</a><p class="noa-muted">세계관 소개 초안</p><p class="noa-world-text">처음 사랑을 알게 된 순간부터, 익숙했던 세계가 무너지는 순간까지. EP.1의 노래와 공식 MV에서 이 장면을 만나보세요.</p><figure class="world-chapter-mv"><button class="world-thumbnail"><img src="/noa-assets/papa-logo.png" alt=""></button><figcaption>EP.1 하루의 끝에 | Official MV · 공식 MV</figcaption><div class="noa-engagement"><button aria-label="좋아요 0"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 4l16 16M20 4L4 20"/></svg><span>0</span></button><button aria-label="댓글 0"><svg width="18" height="18" viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/></svg><span>0</span></button></div></figure></article></main></body></html>
HTML;
file_put_contents($root.'/layout-test.php',$world);
