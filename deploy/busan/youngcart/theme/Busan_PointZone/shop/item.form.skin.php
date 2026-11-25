<?php
if (!defined('_GNUBOARD_')) exit;
require_once __DIR__.'/product-image.php';
?>
<p><a class="bpz-link" href="<?=bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/pointzone.php?section=shop')?>">← 포인트 상점</a></p>
<?php if ($bpz_viewError || !$bpz_viewRows) { ?>
<p role="status"><?=$bpz_viewError?'상품 정보를 불러올 수 없습니다.':'공개된 상품을 찾을 수 없습니다.'?></p>
<?php return; }
$it=$bpz_viewRows[0];
$description=!empty($is_mobile)&&!empty($it['it_mobile_explan'])?$it['it_mobile_explan']:$it['it_explan'];
?>
<article id="sit_ov_wrap" class="bpz-detail bpz-card">
<div id="sit_pvi"><?php bpz_product_image($it); ?></div>
<div id="sit_ov">
<small><?=bpz_theme_escape($it['ca_name'])?></small>
<h1><?=bpz_theme_escape($it['it_name'])?></h1>
<p><?=bpz_theme_escape($it['it_basic'])?></p>
<strong><?=number_format((int)$it['it_price'])?> P</strong>
<p><?=(int)$it['it_stock_qty']>0?'재고 '.number_format((int)$it['it_stock_qty']).'개':'품절'?></p>
<?php if ((int)$it['it_stock_qty']>0) { ?>
<a class="bpz-link" href="<?=bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/checkout.php?item='.rawurlencode($it['it_id']))?>">상품 및 구매 안내</a>
<?php } ?>
</div>
<?php if(trim((string)$description)!==''){ ?>
<section class="bpz-description"><h2>상품 상세설명</h2><?=function_exists('conv_content')?conv_content($description,1):nl2br(bpz_theme_escape(strip_tags($description)))?></section>
<?php } ?>
</article>
