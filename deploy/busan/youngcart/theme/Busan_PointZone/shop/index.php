<?php
if(!defined('_GNUBOARD_'))exit;
$bpz_sections=[
 'shop'=>['포인트 상점','상품 및 꾸미기 아이템 구매','◈'],
 'events'=>['지부장 이벤트','활동 포상 및 포인트 환원','✦'],
 'profile'=>['프로필 꾸미기','기간제 및 영구 소장 아이템','☆'],
 'my'=>['나의 포인트존','구매·보유 아이템 및 이용내역','▤']
];
if(($is_admin??'')==='super')$bpz_sections['manage']=['통합 운영센터','상품·이벤트·거래 운영 관리','⚙'];
$bpz_section=$_GET['section']??'';
if($bpz_section==='honor'&&($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
    header('Location: '.G5_URL.'/theme/Busan_PointZone/honor.php',true,302);exit;
}
if(!is_string($bpz_section)||($bpz_section!==''&&!isset($bpz_sections[$bpz_section]))){http_response_code(404);exit;}
$g5['title']=$bpz_section===''?'POINT ZONE':$bpz_sections[$bpz_section][0].' · POINT ZONE';
require_once dirname(__DIR__).'/lib/order-views.php';
$bpz_itemId=$bpz_section==='shop'?($_GET['it_id']??null):null;
if($bpz_itemId!==null && (!is_string($bpz_itemId)||$bpz_itemId===''||strlen($bpz_itemId)>20)){
    http_response_code(404);exit;
}
$bpz_viewRows=[];$bpz_viewError=false;
if(in_array($bpz_section,['shop','my','manage'],true)){
    try{$bpz_viewRows=$bpz_section==='shop'?BusanOrderViews::catalog($bpz_itemId):BusanOrderViews::orders($bpz_section==='manage');}
    catch(Throwable $e){$bpz_viewError=true;}
}

if($bpz_itemId!==null){
    if($bpz_viewError){http_response_code(503);}
    elseif(!$bpz_viewRows){http_response_code(404);}
    else{$g5['title']=$bpz_viewRows[0]['it_name'].' · 포인트 상점';}
    require __DIR__.'/shop.head.php';
    require __DIR__.'/item.form.skin.php';
    require __DIR__.'/shop.tail.php';
    return;
}
require dirname(__DIR__).'/lib/activities-controller.php';
require __DIR__.'/shop.head.php';
$bpz_base=BUSAN_POINTZONE_THEME_URL.'/pointzone.php';
?>
<section class="bpz-hero">
<p class="bpz-kicker">BUSAN BRANCH · MEMBERSHIP</p>
<h1>POINT ZONE</h1><p>참여의 가치, 함께 누리는 혜택</p>
<div class="bpz-balance"><span>나의 보유 포인트</span><strong><?php echo number_format((int)($member['mb_point']??0)); ?> P</strong></div>
</section>
<nav class="bpz-menu" aria-label="POINT ZONE 메뉴">
<?php foreach($bpz_sections as $bpz_key=>$bpz_item){ ?>
<a class="bpz-menu-item" href="<?php echo bpz_theme_escape($bpz_base.'?section='.$bpz_key); ?>"<?php if($bpz_key===$bpz_section)echo ' aria-current="page"'; ?>><span aria-hidden="true" class="bpz-menu-icon"><?php echo bpz_theme_escape($bpz_item[2]); ?></span><strong><?php echo bpz_theme_escape($bpz_item[0]); ?></strong><small><?php echo bpz_theme_escape($bpz_item[1]); ?></small></a>
<?php } ?>
</nav>
<section class="bpz-card">
<h2><?php echo $bpz_section===''?'POINT ZONE 이용 안내':bpz_theme_escape($bpz_sections[$bpz_section][0]); ?></h2>
<p>현금 결제 없이 포인트로만 운영합니다. 실제 상품 구매와 포인트 차감은 안전 검증 후 제공됩니다.</p>
<?php if($bpz_section==='manage'&&($is_admin??'')==='super'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/activity-admin.php'); ?>">이벤트·꾸미기 관리</a></p><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/catalog-admin.php'); ?>">상품·분류·재고 관리</a></p><?php } ?>
<?php if(in_array($bpz_section,['shop','my','manage'],true)){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/checkout.php'); ?>"><?php echo $bpz_section==='manage'?'결제 확인 대기 관리':'장바구니 및 결제'; ?></a></p><?php } ?>
<?php if($bpz_section==='my'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(G5_BBS_URL.'/point.php'); ?>">기존 포인트 내역 확인</a></p><?php } ?>
<?php if($bpz_section!==''){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape($bpz_base); ?>">POINT ZONE 홈으로</a></p><?php } ?>
</section>
<?php if(in_array($bpz_section,['shop','my','manage'],true)){ ?>
<section class="bpz-card">
<h2><?php echo $bpz_section==='shop'?'공개 상품':($bpz_section==='my'?'나의 주문 내역':'포인트 주문 관리'); ?></h2>
<?php if($bpz_viewError){ ?><p role="status">현재 정보를 조회할 수 없습니다. 잠시 후 다시 확인해 주세요.</p>
<?php }elseif(!$bpz_viewRows){ ?><p><?php echo $bpz_section==='shop'?'현재 공개된 상품이 없습니다.':'주문 내역이 없습니다.'; ?></p>
<?php }elseif($bpz_section==='shop'){require __DIR__.'/list.10.skin.php';}else{ ?>
<div class="bpz-order-grid">
<?php foreach($bpz_viewRows as $bpz_r){ ?>
<article class="bpz-order-row">
<h3>주문 <?php echo bpz_theme_escape($bpz_r['od_id']); ?></h3>
<p><?php echo bpz_theme_escape($bpz_r['od_time']); ?> · <?php echo bpz_theme_escape(BusanOrderViews::status((string)$bpz_r['od_status'])); ?></p>
<?php if($bpz_section==='manage'){ ?><p>회원 ID: <?php echo bpz_theme_escape($bpz_r['mb_id']); ?></p><?php } ?>
<p>상품 <?php echo number_format((int)$bpz_r['od_cart_count']); ?>종 · 원 주문 <?php echo number_format((int)$bpz_r['od_receipt_point']); ?> P</p>
<?php if($bpz_section==='my'&&$bpz_r['od_status']==='입금'){ ?><p><a class="bpz-link" href="<?php echo bpz_theme_escape(BUSAN_POINTZONE_THEME_URL.'/checkout.php?order='.rawurlencode((string)$bpz_r['od_id'])); ?>">주문 취소 안내</a></p><?php } ?>
<p>주문 변경 및 취소는 현재 잠금 상태입니다.</p>
</article>
<?php } ?>
</div>
<?php } ?>
</section>
<style>.bpz-order-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:12px}.bpz-order-row{border:1px solid var(--line);border-radius:12px;padding:16px;overflow-wrap:anywhere}.bpz-order-row h3{margin-top:0}.bpz-order-row button:disabled{padding:10px 16px;cursor:not-allowed;opacity:.6}</style>
<?php } ?>
<?php require dirname(__DIR__).'/lib/activities-view.php'; ?>
<?php require __DIR__.'/shop.tail.php'; ?>
