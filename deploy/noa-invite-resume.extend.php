<?php
if(!defined('_GNUBOARD_')||empty($_COOKIE['__Host-noa_invite']))return;
if(function_exists('add_event'))add_event('common_header',static function(){
    $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
    if(($_SERVER['REQUEST_METHOD']??'')!=='GET'||empty($GLOBALS['member']['mb_id'])||headers_sent())return;
    if(!in_array($path,['/','/index.php','/noa-my.php','/noa-music.php','/bbs/register_result.php'],true))return;
    if(!str_contains($_SERVER['HTTP_ACCEPT']??'','text/html'))return;
    header('Cache-Control: private, no-store');header('Location: /noa-special-invite.php?resume=1');exit;
},10,0);
