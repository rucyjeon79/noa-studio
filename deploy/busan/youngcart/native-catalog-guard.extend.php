<?php
if (!defined('_GNUBOARD_')) exit;
if (defined('BPZ_NATIVE_CATALOG_ADMIN_EDIT') && BPZ_NATIVE_CATALOG_ADMIN_EDIT === true) {
    // Native CSRF and auth_check_menu remain in the stock save endpoints.
    // AJAX helpers do not all check menu permissions, so require superadmin here.
    if (empty($is_member) || ($is_admin??'')!=='super' || empty($member['mb_id']) || !empty($member['mb_leave_date']) || !empty($member['mb_intercept_date'])) {
        http_response_code(403); exit;
    }
    $bpz_edit_name=basename($_SERVER['SCRIPT_FILENAME']??'');
    if (in_array($bpz_edit_name,['itemformupdate.php','categoryformupdate.php'],true)) {
        if (!in_array($_POST['w']??'', ['', 'u'],true) || !in_array($_GET['w']??'', ['', 'u'],true)) {http_response_code(403);exit;}
    }
    if ($bpz_edit_name==='itemlistupdate.php' && ($_POST['act_button']??'')!=='선택수정') {http_response_code(403);exit;}
    unset($bpz_edit_name);
    return;
}
if (!defined('BPZ_NATIVE_CATALOG_MEMBER') || BPZ_NATIVE_CATALOG_MEMBER !== true) return;
header('Cache-Control: private, no-store');
if (empty($is_member) || empty($member['mb_id']) || !empty($member['mb_leave_date']) || !empty($member['mb_intercept_date'])) {
    // Common bootstrap is not finished at extend load time; do not render alert skin here.
    header('Location: '.G5_BBS_URL.'/login.php',true,302);
    exit;
}
