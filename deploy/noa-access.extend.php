<?php
/** Additive application ACL. GnuBoard authentication and core files are preserved. */
if(!defined('_GNUBOARD_'))exit;
header('X-NOA-Access-Revision: native-subscription-read-1');
require_once dirname(__DIR__).'/noa-bridge/member-access.php';
// Managed subscriptions expire on every authenticated request, including direct media requests.
if(!empty($member['mb_id'])&&($is_admin??'')!=='super'&&is_file(dirname(__DIR__).'/noa-bridge/subscription-access.php')){
 require_once dirname(__DIR__).'/noa-bridge/subscription-access.php';
 if(ns_family((int)($member['mb_level']??1))!==null){
  try{$member=ns_apply_native_member($member,time());}
  catch(Throwable $e){$raw=(int)$member['mb_level'];$member['noa_raw_level']=$raw;$member['mb_level']=ns_family($raw)??$raw;error_log('[noa-subscription-access] '.get_class($e));}
 }
}
$noa_access=nam_access((array)($member??[]),(string)($is_admin??''));
$noa_path=(string)(parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH)??'/');
$noa_need=nam_requirement($noa_path,$_SERVER['REQUEST_METHOD']??'GET',$_GET);
// New registrations start as temporary members; never change existing member rows.
if(isset($config)&&is_array($config))$config['cf_register_level']=2;
if(!nam_allowed($noa_access,$noa_need)){
 header('Cache-Control: private, no-store');header('X-NOA-Access: '.$noa_need);
 if(str_starts_with($noa_path,'/noa-bridge/')||str_contains($_SERVER['HTTP_ACCEPT']??'','application/json')){
  http_response_code($noa_access['level']===1?401:403);header('Content-Type: application/json; charset=utf-8');echo json_encode(['ok'=>false,'error'=>$noa_need==='music'?'vip_required':($noa_need==='write'?'regular_member_required':'membership_required')]);exit;
 }
 if($noa_access['level']===1&&($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
  header('Location: /bbs/login.php?url='.rawurlencode($_SERVER['REQUEST_URI']??'/'),true,302);exit;
 }
 http_response_code(403);header('Content-Type: text/html; charset=utf-8');
 $message=$noa_need==='music'?'음원은 VIP회원·VIP 크리에이터가 이용할 수 있습니다.':($noa_need==='write'?'글과 댓글은 정회원부터 작성할 수 있습니다.':($noa_need==='creator'?'창작자·VIP 크리에이터가 이용할 수 있습니다.':'이 메뉴를 이용할 권한이 없습니다.'));
 $launch=dirname(__DIR__).'/noa-launch.js';$launchTag=is_file($launch)?'<script src="/noa-launch.js?v='.hash_file('sha256',$launch).'"></script>':'';
 echo '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>이용 안내 | NOA STUDIO</title>'.$launchTag.'<link rel="stylesheet" href="/noa-ui.css"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script><body class="noa-page"><main><h1>이용 안내</h1><p>'.$message.'</p><a class="noa-button" href="/">홈</a><a class="noa-button" href="/noa-my.php">MY</a></main></body></html>';exit;
}
// Embed only capabilities, never member IDs, tokens or personal details. Applies to native and standalone views.
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
 $noa_capabilities=json_encode($noa_access,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT);
 ob_start(static function($html)use($noa_capabilities){
  if(stripos($html,'</head>')===false||str_contains($html,'id="noa-access"'))return $html;
  return str_ireplace('</head>','<script type="application/json" id="noa-access">'.$noa_capabilities.'</script></head>',$html);
 });
}
