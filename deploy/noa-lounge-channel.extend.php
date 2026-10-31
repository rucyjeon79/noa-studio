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
    $tag .= '<style>#noa-channel-shelf{display:grid;gap:16px;margin:16px 0}#noa-channel-shelf article{display:grid;gap:12px;margin-block:12px;min-width:0}#noa-channel-shelf p{margin:0;line-height:1.8}#noa-channel-shelf .noa-event-photo{width:100%;height:clamp(140px,32vw,250px);object-fit:cover;border-radius:6px}#noa-channel-shelf details summary{cursor:pointer;font-weight:650;padding-block:10px}#noa-channel-shelf .noa-diary-paragraph{white-space:pre-line;overflow-wrap:anywhere;margin:1em 0}#noa-channel-shelf :is(.noa-video-cover,iframe){display:block;position:relative;width:100%;height:auto;aspect-ratio:16/9;overflow:hidden;border:0;background:#111;padding:0}#noa-channel-shelf .noa-video-cover img{width:100%;height:100%;object-fit:cover}#noa-channel-shelf .noa-video-cover span{position:absolute;bottom:12px;left:12px;padding:7px 12px;border-radius:20px;background:#171719df;color:white}#ecosystem:has(#noa-channel-shelf) #ec-content>.ec-empty{display:none}</style>';
    return str_ireplace('</head>', $tag.'</head>', $html);
});
