<?php
/** Additive document routes. Leave native content rows and GnuBoard core untouched. */
if(!defined('_GNUBOARD_'))exit;
require_once dirname(__DIR__).'/noa-app/editorial-content.php';
// Native registration reads these values; the published text and consent screen share one source.
$noa_editorial_request_path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
if(in_array($noa_editorial_request_path,['/bbs/register.php','/bbs/register_form.php','/bbs/register_form_update.php'],true)){
 $config['cf_stipulation']=noa_editorial_plain('terms');
 $config['cf_privacy']=noa_editorial_plain('privacy');
}
unset($noa_editorial_request_path);
function noa_editorial_legacy_route(): void {
 $path=parse_url($_SERVER['REQUEST_URI']??'',PHP_URL_PATH);
 if($path!=='/bbs/content.php'||($_SERVER['REQUEST_METHOD']??'GET')!=='GET')return;
 $id=$_GET['co_id']??null;
 if(!is_string($id))return;
 $routes=['privacy'=>'privacy','provision'=>'terms'];
 if(!isset($routes[$id]))return;
 require_once dirname(__DIR__).'/noa-app/editorial.php';
 noa_editorial_render($routes[$id]);exit;
}
if(function_exists('add_event'))add_event('common_header','noa_editorial_legacy_route',30,0);
