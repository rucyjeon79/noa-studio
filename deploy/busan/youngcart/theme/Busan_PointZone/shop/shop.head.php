<?php
if(!defined('_GNUBOARD_'))exit;
if(empty($is_member)||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php');
}
if(!defined('BUSAN_POINTZONE_THEME_URL'))define('BUSAN_POINTZONE_THEME_URL',G5_URL.'/theme/Busan_PointZone');
header('Cache-Control: private, no-store');
function bpz_theme_escape($value){return htmlspecialchars((string)$value,ENT_QUOTES,'UTF-8');}
$bpz_css=dirname(__DIR__).'/css/pointzone.css';
add_stylesheet('<link rel="stylesheet" href="'.bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/css/pointzone.css?v='.filemtime($bpz_css)).'">',120);
// Use the site's native active theme and its mobile dispatch. Do not load a
// second HTML document, set a theme constant, or change the global layout.
require G5_PATH.'/head.php';
?>
<div id="busan-pointzone" class="bpz-wrap bpz-main">
