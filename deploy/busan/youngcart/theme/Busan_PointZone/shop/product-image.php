<?php
if (!defined('_GNUBOARD_')) exit;
function bpz_product_image(array $row):void {
    $parts=explode('/',(string)($row['it_img1']??''));
    if (in_array('', $parts,true)||in_array('..',$parts,true)||in_array('.',$parts,true)) {
        echo '<span class="bpz-no-image">상품 이미지 준비 중</span>';
        return;
    }
    $base=defined('G5_DATA_URL')?G5_DATA_URL:G5_URL.'/data';
    echo '<img loading="lazy" width="418" height="418" src="'.bpz_theme_escape($base.'/item/'.implode('/',array_map('rawurlencode',$parts))).'" alt="'.bpz_theme_escape($row['it_name']).'">';
}
