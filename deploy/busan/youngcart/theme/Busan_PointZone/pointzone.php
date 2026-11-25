<?php
// Native member/session bootstrap. Shop browsing is routed to stock Youngcart;
// non-shop Point Zone activities retain their existing screens.
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php?url='.rawurlencode(G5_URL.'/theme/Busan_PointZone/pointzone.php'));
}
if (($_GET['section']??null)==='shop' && ($_SERVER['REQUEST_METHOD']??'GET')==='GET') {
    $bpz_native_item=$_GET['it_id']??null;
    if($bpz_native_item!==null&&(!is_string($bpz_native_item)||!preg_match('/^[a-zA-Z0-9_-]{1,20}$/D',$bpz_native_item))){http_response_code(404);exit;}
    header('Cache-Control: private, no-store');
    header('Location: '.G5_URL.'/shop/'.($bpz_native_item===null?'list.php?ca_id=z9':'item.php?it_id='.rawurlencode($bpz_native_item)),true,302);
    exit;
}
require __DIR__.'/shop/index.php';
