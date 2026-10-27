<?php
if(!defined('_GNUBOARD_'))exit;
// No native member/board writer is modified. Dispatch only after the request finishes.
register_shutdown_function(static function(){
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??'';
 if(empty($GLOBALS['member']['mb_id'])||str_starts_with($path,'/adm/')||$path==='/noa-bridge/notification-worker.php')return;
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST'&&$path!=='/noa-bridge/notifications.php')return;
 $root=dirname(__DIR__);if(!is_file($root.'/noa-bridge/notifications-inline.php'))return;
 try{
  require_once $root.'/noa-bridge/storage.php';require_once $root.'/noa-bridge/notifications-sources.php';require_once $root.'/noa-bridge/notifications-inline.php';
  $cfg=nnt_config();if(($cfg['inlineDispatch']??true)!==true||!nnt_inline_capable())return;
  if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
  if(function_exists('fastcgi_finish_request'))fastcgi_finish_request();
  $db=noa_bridge_pdo();if(nnt_ready($db))nnt_inline_drain($db,$cfg);
 }catch(Throwable $e){error_log('[noa-inline-push] '.get_class($e));}
});
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
