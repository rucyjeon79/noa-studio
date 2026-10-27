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
