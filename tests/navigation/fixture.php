<?php
/** Disposable native-auth fixture. No production credentials, session or database. */
require __DIR__.'/../pwa/fixture.php';
foreach(['noa-my.php','noa-workspace.php','noa-browse.js','noa-browse-order.js','noa-browse-edit.js','noa-policy-20261024.css']as $file)copy('deploy/'.$file,$root.'/'.$file);
$common=file_get_contents($root.'/common.php');$common=str_replace("\$is_admin='';","\$is_admin=\$role==='admin'?'super':'';",$common);file_put_contents($root.'/common.php',$common);
$router=file_get_contents($root.'/router.php');$router=str_replace("if(\$path==='/noa-bridge/membership.php'||\$path==='/noa-bridge/ui-preferences.php')",<<<'CODE'
if($path==='/bbs/logout.php'){setcookie('qa_role','',time()-3600,'/');header('Location: /');return true;}
if($path==='/noa-category-order.php'){header('Content-Type: application/json');echo json_encode(['admin'=>($_COOKIE['qa_role']??'')==='admin','csrf'=>'fixture-only','story'=>['loose-b','loose-a'],'cover'=>[],'playlists'=>[['id'=>'fixture-collection','group'=>'story','title'=>'사연곡 모음','keys'=>['saved-b','saved-a']]]]);return true;}
if($path==='/noa-bridge/membership.php'){
 header('Content-Type: application/json');$role=$_COOKIE['qa_role']??'guest';echo json_encode(['ok'=>true,'member'=>$role!=='guest','name'=>$role==='admin'?'최고관리자':'검증 회원','balance'=>$role==='admin'?12345678:($role==='member'?0:600),'remainingDays'=>$role==='vip'?14:0,'grant'=>$role==='vip'?['status'=>'active']:null]);return true;
}
if($path==='/noa-bridge/ui-preferences.php')
CODE,$router);file_put_contents($root.'/router.php',$router);
echo "NAVIGATION_ISOLATED_FIXTURE_READY\n";
