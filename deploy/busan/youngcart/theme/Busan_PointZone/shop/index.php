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
require_once dirname(__DIR__).'/lib/order-views.php';
$viewRows=[];$viewError=false;
if(in_array($section,['shop','my','manage'],true)){
    try{$viewRows=$section==='shop'?BusanOrderViews::catalog():BusanOrderViews::orders($section==='manage');}
    catch(Throwable $e){$viewError=true;}
}

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
<h2><?php echo $section===''?'POINT ZONE 이용 안내':bpz_theme_escape($sections[$section][0]).(in_array($section,['shop','my','manage'],true)?'':' 준비 중'); ?></h2>
<p>현금 결제 없이 포인트로만 운영합니다. 실제 상품 구매와 포인트 차감은 안전 검증 후 제공됩니다.</p>
<?php if($section==='manage'&&($is_admin??'')==='super'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/catalog-admin.php'); ?>">상품·분류·재고 관리</a></p><?php } ?>
<?php if(in_array($section,['shop','my','manage'],true)){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/checkout.php'); ?>"><?php echo $section==='manage'?'결제 확인 대기 관리':'장바구니 및 결제'; ?></a></p><?php } ?>
<?php if($section==='my'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(G5_BBS_URL.'/point.php'); ?>">기존 포인트 내역 확인</a></p><?php } ?>
<?php if($section!==''){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape($base); ?>">POINT ZONE 홈으로</a></p><?php } ?>
</section>
<?php if(in_array($section,['shop','my','manage'],true)){ ?>
<section class="bpz-card">
<h2><?php echo $section==='shop'?'공개 상품':($section==='my'?'나의 주문 내역':'포인트 주문 관리'); ?></h2>
<?php if($viewError){ ?><p role="status">현재 정보를 조회할 수 없습니다. 잠시 후 다시 확인해 주세요.</p>
<?php }elseif(!$viewRows){ ?><p><?php echo $section==='shop'?'현재 공개된 상품이 없습니다.':'주문 내역이 없습니다.'; ?></p>
<?php }else{ ?>
<div class="bpz-order-grid">
<?php foreach($viewRows as $r){ ?>
<article class="bpz-order-row">
<?php if($section==='shop'){ ?>
<h3><?php echo bpz_theme_escape($r['it_name']); ?></h3>
<p><?php echo bpz_theme_escape($r['it_basic']); ?></p>
<strong><?php echo number_format((int)$r['it_price']); ?> P</strong>
<p>재고 <?php echo number_format(max(0,(int)$r['it_stock_qty'])); ?>개</p>
<a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/checkout.php?item='.rawurlencode($r['it_id'])); ?>">상품 및 구매 안내</a>
<?php }else{ ?>
<h3>주문 <?php echo bpz_theme_escape($r['od_id']); ?></h3>
<p><?php echo bpz_theme_escape($r['od_time']); ?> · <?php echo bpz_theme_escape(BusanOrderViews::status((string)$r['od_status'])); ?></p>
<?php if($section==='manage'){ ?><p>회원 ID: <?php echo bpz_theme_escape($r['mb_id']); ?></p><?php } ?>
<p>상품 <?php echo number_format((int)$r['od_cart_count']); ?>종 · 원 주문 <?php echo number_format((int)$r['od_receipt_point']); ?> P</p>
<?php if($section==='my'&&$r['od_status']==='입금'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/checkout.php?order='.rawurlencode((string)$r['od_id'])); ?>">주문 취소 안내</a></p><?php } ?>
<p>주문 변경 및 취소는 현재 잠금 상태입니다.</p>
<?php } ?>
</article>
<?php } ?>
</div>
<?php } ?>
</section>
<style>.bpz-order-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}.bpz-order-row{border:1px solid var(--line);border-radius:12px;padding:16px;overflow-wrap:anywhere}.bpz-order-row h3{margin-top:0}.bpz-order-row button:disabled{padding:10px 16px;cursor:not-allowed;opacity:.6}</style>
<?php } ?>
<?php require __DIR__.'/shop.tail.php'; ?>
