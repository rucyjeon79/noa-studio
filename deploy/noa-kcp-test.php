<?php
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/kcp-test-core.php';
header('Cache-Control: private, no-store');header('Referrer-Policy: same-origin');header('X-Frame-Options: DENY');header('X-Content-Type-Options: nosniff');
// Provider return is intentionally not a payment approval. Do not echo or persist encrypted/card data.
$returned=($_SERVER['REQUEST_METHOD']??'GET')==='POST' && isset($_POST['res_cd']);
if ($returned) {
    header('Location: /noa-kcp-test.php?returned=1',true,303);exit;
}
if (($is_admin??'')!=='super') { http_response_code(403);exit('최고관리자 로그인 후 KCP 테스트를 진행해 주세요.'); }
$_SESSION['noa_kcp_test_csrf']??=bin2hex(random_bytes(32));
$fields=[];$message=isset($_GET['returned'])?'결제창에서 돌아왔습니다. 이 단계에서는 승인 API를 호출하지 않으며 포인트도 지급하지 않습니다.':'';
$mobile=false;
if (($_SERVER['REQUEST_METHOD']??'GET')==='POST') {
    if (($_SERVER['HTTP_ORIGIN']??'')!=='https://noastudio.ai.kr' || !is_string($_POST['csrf']??null) || !hash_equals($_SESSION['noa_kcp_test_csrf'],$_POST['csrf'])) {http_response_code(403);exit('요청을 확인할 수 없습니다. 화면을 다시 열어 주세요.');}
    if (time()-(int)($_SESSION['noa_kcp_last_test']??0)<5) { http_response_code(429);$message='잠시 후 다시 시도해 주세요.'; }
    else {
        $_SESSION['noa_kcp_last_test']=time();
        $mobile=($_POST['device']??'')==='mobile';
        $fields=nk_fields('NK'.bin2hex(random_bytes(16)),$mobile);
        $_SESSION['noa_kcp_test_order']=['id'=>$fields['ordr_idxx'],'amount'=>1000,'createdAt'=>time(),'mode'=>'test'];
        try { if ($mobile) $fields+=nk_register($fields); }
        catch (Throwable $e) { $fields=[];$message='모바일 거래등록을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.';error_log('NOA KCP test registration: '.(str_starts_with($e->getMessage(),'register_rejected:')?$e->getMessage():'connection_or_response_error')); }
    }
}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KCP 테스트 연결 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-points.css"><script src="/noa-ui.js" defer></script><script src="/noa-kcp-test.js?v=<?=hash_file('sha256',__DIR__.'/noa-kcp-test.js')?>" defer></script></head><body class="noa-page"><main class="noa-points-page"><p class="noa-eyebrow">KCP · TEST</p><h1>KCP 결제창 연결</h1><p>관리자용 카드 결제창 테스트입니다. 실제 포인트는 지급되지 않습니다.</p><p role="status" id="kcp-notice"><?=nk_h($message)?></p><section><h2>연결 단계</h2><p>① PC·모바일 결제창 연결 테스트</p><p>② 서비스 인증서 등록 후 서버 승인 검증 — 미완료</p><p>③ 가맹점 심사·운영 전환 — 미완료</p><p>현재는 결제창 호출과 복귀까지만 확인합니다. KCP 신청 화면에 전체 연동 완료로 표시할 단계는 아닙니다.</p></section>
<?php if (!$fields): ?>
<form method="post"><input type="hidden" name="csrf" value="<?=nk_h($_SESSION['noa_kcp_test_csrf'])?>"><fieldset><legend>확인할 기기</legend><label><input type="radio" name="device" value="mobile" checked>모바일 카드 결제창</label><label><input type="radio" name="device" value="pc">PC 카드 결제창</label></fieldset><p>테스트 상품: 1,000원 포인트권 · 지급 포인트 0P</p><button class="noa-button" type="submit">테스트 주문 준비</button></form>
<?php else: ?>
<p>테스트 주문이 준비됐습니다. 카드 결제창을 열어 연결을 확인하세요.</p><form name="order_info" id="kcp-order" method="post" action="/noa-kcp-test.php" data-mobile="<?=$mobile?'1':'0'?>"><?php foreach($fields as $k=>$v):?><input type="hidden" name="<?=nk_h($k)?>" value="<?=nk_h($v)?>"><?php endforeach;?><button type="button" class="noa-button" id="kcp-open">KCP 테스트 결제창 열기</button></form><p><a href="/noa-kcp-test.php">새 테스트 주문</a></p>
<?php endif; ?><p><a href="/noa-payment-settings.php">결제 연결 설정으로 돌아가기</a></p></main></body></html>
