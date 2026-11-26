<?php
// Independent official honor system; reuse the existing site login and layout.
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||empty($member['mb_id'])||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php?url='.rawurlencode(G5_URL.'/theme/Busan_PointZone/honor.php'));
}
$bh_sections=['home'=>'수상자 소개','rules'=>'선정 기준 및 운영 규정','review'=>'간부 심사','vote'=>'조합원 투표','history'=>'역대 수상 기록'];
$bh_section=$_GET['section']??'home';
if(!is_string($bh_section)||!isset($bh_sections[$bh_section])){http_response_code(404);exit;}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);exit;}
if($bh_section==='review'&&(int)($member['mb_level']??0)<4){http_response_code(403);}
$bh_review_allowed=(int)($member['mb_level']??0)>=4;
$g5['title']=$bh_sections[$bh_section].' · 명예의 전당';
require __DIR__.'/shop/shop.head.php';
$bh_base=G5_URL.'/theme/Busan_PointZone/honor.php';
?>
<section class="bpz-hero" style="background:linear-gradient(125deg,#272936,#59421f)"><p class="bpz-kicker">BUSAN BRANCH · HALL OF FAME</p><h1>명예의 전당</h1><p>명예는 구매하는 것이 아니라 조합원들의 인정으로 얻는 것입니다.</p></section>
<nav class="bpz-menu" aria-label="명예의 전당 메뉴"><?php foreach($bh_sections as $bh_key=>$bh_label){ ?><a class="bpz-menu-item" href="<?php echo bpz_theme_escape($bh_base.'?section='.$bh_key); ?>"<?php if($bh_key===$bh_section)echo ' aria-current="page"'; ?>><strong><?php echo bpz_theme_escape($bh_label); ?></strong></a><?php } ?></nav>
<section class="bpz-card"><h2><?php echo bpz_theme_escape($bh_sections[$bh_section]); ?></h2>
<?php if($bh_section==='home'){ ?>
<p>부산지부의 소통과 참여, 동료에 대한 기여를 기리는 공식 시상제도입니다.</p>
<p>수상 혜택: 전용 명예 배지 영구 소장 · 기존 회원 포인트 1,000P · 본인 선택에 따른 프로필 배지 표시.</p>
<p>현재 선정·투표 자동화 기능 구축 중이며 아직 공식 수상자를 발표하지 않습니다.</p>
<?php }elseif($bh_section==='rules'){ ?>
<h3>선정 원칙</h3><ol><li>월별 활동 실적을 집계하고 최소 자격을 충족한 대상자만 심사합니다.</li><li>4레벨 이상 간부에게 후보별 찬반 투표권을 부여하며 과반 찬성 시 심사를 통과합니다.</li><li>통과자가 없으면 수상자를 선정하지 않습니다. 통과자가 1명이면 선정하고, 여러 명이면 상위 2명을 조합원 투표에 부칩니다.</li><li>최종 수상자 1명에게 전용 배지와 기존 회원 포인트 1,000P를 지급합니다. 프로필 배지 적용 여부는 본인이 선택합니다.</li></ol>
<p>세부 집계 기준·투표 기간 등 미확정 운영 조건은 확정 후 공지합니다.</p>
<?php }elseif($bh_section==='review'&&!$bh_review_allowed){ ?>
<p>간부 심사는 4레벨 이상 간부만 이용할 수 있습니다.</p>
<?php }elseif($bh_section==='review'){ ?>
<p>간부 심사 자동생성 기능 구축 중입니다. 현재 심사를 진행하지 않습니다.</p>
<?php }elseif($bh_section==='vote'){ ?>
<p>후보가 발생하면 조합원 투표를 자동 개설하는 기능을 구축 중입니다. 현재 투표를 진행하지 않습니다.</p>
<?php }else{ ?>
<p>공식 선정 시스템 구축 중입니다. 검증되지 않은 수상 기록은 표시하지 않습니다.</p>
<?php } ?>
</section>
<?php require __DIR__.'/shop/shop.tail.php'; ?>
