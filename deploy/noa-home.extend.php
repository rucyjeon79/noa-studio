<?php
/** Additive GnuBoard home routing. Existing index.php remains intact. */
if (!defined('_GNUBOARD_')) {
    exit;
}
$noaRequestPath = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$noaScript = realpath($_SERVER['SCRIPT_FILENAME'] ?? '');
if (in_array($noaRequestPath, ['/', '/index.php'], true)
    && $noaScript === realpath(G5_PATH . '/index.php')
    && !isset($_GET['noa_legacy'])
    && is_file(G5_PATH . '/noa2.php')) {
    header('Location: /noa2.php', true, 302);
    exit;
}
unset($noaRequestPath, $noaScript);
