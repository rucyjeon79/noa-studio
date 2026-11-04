<?php
declare(strict_types=1);
define('_GNUBOARD_', true);
require dirname(__DIR__, 2).'/deploy/noa-design.extend.php';

foreach (['/adm/member_list.php','/adm/config_form.php','/bbs/write.php'] as $path) {
    $_SERVER['REQUEST_URI']=$path;
    $page=noa_policy_script_revision('<!doctype html><html><head><link rel="stylesheet" href="native.css"></head><body></body></html>');
    if(substr_count($page,'id="noa-first-paint"')!==1 || strpos($page,'noa-first-paint')>strpos($page,'href="native.css"'))throw new RuntimeException('first paint '.$path);
}
$_SERVER['REQUEST_METHOD']='POST';
foreach (['/noa-gifts.php','/noa-app/popularity/','/noa-app/jukebox/'] as $path) {
    $_SERVER['REQUEST_URI']=$path;
    foreach ([['<!doctype html><html><head></head><body><form><input name="token" value="test"></form></body></html>',422,true],['{"html":"</head>"}',200,false],['',303,false]] as [$body,$code,$themed]) {
        http_response_code($code);
        ob_start();noa_design_assets();echo $body;ob_end_flush();$out=ob_get_clean();
        if($themed ? (!str_contains($out,'noa-first-paint')||!str_contains($out,'name="token" value="test"')) : $out!==$body)throw new RuntimeException('POST output '.$path.' '.$code);
    }
}
echo "ADMIN_FIRST_PAINT_AND_FORM_RESPONSE_OK\n";
