<?php
/** Disposable native-bootstrap interface fixture; never copied to production. */
$root='/tmp/noa-pwa-fixture';@mkdir($root,0700,true);foreach(['noa-bridge','extend','bbs','noa-app','noa-assets']as $folder)@mkdir($root.'/'.$folder,0700,true);
foreach(['noa-install.php','noa-install.js','noa-install.css','noa-launch.js','noa-brand.js','noa-ui.js','noa-ui.css','noa-account.js','noa-account.css','noa-design.json','noa-ui-words.json','noa-manifest.json','noa-sw.js','noa-download.php','index.php']as $file)copy('deploy/'.$file,$root.'/'.$file);
copy('bridge/member-access.php',$root.'/noa-bridge/member-access.php');copy('deploy/noa-access.extend.php',$root.'/extend/noa.access.php');copy('deploy/noa-design.extend.php',$root.'/extend/noa.design.php');copy('deploy/noa-app/home.php',$root.'/noa-app/home.php');
foreach(['noa-assets/icon-touch-180.png','noa-assets/icon-maskable-192.png','noa-assets/icon-maskable-512.png','noa-assets/icon-180.png','noa-assets/icon-192.png','noa-assets/icon-512.png','noa-assets/favicon.png','noa-assets/papa-logo.png']as $file){$source='public/'.basename($file);if(is_file($source))copy($source,$root.'/'.$file);}
file_put_contents($root.'/common.php', <<<'PHP'
<?php
if(defined('_GNUBOARD_'))return;define('_GNUBOARD_',true);session_start();$role=$_COOKIE['qa_role']??'guest';$member=$role==='guest'?[]:['mb_id'=>'fixture_'.$role,'mb_level'=>$role==='vip'?4:3];$is_admin='';$is_member=!!$member;$config=[];
$nativeAssets='';function add_event($name,$fn,...$rest){if($name==='common_header')$fn();}function add_replace(...$args){}function add_javascript($html,...$args){$GLOBALS['nativeAssets'].=$html;}function add_stylesheet($html,...$args){$GLOBALS['nativeAssets'].=$html;}
ob_start(static function($html){if(stripos($html,'</head>')===false)return $html;return str_ireplace('</head>',($GLOBALS['nativeAssets']??'').'<link rel="stylesheet" href="/noa-account.css"><script src="/noa-account.js" defer></script></head>',$html);});
require __DIR__.'/extend/noa.access.php';require __DIR__.'/extend/noa.design.php';
PHP);
file_put_contents($root.'/noa-music.php', <<<'PHP'
<?php require __DIR__.'/common.php';?><!doctype html><html lang="ko"><head><meta charset="utf-8"><title>음원</title><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main><h1>음원</h1><button id="install" hidden>앱 설치</button><a href="/">홈</a></main></body></html>
PHP);
file_put_contents($root.'/bbs/login.php', <<<'PHP'
<?php require dirname(__DIR__).'/common.php';?><!doctype html><html lang="ko"><head><meta charset="utf-8"><title>로그인</title></head><body><h1>로그인</h1><form><input name="mb_id"><input name="mb_password" type="password"></form></body></html>
PHP);
copy($root.'/bbs/login.php',$root.'/noa-login.php'); // Adjust root for the standalone route.
file_put_contents($root.'/noa-login.php',str_replace("dirname(__DIR__).'/common.php'","__DIR__.'/common.php'",file_get_contents($root.'/noa-login.php')));
file_put_contents($root.'/router.php', <<<'PHP'
<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa2.php'){header('Location: /',true,302);return true;}
if($path==='/noa-bridge/membership.php'||$path==='/noa-bridge/ui-preferences.php'){header('Content-Type: application/json');echo json_encode(['ok'=>true,'member'=>($_COOKIE['qa_role']??'guest')!=='guest','name'=>'검증 회원','displayName'=>'검증 회원','balance'=>600,'remainingDays'=>0,'revision'=>0,'defaults'=>['enabled'=>['noa-studio','noa-ivory'],'theme'=>'noa-studio']]);return true;}
if(str_starts_with($path,'/noa-bridge/')){header('Content-Type: application/json');echo '{"ok":true,"boards":[],"items":[]}';return true;}
if(str_ends_with($path,'.js')&&!is_file(__DIR__.$path)){header('Content-Type: text/javascript');echo '';return true;}
return false;
PHP);
echo "PWA_ISOLATED_FIXTURE_READY\n";
