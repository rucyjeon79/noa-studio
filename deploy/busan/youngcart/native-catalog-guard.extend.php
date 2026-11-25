<?php
if (!defined('_GNUBOARD_')) exit;
if (!defined('BPZ_NATIVE_CATALOG_MEMBER') || BPZ_NATIVE_CATALOG_MEMBER !== true) return;
header('Cache-Control: private, no-store');
if (empty($is_member) || empty($member['mb_id']) || !empty($member['mb_leave_date']) || !empty($member['mb_intercept_date'])) {
    alert('부산지부 조합원 로그인 후 이용해 주세요.', G5_BBS_URL.'/login.php');
    exit;
}
