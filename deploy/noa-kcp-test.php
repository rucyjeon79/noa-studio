<?php
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/kcp-test-core.php';
header('Cache-Control: private, no-store');header('Referrer-Policy: same-origin');header('X-Frame-Options: DENY');header('X-Content-Type-Options: nosniff');
// Provider POSTs can arrive without SameSite cookies. The random server order ID identifies
// an existing test order; the provider validates its ID and stored amount at approval.
$returned=($_SERVER['REQUEST_METHOD']??'GET')==='POST' && isset($_POST['res_cd']);
if ($returned) {
    $id=is_string($_POST['ordr_idxx']??null)?$_POST['ordr_idxx']:'';
    try {
        if ((int)($_SERVER['CONTENT_LENGTH']??0)>100000) throw new DomainException('oversize_return');
        nk_order_key($id);nk_storage();nk_return($id,$_POST,time());
        header('Location: /noa-kcp-test.php?order='.rawurlencode($id),true,303);
    } catch (Throwable $e) { header('Location: /noa-kcp-test.php?returned=unverified',true,303); }
    exit;
}
if (($is_admin??'')!=='super' || empty($member['mb_id'])) { http_response_code(403);exit('최고관리자 로그인 후 KCP 테스트를 진행해 주세요.'); }
$_SESSION['noa_kcp_test_csrf']??=bin2hex(random_bytes(32));
$fields=[];$result=null;$message=isset($_GET['returned'])?'인증 결과를 확인하지 못했습니다. 승인 성공으로 처리하지 않았습니다.':'';
$last=is_string($_GET['order']??null)?$_GET['order']:($_SESSION['noa_kcp_test_last_order']??null);
if (is_string($last)) {
    try { nk_storage();$result=nk_order($last,(string)$member['mb_id']); }
    catch (Throwable $e) { $message='해당 테스트 주문을 확인할 수 없습니다.'; }
}
$mobile=false;
if (($_SERVER['REQUEST_METHOD']??'GET')==='POST') {
    if (($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr' || !is_string($_POST['csrf']??null) || !hash_equals($_SESSION['noa_kcp_test_csrf'],$_POST['csrf'])) {http_response_code(403);exit('요청을 확인할 수 없습니다. 화면을 다시 열어 주세요.');}
    if (time()-(int)($_SESSION['noa_kcp_last_test']??0)<5) { http_response_code(429);$message='잠시 후 다시 시도해 주세요.'; }
    else {
        $_SESSION['noa_kcp_last_test']=time();
        $mobile=($_POST['device']??'')==='mobile';
        try {
            nk_storage();nk_test_certificate();
            $order=nk_create_order((string)$member['mb_id'],time());
            $_SESSION['noa_kcp_test_last_order']=$order['id'];
            $fields=nk_fields($order['id'],$mobile);
            if ($mobile) $fields+=nk_register($fields);
            $result=null;
        } catch (Throwable $e) { $fields=[];$message='테스트 주문을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.';error_log('NOA KCP test: preparation_failed'); }
    }
}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KCP 테스트 연결 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-points.css"><script src="/noa-ui.js" defer></script><script src="/noa-kcp-test.js?v=<?=hash_file('sha256',__DIR__.'/noa-kcp-test.js')?>" defer></script></head><body class="noa-page"><main class="noa-points-page"><p class="noa-eyebrow">KCP · TEST</p><h1>KCP 결제창 연결</h1><p>관리자용 카드 결제창 테스트입니다. 실제 포인트는 지급되지 않습니다.</p><p role="status" id="kcp-notice"><?=nk_h($message)?></p><section><h2>연결 단계</h2><p>① PC·모바일 결제창 연결 테스트</p><p>② 테스트 인증서·서버 승인 연결 — 카드 인증 후 결과 확인</p><p>③ 가맹점 심사·운영 인증서·실결제 전환 — 미완료</p><p>테스트 승인 결과는 별도로 기록하며 실제 잔액은 바뀌지 않습니다. 실결제 연동 완료 상태는 아닙니다.</p></section>
<?php if ($result): $labels=['created'=>'카드 인증 대기','processing'=>'승인 결과 확인 필요 · 재승인 요청 금지','approved'=>'KCP 서버 테스트 승인 확인','declined'=>'KCP 서버 승인 거절','review'=>'승인 결과 확인 필요 · 재승인 요청 금지']; ?>
<section aria-label="최근 테스트 결과"><h2><?=nk_h($labels[$result['state']]??'결과 확인 필요')?></h2><p>주문번호: <?=nk_h($result['id'])?></p><p>테스트 금액: 1,000원 · 실제 지급: 0P</p><?php if ($result['state']==='approved'): ?><p>거래번호: <?=nk_h($result['transactionId'])?></p><p>테스트 포인트 처리: <?=nk_h((string)$result['simulatedPoints'])?>P 기록 · 실제 사용 불가</p><?php endif; ?></section>
<?php if (in_array($result['state'],['declined','review'],true)): ?>
<p>KCP 승인 응답 코드: <?=nk_h((string)($result['responseCode']??'기록 없음'))?></p>
<?php if (!isset($result['responseCode'])): ?><p>이 주문에는 상세 응답 코드가 저장되지 않았습니다. 기존 거절 사유를 확인할 수 없으며, 자동으로 다시 승인 요청하지 않습니다.</p><?php endif; ?>
<?php endif; ?>
<?php endif; ?>
<?php if (!$fields): ?>
<form method="post"><input type="hidden" name="csrf" value="<?=nk_h($_SESSION['noa_kcp_test_csrf'])?>"><fieldset><legend>확인할 기기</legend><label><input type="radio" name="device" value="mobile" checked>모바일 카드 결제창</label><label><input type="radio" name="device" value="pc">PC 카드 결제창</label></fieldset><p>테스트 상품: 1,000원 포인트권 · 지급 포인트 0P</p><button class="noa-button" type="submit">테스트 주문 준비</button></form>
<?php else: ?>
<p>테스트 주문이 준비됐습니다. 카드 결제창을 열어 연결을 확인하세요.</p><form name="order_info" id="kcp-order" method="post" action="/noa-kcp-test.php" data-mobile="<?=$mobile?'1':'0'?>"><?php foreach($fields as $k=>$v):?><input type="hidden" name="<?=nk_h($k)?>" value="<?=nk_h($v)?>"><?php endforeach;?><button type="button" class="noa-button" id="kcp-open">KCP 테스트 결제창 열기</button></form><p><a href="/noa-kcp-test.php">새 테스트 주문</a></p>
<?php endif; ?><p><a href="/noa-payment-settings.php">결제 연결 설정으로 돌아가기</a></p></main></body></html>
