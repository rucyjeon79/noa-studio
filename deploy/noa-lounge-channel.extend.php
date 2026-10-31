<?php
if (!defined('_GNUBOARD_') || parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH) !== '/noa-lounge.php') return;
// Old board bookmarks and notification links should land on the same community tab.
if(($_GET['board'] ?? '') === 'song_request' && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'GET'){
    $query=$_GET;
    unset($query['board']);
    $query['category']='story';
    $query['view']='list';
    header('Location: /noa-lounge.php?'.http_build_query($query),true,302);
    exit;
}
ob_start(static function ($html) {
    $asset = '/noa-lounge-channel.js';
    $tag = '<script defer src="'.$asset.'?v='.hash_file('sha256',dirname(__DIR__).$asset).'"></script>';
    // The private board supplies its own form, list and pagination.
    $tag .= '<style>#ecosystem:has(#noa-song-requests) #ec-tools > :not(.ec-tabs){display:none!important} #noa-song-requests .noa-community-write{background:var(--noa-room-ink,var(--noa-accent));color:var(--noa-bg);padding-inline:16px}</style>';
    return str_ireplace('</head>', $tag.'</head>', $html);
});
