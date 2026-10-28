<?php
/** Runs before the existing access extension. No authentication or GnuBoard core replacement. */
if(!defined('_GNUBOARD_'))exit;
require_once dirname(__DIR__).'/noa-bridge/membership-core.php';
try{$nr_enabled=!empty(nr_policy()['enabled']);}catch(Throwable $e){$nr_enabled=false;error_log('[noa-membership-policy] '.get_class($e));}
if($nr_enabled){
 // Core login rewards run before extensions; deployment also sets the stored value to zero.
 $config['cf_login_point']=0;if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'&&str_ends_with(parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??'','/adm/config_form_update.php'))$_POST['cf_login_point']=0;
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)??'';
 if(in_array($path,['/bbs/write_update.php','/bbs/write_comment_update.php'],true)&&isset($board)){$board['bo_write_point']=0;$board['bo_comment_point']=0;}
 if(!empty($member['mb_id'])){
  try{nr_pending_login((string)$member['mb_id'],time());if(($is_admin??'')!=='super'){nr_renew((string)$member['mb_id'],time());$fresh=nr_refresh((string)$member['mb_id'],time());$member['mb_level']=$fresh['mb_level'];$member['mb_point']=$fresh['mb_point'];}}
  catch(Throwable $e){if(($is_admin??'')!=='super'&&in_array((int)($member['mb_level']??0),[2,3,4],true))$member['mb_level']=2;error_log('[noa-membership-refresh] '.get_class($e));}
 }
 if(function_exists('add_event')){
  add_event('write_update_before',static function(){global $board;$board['bo_write_point']=0;$board['bo_comment_point']=0;},1,0);
  add_event('write_update_after',static function($board,$id,$mode){try{nr_activity('write',(array)$board,(int)$id,(string)$mode,time());}catch(Throwable $e){error_log('[noa-write-reward] '.get_class($e));}},10,3);
  add_event('comment_update_after',static function($board,$id,$mode,$query,$url,$comment){try{nr_activity('comment',(array)$board,(int)$comment,(string)$mode,time());}catch(Throwable $e){error_log('[noa-comment-reward] '.get_class($e));}},10,6);
 }
 if($path==='/noa-subscription.php'&&($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&in_array((int)($member['mb_level']??0),[2,3,4],true)){header('Location: /noa-membership.php',true,302);exit;}
}
// GnuBoard includes extensions in its request scope; keep asset variables local.
(static function(){
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'&&!str_starts_with($_SERVER['REQUEST_URI']??'','/adm/')){
 $assetRoot=dirname(__DIR__);$assets='';foreach(['css','js']as $kind){$file=$assetRoot.'/noa-account.'.$kind;if(is_file($file)){$url='/noa-account.'.$kind.'?v='.hash_file('sha256',$file);$assets.=$kind==='css'?'<link rel="stylesheet" href="'.$url.'">':'<script src="'.$url.'" defer></script>';}}
 ob_start(static function($html)use($assets){return stripos($html,'</head>')!==false&&!str_contains($html,'/noa-account.js')?str_ireplace('</head>',$assets.'</head>',$html):$html;});
}
})();
