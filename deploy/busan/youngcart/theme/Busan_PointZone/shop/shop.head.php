<?php
if(!defined('_GNUBOARD_'))exit;
if(empty($is_member)||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php');
}
if(!defined('BUSAN_POINTZONE_THEME_URL'))define('BUSAN_POINTZONE_THEME_URL',G5_URL.'/theme/Busan_PointZone');
header('Cache-Control: private, no-store');
function bpz_theme_escape($value){return htmlspecialchars((string)$value,ENT_QUOTES,'UTF-8');}
?>
<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title><?php echo bpz_theme_escape($g5['title']??'POINT ZONE'); ?> · 부산지부 ON</title>
<link rel="stylesheet" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/css/pointzone.css'); ?>">
</head><body>
<header class="bpz-header"><div class="bpz-wrap bpz-header-row">
<a class="bpz-brand" href="<?php echo bpz_theme_escape(G5_SHOP_URL.'/'); ?>">BUSAN POINT ZONE</a>
<a href="<?php echo bpz_theme_escape(G5_URL.'/'); ?>">부산지부 ON</a>
</div></header>
<main class="bpz-wrap bpz-main">
