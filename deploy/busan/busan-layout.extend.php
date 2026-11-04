<?php
if (!defined('_GNUBOARD_')) exit;
if (defined('G5_IS_ADMIN') && G5_IS_ADMIN) return;

$busan_layout_asset = '/busan-assistant/banner-assets/busan-layout.css';
$busan_layout_version = filemtime(G5_PATH . $busan_layout_asset);
if ($busan_layout_version !== false) {
    add_stylesheet('<link rel="stylesheet" href="' . G5_URL . $busan_layout_asset . '?v=' . $busan_layout_version . '">', 110);
}
