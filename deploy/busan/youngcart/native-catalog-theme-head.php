<?php
if(!defined('_GNUBOARD_')||!defined('BPZ_NATIVE_CATALOG_MEMBER'))exit;
require G5_PATH.'/theme/Busan_PointZone/shop/shop.head.php';
?>
<section class="bpz-card"><h2>포인트 상점</h2><p>영카트 상품 목록 · 가격은 포인트(P) 기준입니다. 결제는 검증 후 제공됩니다.</p><p><a class="bpz-link" href="<?php echo bpz_theme_escape(G5_URL.'/theme/Busan_PointZone/pointzone.php'); ?>">POINT ZONE 홈</a> · <a class="bpz-link" href="<?php echo bpz_theme_escape(G5_SHOP_URL.'/list.php?ca_id=z9'); ?>">샘플 상품 목록</a></p></section>
<style>#bpz-native-catalog :is(.sit_btn_cart,.sit_btn_buy,.sit_btn_wish,#sit_btn_cart,#sit_btn_buy,#sit_btn_wish,#sit_btn_alm,.sct_cart,.sct_btn_cart,.sct_btn_wish,.sct_btn,.sct_btnset){display:none!important}#bpz-native-catalog{min-width:0;max-width:100%;overflow-wrap:anywhere}#bpz-native-catalog #sit_pvi{aspect-ratio:auto;display:block}#bpz-native-catalog #sit_pvi img{width:auto;max-width:100%;height:auto}</style>
<div id="bpz-native-catalog">
<?php ob_start(); ?>
