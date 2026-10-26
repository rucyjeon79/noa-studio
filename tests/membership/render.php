<?php
declare(strict_types=1);
$root=sys_get_temp_dir().'/noa-membership-render';@mkdir($root.'/noa-bridge',0700,true);
file_put_contents($root.'/common.php',"<?php define('_GNUBOARD_',true);\$member=['mb_id'=>'qa','mb_level'=>3];\$is_admin='';\$config=[];");
foreach(['noa-membership.php','noa-login.php','noa-membership.js','noa-account.css']as $file)copy(__DIR__.'/../../deploy/'.$file,$root.'/'.$file);
foreach(['social-policy.php','member-access.php']as $file)copy(__DIR__.'/../../bridge/'.$file,$root.'/noa-bridge/'.$file);
$output=getcwd().'/membership-proof';@mkdir($output,0700,true);
foreach(['noa-membership.php','noa-login.php']as $file){$html=shell_exec(escapeshellarg(PHP_BINARY).' '.escapeshellarg($root.'/'.$file));if(!str_contains($html,'<!doctype html>'))throw new RuntimeException('render_failed');$html=str_replace('</head>','<script src="/noa-account.js" defer></script></head>',$html);file_put_contents($output.'/'.$file.'.html',$html);}
echo "MEMBERSHIP_REAL_PHP_TEMPLATES_RENDERED\n";
