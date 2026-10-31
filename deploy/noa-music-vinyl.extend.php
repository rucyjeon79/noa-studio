<?php
if(!defined('_GNUBOARD_'))exit;
if(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)==='/noa-music.php' && ($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 ob_start(static function($html){
  if(strpos($html,'id="sound-player"')===false || strpos($html,'/noa-music-vinyl.js')!==false)return $html;
  $base=dirname(__DIR__);
  $assets='<link rel="stylesheet" href="/noa-music-vinyl.css?v='.hash_file('sha256',$base.'/noa-music-vinyl.css').'"><script defer src="/noa-music-vinyl.js?v='.hash_file('sha256',$base.'/noa-music-vinyl.js').'"></script>';
  return str_ireplace('</head>',$assets.'</head>',$html);
 });
}
