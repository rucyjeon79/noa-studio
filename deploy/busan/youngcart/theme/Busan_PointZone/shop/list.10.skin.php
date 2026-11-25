<?php
if (!defined('_GNUBOARD_')) exit;
require_once __DIR__.'/product-image.php';
?>
<ul class="sct sct_10 bpz-products">
<?php foreach ($bpz_viewRows as $row) {
    $url=$bpz_base.'?section=shop&it_id='.rawurlencode($row['it_id']);
?>
<li class="sct_li"><a href="<?=bpz_theme_escape($url)?>">
<div class="sct_img"><?php bpz_product_image($row); ?></div>
<h3><?=bpz_theme_escape($row['it_name'])?></h3>
<strong><?=number_format((int)$row['it_price'])?> P</strong>
<?php if ((int)$row['it_stock_qty']<=0) { ?><span class="bpz-soldout">품절</span><?php } ?>
</a></li>
<?php } ?>
</ul>
