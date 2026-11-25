<?php
if(!defined('_GNUBOARD_'))exit;
$g5['title']='POINT ZONE';
require __DIR__.'/shop.head.php';
?>
<section class="bpz-hero">
<p class="bpz-kicker">BUSAN BRANCH · MEMBERSHIP</p>
<h1>POINT ZONE</h1><p>참여의 가치, 함께 누리는 혜택</p>
<div class="bpz-balance"><span>나의 보유 포인트</span><strong><?php echo number_format((int)($member['mb_point']??0)); ?> P</strong></div>
</section>
<section class="bpz-card"><h2>포인트 전용 상점 준비 중</h2>
<p>현금 결제 없이 포인트로만 운영합니다. 상품 및 주문 연동 검증 후 이용 가능합니다.</p></section>
<?php require __DIR__.'/shop.tail.php'; ?>
