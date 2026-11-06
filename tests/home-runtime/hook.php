<?php
declare(strict_types=1);
$source = dirname(__DIR__, 2).'/deploy';
$tmp = sys_get_temp_dir().'/noa-home-hook-'.bin2hex(random_bytes(8)); mkdir($tmp); mkdir($tmp.'/extend'); mkdir($tmp.'/noa-app');
$files = ['noa-home-assets.php','noa-app/home-assets.php','noa-brand.js','noa-account.js','noa-account.css'];
foreach ($files as $file) copy($source.'/'.$file, $tmp.'/'.$file);
copy($source.'/noa-home-performance.extend.php', $tmp.'/extend/00.noa-home-performance.php');
define('_GNUBOARD_', true);
try {
    // Match GnuBoard inclusion order and the existing extensions' outer buffers.
    $_SERVER['REQUEST_METHOD'] = 'GET'; $_SERVER['REQUEST_URI'] = '/';
    ob_start(); $capture = ob_get_level();
    include $tmp.'/extend/00.noa-home-performance.php';
    ob_start(static fn($html)=>str_replace('</head>', '<link rel="stylesheet" href="/noa-account.css"><script src="/noa-account.js" defer></script><script type="application/json" id="member">{"member":true}</script></head>', $html));
    ob_start();
    echo '<!doctype html><html><head><script src="/noa-brand.js" defer></script></head><body>member view</body></html>';
    while (ob_get_level() > $capture) ob_end_flush();
    $result = ob_get_clean();
    if (!str_contains($result, 'files=noa-brand.js,noa-account.js') || !str_contains($result, 'files=noa-account.css') || !str_contains($result, '{"member":true}')) throw new RuntimeException('early extension must include late-added assets and preserve member context');
    foreach (['/noa-music.php','/noa-bridge/listening.php','/bbs/login.php'] as $path) {
        $_SERVER['REQUEST_URI'] = $path; $level = ob_get_level();
        include $tmp.'/extend/00.noa-home-performance.php';
        if (ob_get_level() !== $level) throw new RuntimeException('non-home route intercepted');
    }
    echo "HOME_EXTENSION_BUFFER_ORDER_AND_SCOPE_OK\n";
} finally {
    foreach ($files as $file) unlink($tmp.'/'.$file);
    unlink($tmp.'/extend/00.noa-home-performance.php'); rmdir($tmp.'/extend'); rmdir($tmp.'/noa-app'); rmdir($tmp);
}
