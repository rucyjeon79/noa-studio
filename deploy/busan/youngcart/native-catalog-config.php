<?php
// Loaded by the existing dbconfig.php; no separate authentication or order engine.
if (!defined('_GNUBOARD_')) exit;
$bpz_native_script = realpath((string)($_SERVER['SCRIPT_FILENAME'] ?? ''));
$bpz_native_admin = realpath(__DIR__.'/../adm/shop_admin');
$bpz_native_shop = realpath(__DIR__.'/../shop');
if ($bpz_native_script === false) return;
$bpz_native_is_admin = defined('G5_IS_SHOP_ADMIN_PAGE') && G5_IS_SHOP_ADMIN_PAGE === true && $bpz_native_admin !== false && dirname($bpz_native_script) === $bpz_native_admin && in_array(basename($bpz_native_script), ['itemlist.php','itemform.php','categorylist.php','categoryform.php'], true);
$bpz_native_is_member = $bpz_native_shop !== false && dirname($bpz_native_script) === $bpz_native_shop && in_array(basename($bpz_native_script), ['list.php','item.php'], true);
if (!$bpz_native_is_admin && !$bpz_native_is_member) return;
if (!in_array($_SERVER['REQUEST_METHOD'] ?? '', ['GET','HEAD'], true)) return;
if (defined('G5_USE_SHOP') || defined('G5_SHOP_TABLE_PREFIX')) return;
if ($bpz_native_is_member) define('BPZ_NATIVE_CATALOG_MEMBER', true);
define('G5_USE_SHOP', true);
define('G5_SHOP_TABLE_PREFIX', 'yc5_');
foreach (['default','banner','cart','category','event','event_item','item','item_option','item_use','item_qa','item_relation','order','order_delete','wish','coupon','coupon_zone','coupon_log','sendcost','personalpay','order_address','item_stocksms','order_data','inicis_log'] as $bpz_native_suffix) {
    $g5['g5_shop_'.$bpz_native_suffix.'_table'] = G5_SHOP_TABLE_PREFIX.$bpz_native_suffix;
}
$g5['g5_shop_post_log_table'] = G5_SHOP_TABLE_PREFIX.'order_post_log';
unset($bpz_native_script,$bpz_native_admin,$bpz_native_shop,$bpz_native_is_admin,$bpz_native_is_member,$bpz_native_suffix);
