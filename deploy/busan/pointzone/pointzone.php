<?php
require_once dirname(__DIR__,2).'/common.php';
if (!$is_member || !empty($member['mb_leave_date']) || !empty($member['mb_intercept_date'])) {
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php?url='.rawurlencode(G5_URL.'/theme/UXC_Flarumix/pointzone.php'));
}
$sections=[
    'shop'=>['포인트 상점','상품 및 꾸미기 아이템 구매'],
    'auction'=>['포인트 경매','한정 상품 입찰 및 낙찰'],
    'sharing'=>['포인트 나눔','조합원 공동 참여 캠페인'],
    'events'=>['지부장 이벤트','활동 포상 및 포인트 환원'],
    'profile'=>['프로필 꾸미기','기간제 및 영구 소장 아이템'],
    'honor'=>['명예의 전당','누적 활동 및 기여도 순위'],
    'my'=>['나의 포인트존','구매·입찰·보유 아이템 및 이용내역']
];
if($is_admin==='super')$sections['manage']=['통합 운영센터','상품·이벤트·거래 및 포인트 운영 관리'];
$section=$_GET['section']??'';
if(!is_string($section)||($section!==''&&!isset($sections[$section]))) {
    http_response_code(404);exit;
}
$base=G5_URL.'/theme/UXC_Flarumix/pointzone.php';
function bpz_h($v){return htmlspecialchars((string)$v,ENT_QUOTES,'UTF-8');}
$g5['title']=$section!==''?$sections[$section][0].' · POINT ZONE':'POINT ZONE';
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
.bpz-nav{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}
.bpz-nav a{display:block;min-width:0;padding:16px;border:1px solid #8295a74d;border-radius:12px;color:inherit;text-decoration:none}
.bpz-nav a strong{display:block;font-size:16px;margin-bottom:4px}
.bpz-nav a small{display:block;line-height:1.5;opacity:.8}
.bpz-back{display:inline-block;margin-top:14px;text-decoration:underline;color:inherit}
@media(max-width:380px){.bpz-nav{grid-template-columns:1fr}}
</style>
<section class="bpz-shell" aria-label="부산지부 POINT ZONE">
 <div class="bpz-hero">
   <p>BUSAN BRANCH · MEMBERSHIP</p>
   <h1>POINT ZONE</h1>
   <p>참여의 가치, 함께 누리는 혜택</p>
   <div class="bpz-balance"><p>나의 보유 포인트</p><strong><?php echo number_format((int)$member['mb_point']); ?> P</strong></div>
 </div>
 <?php if($section===''){ ?>
 <nav class="bpz-nav" aria-label="POINT ZONE 세부 메뉴">
 <?php foreach($sections as $key=>$item){ ?>
   <a href="<?php echo bpz_h($base.'?section='.$key); ?>"><strong><?php echo bpz_h($item[0]); ?></strong><small><?php echo bpz_h($item[1]); ?></small></a>
 <?php } ?>
 </nav>
 <?php }else{ ?>
 <div class="bpz-state"><h2><?php echo bpz_h($sections[$section][0]); ?> 준비 중</h2><p><?php echo bpz_h($sections[$section][1]); ?> 기능을 준비하고 있습니다. 아직 구매·입찰·포인트 차감 기능은 제공하지 않습니다.</p>
 <?php if($section==='my'){ ?><p><a class="bpz-back" href="<?php echo bpz_h(G5_BBS_URL.'/point.php'); ?>">기존 포인트 내역 보기</a></p><?php } ?>
 <a class="bpz-back" href="<?php echo bpz_h($base); ?>">POINT ZONE 홈으로</a></div>
 <?php } ?>
</section>
<?php include_once G5_PATH.'/tail.php'; ?>
