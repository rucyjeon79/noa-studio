<?php
if(!defined('_GNUBOARD_'))exit;
if(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)==='/noa-youtube.php' && ($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 ob_start(static function($html){
  if(strpos($html,'id="yt-frame"')===false || strpos($html,'/noa-cinema.js')!==false)return $html;
  $base=dirname(__DIR__);
  $assets='<link rel="stylesheet" href="/noa-cinema.css?v='.hash_file('sha256',$base.'/noa-cinema.css').'"><script defer src="/noa-cinema.js?v='.hash_file('sha256',$base.'/noa-cinema.js').'"></script>';
  return str_ireplace('</head>',$assets.'</head>',$html);
 });
}
