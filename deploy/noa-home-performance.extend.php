<?php
if (!defined('_GNUBOARD_')) exit;
// Installed as 00.noa-home-performance.php: GnuBoard naturally sorts extensions.
// Start before the other extensions, which also register buffers during inclusion.
// The outer buffer then runs last, including assets injected before common_header.
(static function(): void {
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET' || !in_array($path, ['/', '/index.php'], true)) return;
    $root = dirname(__DIR__);
    if (!is_file($root.'/noa-home-assets-lib.php') || !is_file($root.'/noa-home-assets.php')) return;
    require_once $root.'/noa-home-assets-lib.php';
    ob_start(static function(string $html) use ($root): string {
        if (http_response_code() >= 300 && http_response_code() < 400) return $html;
        try { return nha_rewrite($html, $root); } catch (Throwable $error) { return $html; }
    });
})();
