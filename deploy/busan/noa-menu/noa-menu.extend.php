<?php
if (!defined('_GNUBOARD_')) exit;
function busan_noa_menu_theme_assets(){
    $root=G5_URL.'/busan-assistant/banner-assets/';
    echo '<script src="'.htmlspecialchars($root.'busan-noa-menu.js?v=1',ENT_QUOTES,'UTF-8').'" defer></script>';
}
add_stylesheet('<link rel="stylesheet" href="'.htmlspecialchars(G5_URL.'/busan-assistant/banner-assets/busan-noa-menu.css?v=1',ENT_QUOTES,'UTF-8').'">',120);
add_event('tail_sub','busan_noa_menu_theme_assets');
