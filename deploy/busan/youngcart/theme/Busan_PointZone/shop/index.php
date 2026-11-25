<?php
if(!defined('_GNUBOARD_'))exit;
$sections=[
 'shop'=>['포인트 상점','상품 및 꾸미기 아이템 구매','◈'],
 'auction'=>['포인트 경매','한정 상품 입찰 및 낙찰','◇'],
 'sharing'=>['포인트 나눔','조합원 공동 참여 캠페인','♡'],
 'events'=>['지부장 이벤트','활동 포상 및 포인트 환원','✦'],
 'profile'=>['프로필 꾸미기','기간제 및 영구 소장 아이템','☆'],
 'honor'=>['명예의 전당','누적 활동 및 기여도 순위','♜'],
 'my'=>['나의 포인트존','구매·입찰·보유 아이템 및 이용내역','▤']
];
if(($is_admin??'')==='super')$sections['manage']=['통합 운영센터','상품·이벤트·거래 운영 관리','⚙'];
$section=$_GET['section']??'';
if(!is_string($section)||($section!==''&&!isset($sections[$section]))){http_response_code(404);exit;}
$g5['title']=$section===''?'POINT ZONE':$sections[$section][0].' · POINT ZONE';
require __DIR__.'/shop.head.php';
$base=BUSAN_POINTZONE_THEME_URL.'/pointzone.php';
?>
<section class="bpz-hero">
<p class="bpz-kicker">BUSAN BRANCH · MEMBERSHIP</p>
<h1>POINT ZONE</h1><p>참여의 가치, 함께 누리는 혜택</p>
<div class="bpz-balance"><span>나의 보유 포인트</span><strong><?php echo number_format((int)($member['mb_point']??0)); ?> P</strong></div>
</section>
<nav class="bpz-menu" aria-label="POINT ZONE 메뉴">
<?php foreach($sections as $key=>$item){ ?>
<a class="bpz-menu-item" href="<?php echo bpz_theme_escape($base.'?section='.$key); ?>"<?php if($key===$section)echo ' aria-current="page"'; ?>><span aria-hidden="true" class="bpz-menu-icon"><?php echo bpz_theme_escape($item[2]); ?></span><strong><?php echo bpz_theme_escape($item[0]); ?></strong><small><?php echo bpz_theme_escape($item[1]); ?></small></a>
<?php } ?>
</nav>
<section class="bpz-card">
<h2><?php echo $section===''?'POINT ZONE 이용 안내':bpz_theme_escape($sections[$section][0]).' 준비 중'; ?></h2>
<p>현금 결제 없이 포인트로만 운영합니다. 실제 상품 구매와 포인트 차감은 안전 검증 후 제공됩니다.</p>
<?php if($section==='manage'&&($is_admin??'')==='super'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/catalog-admin.php'); ?>">상품·분류·재고 관리</a></p><?php } ?>
<?php if($section==='my'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(G5_BBS_URL.'/point.php'); ?>">기존 포인트 내역 확인</a></p><?php } ?>
<?php if($section!==''){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape($base); ?>">POINT ZONE 홈으로</a></p><?php } ?>
</section>
<?php require __DIR__.'/shop.tail.php'; ?>
