<?php
// Render the shipped views with disposable data; never load an administrator session or database.
declare(strict_types=1);
define('NOA_SITEMAP_REGISTRY_ONLY', true);
require __DIR__.'/../../deploy/noa-workspace.php';
$out = $argv[1];
if (!is_dir($out)) mkdir($out, 0700, true);
function e($s): string { return htmlspecialchars((string)$s, ENT_QUOTES|ENT_SUBSTITUTE, 'UTF-8'); }
$_SESSION = array_fill_keys(['noa_taxonomy_csrf','noa_db_csrf','noa_popularity_csrf','noa_jukebox_csrf'], 'fixture');
$songs = $genres = [];
$message = '';
$counts = array_fill_keys(explode(' ','covers ready audio_pending missing uploading queued retrying verifying analyzing processing failed bytes'), 0);
foreach (['taxonomy','popularity','database','jukebox'] as $module) {
    $dir = __DIR__.'/../../deploy/noa-app/'.$module;
    $src = file_get_contents($dir.'/index.php');
    $template = substr($src, strpos($src,'?><!doctype html>')+2);
    $file = tempnam($dir, 'view-fixture-');
    try {
        file_put_contents($file,$template);
        ob_start();
        include $file;
        $html = ob_get_clean();
    } finally { unlink($file); }
    foreach (noa_workspace_groups() as $group) foreach ($group['routes'] as $route) {
        if ($route[3] === '/noa-app/'.$module.'/') {
            $guide = '<aside class="noa-workspace-guide"><a href="/noa-library.php">← 최고관리자 작업실</a><p>'.e($route[2]).'</p></aside>';
            $html = preg_replace('~(<main\b[^>]*>)~i', '$1'.$guide, $html, 1);
        }
    }
    $assets = '<script type="application/json" id="noa-access">{"member":true}</script><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-policy-20261024.css">'
        .'<script src="/noa-ui.js" data-noa-theme-only defer></script><link rel="stylesheet" href="/noa-starlight.css">'
        .'<link rel="stylesheet" href="/noa-account.css"><script src="/noa-account.js" defer></script>';
    file_put_contents($out.'/'.$module.'.html',str_replace('</head>',$assets.'</head>',$html));
}
