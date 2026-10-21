<?php
// Isolated render harness. Never deployed.
$root=dirname(__DIR__,2);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);
if($path==='/noa-bridge/home.php'){header('Content-Type: application/json');readfile($root.'/quality-home/candidate.json');exit;}
if($path==='/'){define('_GNUBOARD_',true);$is_member=false;require $root.'/deploy/noa-app/home.php';exit;}
if(str_starts_with($path,'/noa-assets/')||str_starts_with($path,'/noa-bridge/')){header('Location: https://noastudio.ai.kr'.$_SERVER['REQUEST_URI'],true,302);exit;}
return false;
