<?php
// Independent Hall of Fame, native member authentication and native layout.
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||empty($member['mb_id'])||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php?url='.rawurlencode(G5_URL.'/theme/Busan_PointZone/honor.php'));
}
$bh_sections=['home'=>'수상자 소개','rules'=>'선정 기준 및 운영 규정','review'=>'간부 심사','vote'=>'조합원 투표','history'=>'역대 수상 기록'];
$bh_section=$_GET['section']??'home';
if(!is_string($bh_section)||!isset($bh_sections[$bh_section])){http_response_code(404);exit;}
if(($_SERVER['REQUEST_METHOD']??'GET')!=='GET'){http_response_code(405);exit;}
$bh_review_allowed=(int)($member['mb_level']??0)>=4;
if($bh_section==='review'&&!$bh_review_allowed)http_response_code(403);
$g5['title']=$bh_sections[$bh_section].' · 명예의 전당';
$bh_base=G5_URL.'/theme/Busan_PointZone/honor.php';
$bh_css=G5_URL.'/theme/Busan_PointZone/css/honor.css?v='.filemtime(__DIR__.'/css/honor.css');
add_stylesheet('<link rel="stylesheet" href="'.htmlspecialchars($bh_css,ENT_QUOTES,'UTF-8').'">',125);
function bh_symbol($key,$class='bh-symbol'){
    $paths=[
        'crown'=>'<path d="m3 7 5 6 4-9 4 9 5-6-2.5 13h-13L3 7Z"/><path d="M6 20h12M4 3h.01M12 1h.01M20 3h.01"/>',
        'trophy'=>'<path d="M7 3h10v7a5 5 0 0 1-10 0V3ZM7 5H3v3a4 4 0 0 0 4 4M17 5h4v3a4 4 0 0 1-4 4M12 15v5m-5 1h10"/>',
        'rules'=>'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h6M9 11h6M9 15h4"/>',
        'review'=>'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 15a4 4 0 0 1 5 4v2"/>',
        'vote'=>'<path d="m5 12 2-4h10l2 4M3 12h18v9H3zM8 16h8M9 5l2 2 5-5"/>',
        'history'=>'<path d="M12 5c-3-2-7-2-10-1v16c3-1 7-1 10 1 3-2 7-2 10-1V4c-3-1-7-1-10 1Zm0 0v16"/>',
        'coin'=>'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v5c0 4 16 4 16 0V5M4 10v5c0 4 16 4 16 0v-5M4 15v3c0 4 16 4 16 0v-3"/>',
        'profile'=>'<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
        'star'=>'<path d="m12 2 3 7 7 1-5 5 1 7-6-4-6 4 1-7-5-5 7-1Z"/>'
    ];
    return '<svg class="'.$class.'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'.($paths[$key]??$paths['star']).'</svg>';
}
function bh_laurel($flip=false){
    $out='<svg class="bh-laurel'.($flip?' bh-flip':'').'" viewBox="0 0 90 110" aria-hidden="true"><path d="M83 100C34 92 14 65 27 16" stroke="#c99c53" stroke-width="2.5" fill="none"/>';
    foreach([[28,20,-18],[23,34,-32],[25,49,-44],[31,63,-54],[42,75,-62],[55,86,-73],[70,94,-80]] as [$x,$y,$r]){
        $out.='<g transform="translate('.$x.' '.$y.') rotate('.$r.')"><path d="M0 0Q-17-7-16-25Q1-21 0 0Z" fill="#d5ad61"/><path d="M0 0Q17-8 17-24Q0-20 0 0Z" fill="#f6dda0"/><path d="M0 0-9-17M0 0 10-17" stroke="#9a713a" stroke-width=".7"/></g>';
    }
    return $out.'</svg>';
}
function bh_badge($id,$variant='gold',$class='bh-emblem'){
    $pal=['gold'=>['#fff2c2','#b77828','#543514'],'blue'=>['#e6edfa','#7388b0','#18243f'],'red'=>['#ffe6a6','#b74d4a','#4d1722']];
    [$hi,$mid,$dark]=$pal[$variant]??$pal['gold'];
    $g='bh-g-'.$id;$s='bh-s-'.$id;
    $out='<svg class="'.$class.'" viewBox="0 0 220 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><linearGradient id="'.$g.'" x2=".25" y2="1"><stop stop-color="#fff3c3"/><stop offset=".28" stop-color="#d9ae62"/><stop offset=".56" stop-color="#926028"/><stop offset=".8" stop-color="#ffe2a0"/><stop offset="1" stop-color="#b78437"/></linearGradient><radialGradient id="'.$s.'"><stop stop-color="'.$mid.'"/><stop offset="1" stop-color="'.$dark.'"/></radialGradient></defs>';
    $out.='<circle cx="110" cy="122" r="81" fill="#0d1018" stroke="#664e2e" stroke-width="1"/><circle cx="110" cy="122" r="73" fill="none" stroke="url(#'.$g.')" stroke-width="3"/>';
    foreach([false,true] as $flip){
        $out.='<g'.($flip?' transform="translate(220 0) scale(-1 1)"':'').'><path d="M100 211C40 186 18 137 42 70" stroke="#b98d49" stroke-width="2.5" fill="none"/>';
        foreach([[40,79,-15],[30,96,-30],[29,115,-40],[33,134,-50],[43,151,-60],[56,169,-68],[74,186,-78],[93,199,-85]] as [$x,$y,$r]){
            $out.='<g transform="translate('.$x.' '.$y.') rotate('.$r.')"><path d="M0 0Q-15-8-14-25Q1-21 0 0ZM0 0Q16-7 16-25Q-1-21 0 0Z" fill="url(#'.$g.')"/></g>';
        }$out.='</g>';
    }
    $out.='<path d="M110 60 165 79 158 140Q147 177 110 195 73 177 62 140L55 79Z" fill="url(#'.$g.')" stroke="#ffebac" stroke-width="1.5"/><path d="M110 69 156 86 150 139Q141 168 110 185 79 168 70 139L64 86Z" fill="url(#'.$s.')" stroke="'.$hi.'" stroke-width="1.4"/><path d="m110 92 9 20 22 3-16 15 4 22-19-11-19 11 4-22-16-15 22-3Z" fill="url(#'.$g.')" stroke="#fff1c1" stroke-width="1.5"/>';
    $out.='<path d="m74 40 15 12 21-27 21 27 15-12-9 25H83Z" fill="url(#'.$g.')" stroke="#ffe8ab" stroke-width="1.4"/><circle cx="74" cy="38" r="4" fill="#ffecc3"/><circle cx="110" cy="23" r="5" fill="#ffecc3"/><circle cx="146" cy="38" r="4" fill="#ffecc3"/><path d="M80 67h60" stroke="#fff0ba" stroke-width="2"/><path d="M48 202h124l-7 11 7 12H48l7-12Z" fill="url(#'.$g.')" stroke="#fce5a5" stroke-width="1"/><text x="110" y="217" text-anchor="middle" font-size="10" font-weight="800" fill="#38240c" font-family="Arial,sans-serif">HALL OF FAME</text></svg>';
    return $out;
}
require __DIR__.'/shop/shop.head.php';
$bh_navdesc=['home'=>'명예의 주인공','rules'=>'공정한 선정 기준','review'=>'간부 찬반 심사','vote'=>'최종 후보 투표','history'=>'영구 수상 기록'];
$bh_navicon=['home'=>'trophy','rules'=>'rules','review'=>'review','vote'=>'vote','history'=>'history'];
?>
<div id="bhof">
<section class="bh-stage">
<?php echo bh_symbol('crown','bh-crown'); ?>
<p class="bh-eyebrow">SK홈앤서비스노동조합 부산지부 · HALL OF FAME</p>
<div class="bh-title"><?php echo bh_laurel(); ?><h1>명예의 전당</h1><?php echo bh_laurel(true); ?></div>
<p class="bh-subtitle">헌신과 기여, 그리고 조합원의 인정으로 주어지는 최고의 영예</p>
<?php if($bh_section==='home'){ ?>
<div class="bh-showcase">
<div class="bh-medallion"><?php echo bh_badge('hero'); ?><span class="bh-ribbon">FIRST HONOREE</span></div>
<div class="bh-feature"><p class="bh-eyebrow">THE SEAT OF HONOR</p><h2>당신의 헌신이<br>이 자리를 채웁니다.</h2><p>첫 번째 명예의 주인공을 기다립니다.</p><div class="bh-line"></div><p>명예는 구매할 수 없습니다. 함께하는 마음과 현장의 기여, 조합원들의 인정으로만 얻을 수 있습니다.</p></div>
<aside class="bh-rewards"><h3>수상 혜택</h3><div class="bh-reward"><?php echo bh_symbol('star'); ?> 전용 명예 배지</div><div class="bh-reward"><?php echo bh_symbol('coin'); ?><strong>+1,000P</strong></div><div class="bh-reward"><?php echo bh_symbol('profile'); ?> 프로필 배지 선택</div></aside>
</div><div class="bh-platform"></div>
<?php } ?>
</section>
<div class="bh-content">
<?php if($bh_section==='home'){ ?>
<section class="bh-panel"><h2><?php echo bh_symbol('rules'); ?> 선정 절차</h2><p>명예의 전당은 공정한 절차를 통해 선정됩니다.</p>
<div class="bh-process"><div class="bh-step"><span class="bh-num">01</span><div><strong>활동 기준 충족</strong><p>최소 활동 기준을 충족한 조합원만 후보로 선정</p></div></div><div class="bh-step"><span class="bh-num">02</span><div><strong>4레벨 이상 간부 심사</strong><p>후보별 과반 찬성 시 통과</p></div></div><div class="bh-step"><span class="bh-num">03</span><div><strong>최종 수상자 선정</strong><p>복수 통과 시 상위 2명 조합원 투표</p></div></div></div></section>
<?php } ?>
<nav class="bh-nav" aria-label="명예의 전당 메뉴"><?php foreach($bh_sections as $bh_key=>$bh_label){ ?><a href="<?php echo bpz_theme_escape($bh_base.'?section='.$bh_key); ?>"<?php if($bh_key===$bh_section)echo ' aria-current="page"'; ?>><?php echo bh_symbol($bh_navicon[$bh_key]); ?><span><strong><?php echo bpz_theme_escape($bh_label); ?></strong><small><?php echo bpz_theme_escape($bh_navdesc[$bh_key]); ?></small></span></a><?php } ?></nav>
<?php if($bh_section==='home'){ ?>
<div class="bh-grid">
<section class="bh-panel"><h2><?php echo bh_symbol('crown'); ?> 명예 배지 컬렉션</h2><p>수상자에게만 주어지는 영구 소장 배지.</p><div class="bh-badges"><?php foreach(['gold'=>'명예','blue'=>'동행','red'=>'공헌'] as $bh_color=>$bh_name){ ?><div><?php echo bh_badge('collection-'.$bh_color,$bh_color); ?><strong><?php echo bpz_theme_escape($bh_name); ?> 배지</strong><small>디자인 예시</small></div><?php } ?></div></section>
<section class="bh-panel"><h2><?php echo bh_symbol('trophy'); ?> 역대 수상자</h2><p>부산지부의 자랑스러운 이름을 영원히 기록합니다.</p><div class="bh-empty"><?php echo bh_symbol('trophy'); ?><strong>첫 번째 수상자를 기다립니다.</strong><p>공식 선정 후 실제 기록이 공개됩니다.</p></div></section>
<section class="bh-panel"><h2><?php echo bh_symbol('profile'); ?> 프로필 명예 배지</h2><p>명예를 당신의 프로필에.</p><div class="bh-profile-example"><div class="bh-avatar"><?php echo bh_symbol('profile');echo bh_badge('profile','gold','bh-mini'); ?></div><strong>명예의 전당 수상자</strong><span class="bh-status">프로필 디자인 예시</span></div><p>수상자는 표시 여부를 직접 선택할 수 있습니다.</p></section>
</div>
<?php }else{ ?>
<section class="bh-panel"><h2><?php echo bh_symbol($bh_navicon[$bh_section]);echo bpz_theme_escape($bh_sections[$bh_section]); ?></h2>
<?php if($bh_section==='rules'){ ?><p>명예는 구매할 수 없으며, 조합원들의 인정으로 획득합니다.</p><ol class="bh-list"><li>월별 활동 실적과 최소 기준을 충족한 조합원만 후보가 됩니다.</li><li>4레벨 이상 간부의 후보별 심사에서 과반 찬성 시 통과합니다.</li><li>통과자가 없으면 수상자도 없습니다. 1명이면 선정하고 복수이면 상위 2명 조합원 투표로 1명을 선정합니다.</li><li>전용 명예 배지와 기존 포인트 1,000P를 지급하고 배지 표시는 본인이 선택합니다.</li></ol><p>세부 활동 기준과 투표 일정은 확정 후 공지합니다.</p>
<?php }elseif($bh_section==='review'&&!$bh_review_allowed){ ?><div class="bh-empty"><?php echo bh_symbol('review'); ?><strong>간부 전용 심사 공간</strong><p>4레벨 이상 간부만 심사에 참여할 수 있습니다.</p></div>
<?php }elseif($bh_section==='review'){ ?><div class="bh-empty"><?php echo bh_symbol('review'); ?><strong>현재 진행 중인 심사가 없습니다.</strong><p>자동 심사 생성 기능 구축 후 적격 후보가 발생하면 공개합니다.</p></div>
<?php }elseif($bh_section==='vote'){ ?><div class="bh-empty"><?php echo bh_symbol('vote'); ?><strong>현재 진행 중인 투표가 없습니다.</strong><p>투표 자동 개설 기능 구축 후 복수 후보가 확정되면 공개합니다.</p></div>
<?php }else{ ?><div class="bh-empty"><?php echo bh_symbol('history'); ?><strong>아직 공식 수상 기록이 없습니다.</strong><p>검증된 수상 기록만 공개됩니다.</p></div><?php } ?>
</section><?php } ?>
</div>
<footer class="bh-footer">BUSAN BRANCH · HONOR THROUGH SOLIDARITY</footer>
</div>
<?php require __DIR__.'/shop/shop.tail.php'; ?>
