<?php
// Same native member/session bootstrap. Entry to the independent Youngcart theme
// while the production shopping engine is disabled; no ordering or balance writes.
require_once dirname(__DIR__,2).'/common.php';
if(empty($is_member)||!empty($member['mb_leave_date'])||!empty($member['mb_intercept_date'])){
    alert('부산지부 조합원 로그인 후 이용해 주세요.',G5_BBS_URL.'/login.php?url='.rawurlencode(G5_URL.'/theme/Busan_PointZone/pointzone.php'));
}
require __DIR__.'/shop/index.php';
