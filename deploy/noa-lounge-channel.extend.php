<?php
if (!defined('_GNUBOARD_') || parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) !== '/noa-lounge.php') return;
ob_start(static function ($html) {
    $asset = '/noa-lounge-channel.js';
    $tag = '<script defer src="'.$asset.'?v='.hash_file('sha256',dirname(__DIR__).$asset).'"></script>';
    return str_ireplace('</head>', $tag.'</head>', $html);
});
