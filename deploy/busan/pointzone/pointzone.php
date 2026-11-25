<?php
require_once dirname(__DIR__,2).'/common.php';
if (!$is_member || !empty($member['mb_leave_date']) || !empty($member['mb_intercept_date'])) {
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php?url='.rawurlencode(G5_URL.'/theme/UXC_Flarumix/pointzone.php'));
}
$g5['title']='POINT ZONE';
include_once G5_PATH.'/head.php';
?>
<style>
.bpz-shell{max-width:900px;margin:24px auto;padding:0 16px 36px;box-sizing:border-box}
.bpz-hero{padding:30px 24px;border-radius:18px;background:linear-gradient(125deg,#142b44,#20566b);color:#fff}
.bpz-hero h1{color:#fff;font-size:clamp(26px,5vw,38px);line-height:1.2;margin:10px 0}
.bpz-hero p{color:#d7e8ee;margin:0;font-size:15px;line-height:1.6}
.bpz-balance{margin-top:24px;border-top:1px solid #ffffff45;padding-top:16px}
.bpz-balance strong{display:block;color:#fff;font-size:28px;font-variant-numeric:tabular-nums}
.bpz-state{margin-top:20px;padding:20px;border:1px solid #8295a74d;border-radius:14px;line-height:1.8}
.bpz-state h2{font-size:18px;margin:0 0 6px}
.bpz-state p{margin:0}
</style>
<section class="bpz-shell" aria-label="부산지부 POINT ZONE">
 <div class="bpz-hero">
   <p>BUSAN BRANCH · MEMBERSHIP</p>
   <h1>POINT ZONE</h1>
   <p>참여의 가치, 함께 누리는 혜택</p>
   <div class="bpz-balance"><p>나의 보유 포인트</p><strong><?php echo number_format((int)$member['mb_point']); ?> P</strong></div>
 </div>
 <div class="bpz-state"><h2>포인트 상점 준비 중</h2><p>조합원 여러분의 소중한 참여를 다양한 혜택으로 돌려드릴 수 있도록 준비하고 있습니다. 현재 상품 구매 및 포인트 차감은 제공하지 않습니다.</p></div>
</section>
<?php include_once G5_PATH.'/tail.php'; ?>
