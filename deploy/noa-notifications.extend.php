<?php
if(!defined('_GNUBOARD_'))exit;
(static function(){
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??'';
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'||str_starts_with($path,'/adm/')||str_starts_with($path,'/noa-bridge/'))return;
 ob_start(static function($html){
  if(http_response_code()>=300||stripos($html,'</head>')===false||str_contains($html,'id="noa-notifications-context"'))return $html;
  $root=dirname(__DIR__);$assets='';foreach(['css','js']as $kind){$file=$root.'/noa-notifications.'.$kind;if(!is_file($file))return $html;$url='/noa-notifications.'.$kind.'?v='.hash_file('sha256',$file);$assets.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';}
  $assets.='<script type="application/json" id="noa-notifications-context">'.json_encode(['member'=>!empty($GLOBALS['member']['mb_id'])],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT).'</script>';
  return str_ireplace('</head>',$assets.'</head>',$html);
 });
})();
