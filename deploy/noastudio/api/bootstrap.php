<?php
if (defined('NOA_API_BOOT')) {
    return;
}
define('NOA_API_BOOT', true);

function noa_json($code, $body) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function noa_origin_allowed() {
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
    $allow = array('https://noastudio.ai.kr', 'https://noa-studio.grok.me');
    if ($origin !== '' && in_array($origin, $allow, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
        return true;
    }
    return $origin === '';
}

function noa_boot_gnuboard() {
    if (defined('_GNUBOARD_')) {
        return true;
    }
    $candidates = array(
        dirname(__DIR__, 2) . '/common.php',
        dirname(__DIR__, 3) . '/common.php',
        $_SERVER['DOCUMENT_ROOT'] . '/common.php',
    );
    foreach ($candidates as $file) {
        if (is_file($file)) {
            include_once $file;
            return defined('_GNUBOARD_');
        }
    }
    return false;
}

function noa_admin() {
    if (!empty($GLOBALS['is_admin'])) {
        return true;
    }
    if (isset($GLOBALS['member']['mb_level']) && (int) $GLOBALS['member']['mb_level'] >= 10) {
        return true;
    }
    return false;
}

function noa_esc($value) {
    return sql_real_escape_string((string) $value);
}

function noa_one($sql) {
    $result = sql_query($sql);
    $row = sql_fetch_array($result);
    return $row ? $row : null;
}
