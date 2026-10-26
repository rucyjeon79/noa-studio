<?php
/** Loaded after social_login.extend.php. Native OAuth, sessions and member records remain authoritative. */
if(!defined('_GNUBOARD_'))exit;
require_once dirname(__DIR__).'/noa-bridge/social-policy.php';
$config['cf_social_login_use']=1;$config['cf_social_servicelist']='google,kakao';$config['cf_register_level']=2;
$nsp_script=str_replace('\\','/',(string)($_SERVER['SCRIPT_FILENAME']??$_SERVER['SCRIPT_NAME']??parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH)));
$nsp_method=$_SERVER['REQUEST_METHOD']??'GET';
if(basename($nsp_script)==='config_form_update.php'&&$nsp_method==='POST'){
 $_POST['cf_social_login_use']='1';$_POST['cf_social_servicelist']=['google','kakao'];
}
function nsp_reject_registration():never{
 http_response_code(403);header('Cache-Control: no-store');header('Content-Type: text/html; charset=utf-8');
 echo '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>회원가입 안내</title><link rel="stylesheet" href="/noa-ui.css"></head><body class="noa-page"><main><h1>소셜 계정으로 가입해 주세요</h1><p>회원가입은 구글·카카오 계정 인증 후 가능합니다.</p><a class="noa-button" href="/noa-login.php">가입 · 로그인</a></main></body></html>';exit;
}
$nsp_verified=false;
if(str_contains($nsp_script,'/plugin/social/')&&in_array(basename($nsp_script),['register_member.php','register_member_update.php'],true)){
 try{$nsp_verified=nsp_verified($_REQUEST['provider']??null);}catch(Throwable $e){$nsp_verified=false;}
}
$nsp_decision=nsp_decide($nsp_script,$nsp_method,$_REQUEST,!empty($member['mb_id']),$nsp_verified);
if($nsp_decision==='deny')nsp_reject_registration();
if(in_array($nsp_decision,['signup','login'],true)){header('Cache-Control: no-store');header('Location: /noa-login.php?url='.rawurlencode(nsp_return($_GET['url']??'/')),true,302);exit;}
// Defense in depth for callers that include the native update script under another URL.
if(function_exists('add_event'))add_event('register_form_update_before',static function($id,$mode){global $member;if($mode!=='u'||empty($member['mb_id'])||!hash_equals((string)$member['mb_id'],(string)$id))nsp_reject_registration();},1,2);
// The legacy login form remains available to existing accounts; remove its obsolete signup link.
if(basename($nsp_script)==='login.php'&&$nsp_method==='GET')ob_start(static function($html){return preg_replace('~<a\b[^>]*href=(["\'])[^"\']*/bbs/register[.]php(?:[?][^"\']*)?\1[^>]*>.*?</a>~is','',$html);});
// A unique existing NOA email is an alias only; native password verification remains unchanged.
if(basename($nsp_script)==='login_check.php'&&$nsp_method==='POST'&&isset($_POST['mb_id'])&&is_string($_POST['mb_id'])&&filter_var(trim($_POST['mb_id']),FILTER_VALIDATE_EMAIL)){
 $nsp_email=sql_escape_string(trim($_POST['mb_id']));$nsp_result=sql_query("SELECT mb_id FROM {$g5['member_table']} WHERE mb_email = '{$nsp_email}' LIMIT 2",false);$nsp_ids=[];
 if($nsp_result)while($nsp_row=sql_fetch_array($nsp_result))$nsp_ids[]=(string)$nsp_row['mb_id'];
 if(count($nsp_ids)===1)$_POST['mb_id']=$nsp_ids[0];
}

