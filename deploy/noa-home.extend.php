<?php
/** Root index.php owns the app. Preserve old home URLs without a second entrypoint. */
if (!defined('_GNUBOARD_')) { exit; }
$noaRequestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
if ($noaRequestPath === '/noa2.php'
    && realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === realpath(G5_PATH . '/noa2.php')
    && is_file(G5_PATH . '/noa-app/home.php')) {
    $noaQuery = $_SERVER['QUERY_STRING'] ?? '';
    $noaLocation = '/' . ($noaQuery !== '' ? '?' . $noaQuery : '');
    if (!preg_match('/[\r\n]/', $noaLocation)) {
        header('Cache-Control: no-store');
        header('Location: ' . $noaLocation, true, 302);
        exit;
    }
}
unset($noaRequestPath, $noaQuery, $noaLocation);
