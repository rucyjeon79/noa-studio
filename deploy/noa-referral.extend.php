<?php
if(!defined('_GNUBOARD_'))exit;
require_once dirname(__DIR__).'/noa-bridge/referral-core.php';
(static function(){
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??'';
 try{
  if(empty($GLOBALS['member']['mb_id'])&&($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&isset($_GET['invite'])&&!nrf_session_invite($_SESSION,time())){
   $invite=nrf_invite($_GET['invite'],time());if($invite)$_SESSION['noa_referral']=$invite;
  }
  if(!empty($GLOBALS['member']['mb_id']))nrf_pay((string)$GLOBALS['member']['mb_id']);
  $invite=nrf_session_invite($_SESSION,time());
  if($invite&&($_SERVER['REQUEST_METHOD']??'GET')==='POST'&&$path==='/plugin/social/register_member_update.php'){
   require_once dirname(__DIR__).'/noa-bridge/social-policy.php';
   if(nsp_verified($_REQUEST['provider']??null)){
    $previous=(string)($_SESSION['ss_mb_reg']??'');$requestTime=G5_TIME_YMDHIS;
    register_shutdown_function(static function()use($invite,$previous,$requestTime){
     try{$id=(string)($_SESSION['ss_mb_reg']??'');if(nrf_native_completed($id,$previous,$requestTime))nrf_complete($id,$invite,$requestTime);}
     catch(Throwable $e){error_log('[noa-referral-signup] '.get_class($e));}
    });
   }
  }
 }catch(Throwable $e){error_log('[noa-referral] '.get_class($e));}
 if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'||str_starts_with($path,'/adm/')||str_starts_with($path,'/noa-bridge/'))return;
 ob_start(static function($html){
  if(http_response_code()>=300||stripos($html,'</head>')===false||str_contains($html,'/noa-referral.js'))return $html;
  $assets='';foreach(['css','js']as $kind){$file=dirname(__DIR__).'/noa-referral.'.$kind;if(!is_file($file))return $html;$url='/noa-referral.'.$kind.'?v='.hash_file('sha256',$file);$assets.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';}
  return str_ireplace('</head>',$assets.'</head>',$html);
 });
})();
