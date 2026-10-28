<?php
/** Additive creator enrollment and badge presentation; native sessions stay authoritative. */
if(!defined('_GNUBOARD_'))exit;
require_once dirname(__DIR__).'/noa-bridge/member-badges.php';
if(function_exists('add_replace'))add_replace('member_sideview_items',static function($items,$context){$badge=nmb_lookup((string)($context['mb_id']??''));if($badge)$items['name_tag']=['noa_rank'=>nmb_html($badge)]+$items['name_tag'];return $items;},20,2);
// Provisioned board paths stay inaccessible until their approved channel exists and its owner is active.
$ncmb_board=(string)($_REQUEST['bo_table']??'');
if(preg_match('/^nc_[a-f0-9]{16}$/D',$ncmb_board)){
 try{require_once dirname(__DIR__).'/noa-bridge/storage.php';require_once dirname(__DIR__).'/noa-bridge/creator-enrollment-core.php';$ncmb_db=noa_bridge_pdo();$ncmb_row=nce_one($ncmb_db,'SELECT bo_admin,bo_10 FROM '.nce_table($g5['board_table']).' WHERE bo_table=?',[$ncmb_board]);$ncmb_owner=$ncmb_row['bo_admin']??'';$ncmb_channel=$ncmb_owner!==''?nc_row($ncmb_db,nc_channel_key($ncmb_owner)):null;$ncmb_account=$ncmb_owner!==''?nce_member($ncmb_db,$ncmb_owner):null;if(!$ncmb_channel||($ncmb_channel['document']['boardId']??'')!==$ncmb_board||!$ncmb_account||$ncmb_account['mb_leave_date']!==''||$ncmb_account['mb_intercept_date']!==''||(!in_array((int)$ncmb_account['mb_level'],[5,6],true)&&$ncmb_owner!==($config['cf_admin']??'')))throw new RuntimeException('channel_inactive');}
 catch(Throwable $e){http_response_code(404);exit('사용할 수 없는 채널 게시판입니다.');}
}
if(($_SERVER['REQUEST_METHOD']??'GET')==='GET')ob_start(static function($html){if(stripos($html,'</head>')===false||str_contains($html,'/noa-member-badges.css'))return $html;$root=dirname(__DIR__);return str_ireplace('</head>','<link rel="stylesheet" href="/noa-member-badges.css?v='.hash_file('sha256',$root.'/noa-member-badges.css').'"><script src="/noa-member-badges.js?v='.hash_file('sha256',$root.'/noa-member-badges.js').'" defer></script></head>',$html);});
