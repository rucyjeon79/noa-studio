<?php
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa-lounge-discovery.php'){
 define('_GNUBOARD_',true);$g5=['board_table'=>'b','group_table'=>'g','write_prefix'=>'w_'];$is_member=false;
 $s=file_get_contents($root.'/deploy'.$path);$s=str_replace("require_once __DIR__.'/common.php';",'',$s);
 $s=str_replace("__DIR__.'/noa-bridge/","'".$root.'/bridge/',$s);eval(substr($s,5));return;
}
if(in_array($path,['/noa-lounge-discovery.css','/noa-ui.css','/noa-ui.js'],true)){
 header('Content-Type: '.(str_ends_with($path,'.css')?'text/css':'application/javascript'));readfile($root.'/deploy'.$path);return;
}
http_response_code(404);
