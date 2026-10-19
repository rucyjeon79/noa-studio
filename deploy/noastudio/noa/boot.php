<?php
if (defined('G5_PATH') || defined('NOA_BOOTED')) {
    return;
}
define('NOA_BOOTED', true);
try {
    if (is_file(__DIR__ . '/_common.php')) {
        include_once __DIR__ . '/_common.php';
    } elseif (is_file(__DIR__ . '/common.php')) {
        include_once __DIR__ . '/common.php';
    }
} catch (Throwable $e) {
    $GLOBALS['noa_boot_error'] = $e->getMessage();
}
