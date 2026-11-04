<?php
if(!defined('_GNUBOARD_')||!defined('G5_USE_SHOP')||!G5_USE_SHOP)return;
$ny_path=parse_url($_SERVER['SCRIPT_NAME']??'',PHP_URL_PATH);
if(in_array($ny_path,['/shop/orderformupdate.php','/mobile/shop/orderformupdate.php'],true)&&($_SERVER['REQUEST_METHOD']??'')==='POST'){
 require_once G5_PATH.'/noa-bridge/youngcart-core.php';try{ny_capture();}catch(Throwable $e){http_response_code(409);exit('주문 상품·금액·회원등급을 다시 확인해 주세요. 결제 승인을 요청하지 않았습니다.');}
}
if(in_array($ny_path,['/shop/orderinquiryview.php','/mobile/shop/orderinquiryview.php'],true)&&!empty($member['mb_id'])&&is_string($_GET['od_id']??null)){
 require_once G5_PATH.'/noa-bridge/youngcart-core.php';try{ny_fulfill((string)$member['mb_id'],$_GET['od_id']);}catch(Throwable $e){error_log('NOA Youngcart fulfillment requires review: '.get_class($e));}
}

// Presentation only. Keep native cart, order and payment handlers intact.
if(preg_match('~^/(?:mobile/)?shop/[^/]+\.php$~D',(string)$ny_path)){
 add_stylesheet('<link rel="stylesheet" href="/noa-ui.css">',90);
 $ny_style_version=@hash_file('sha256',G5_PATH.'/noa-youngcart-premium.css')?:'20261104';
 add_stylesheet('<link rel="stylesheet" href="/noa-youngcart-premium.css?v='.$ny_style_version.'">',100);
 add_javascript('<script src="/noa-youngcart-premium.js?v=20261103" defer></script>',100);
}
