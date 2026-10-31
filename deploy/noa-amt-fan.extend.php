<?php
if(!defined('_GNUBOARD_')||($_SERVER['REQUEST_METHOD']??'GET')!=='GET')return;
$amtPath=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH);
if(!in_array($amtPath,['/','/index.php','/noa-music.php','/noa-youtube.php','/noa-world.php','/noa-shop.php','/noa-lounge.php','/noa-channel.php','/noa-my.php','/bbs/board.php'],true))return;
if($amtPath!=='/noa-music.php' && time()>=strtotime('2026-11-16T00:00:00+09:00'))return;
ob_start(static function($html){
 if(stripos($html,'</head>')===false||stripos($html,'</body>')===false)return $html;
 $base=dirname(__DIR__);
 $tags='<link rel="stylesheet" href="/noa-amt-fan.css?v='.hash_file('sha256',$base.'/noa-amt-fan.css').'"><script defer src="/noa-amt-fan.js?v='.hash_file('sha256',$base.'/noa-amt-fan.js').'"></script>';
 return str_ireplace('</head>',$tags.'</head>',$html);
});
