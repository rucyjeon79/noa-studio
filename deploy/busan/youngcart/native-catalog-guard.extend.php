<?php
if (!defined('_GNUBOARD_')) exit;
if (!defined('BPZ_NATIVE_CATALOG_MEMBER') || BPZ_NATIVE_CATALOG_MEMBER !== true) return;
header('Cache-Control: private, no-store');
if (empty($is_member) || empty($member['mb_id']) || !empty($member['mb_leave_date']) || !empty($member['mb_intercept_date'])) {
    // Common bootstrap is not finished at extend load time; do not render alert skin here.
    header('Location: '.G5_BBS_URL.'/login.php',true,302);
    exit;
}
