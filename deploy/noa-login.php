<?php
declare(strict_types=1);require_once __DIR__.'/common.php';require_once __DIR__.'/noa-bridge/social-policy.php';
header('Cache-Control: private, no-store');header('Content-Type: text/html; charset=utf-8');
$return=nsp_return($_GET['url']??'/');$providers=nsp_status((array)$config);$esc=static fn($s)=>htmlspecialchars((string)$s,ENT_QUOTES,'UTF-8');
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>로그인 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-account.css?v=<?=hash_file('sha256',__DIR__.'/noa-account.css')?>"><link rel="stylesheet" href="/noa-login.css?v=<?=hash_file('sha256',__DIR__.'/noa-login.css')?>"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script></head><body class="noa-page"><main id="noa-login" class="noa-social-layout"><p class="noa-eyebrow">NOA STUDIO</p><h1>로그인</h1>
<p class="noa-login-welcome">음악으로 이어지는 순간, 별무리와 함께하세요.</p>
<section class="noa-social-signin" aria-label="소셜 계정으로 로그인">
<div class="noa-social-options">
<?php foreach($providers as $provider=>$p): ?>
<div class="noa-social-option">
<?php if($p['ready']): ?>
<a class="noa-social-provider noa-social-<?=$provider?>" href="/bbs/login.php?provider=<?=ucfirst($provider)?>&amp;redirect_to_idp=1&amp;url=<?=rawurlencode($return)?>">
<?php else: ?>
<button class="noa-social-provider noa-social-<?=$provider?>" type="button" disabled aria-describedby="noa-<?=$provider?>-status">
<?php endif; ?>
<?php if($provider==='google'): ?>
<img class="noa-provider-icon" src="/noa-assets/google-login-g.png" width="20" height="20" alt=""><span>Google로 로그인</span>
<?php else: ?>
<svg class="noa-provider-icon" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="#000" d="M12 3C5.373 3 0 7.245 0 12.482c0 3.408 2.278 6.396 5.693 8.066-.251.937-.91 3.396-1.042 3.921-.163.652.238.644.502.469.207-.137 3.296-2.238 4.629-3.145.72.106 1.462.161 2.218.161 6.627 0 12-4.245 12-9.482C24 7.245 18.627 3 12 3Z" transform="translate(2 0) scale(.8333)"/></svg><span>카카오 로그인</span>
<?php endif; ?>
<?php if($p['ready']): ?></a><?php else: ?></button><p id="noa-<?=$provider?>-status" class="noa-muted" role="status"><?=$esc($p['label'])?> 로그인 연결 준비 중</p><?php endif; ?>
</div>
<?php endforeach; ?>
</div>
<p class="noa-social-note">처음 방문하셨나요? 소셜 계정으로 가입할 수 있어요.</p>
</section>
<div class="noa-login-divider"><span>또는 아이디로 로그인</span></div>
<form class="noa-login-form" name="flogin" action="/bbs/login_check.php" method="post">
<input type="hidden" name="url" value="<?=$esc($return)?>">
<label for="login_id">아이디 또는 가입 이메일</label><input id="login_id" name="mb_id" type="text" required maxlength="254" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="아이디 또는 이메일">
<label for="login_pw">비밀번호</label><input id="login_pw" name="mb_password" type="password" required autocomplete="current-password" placeholder="NOA STUDIO 비밀번호" aria-describedby="noa-login-help">
<button class="noa-button primary" type="submit" data-noa-icon="user">로그인</button><a class="noa-login-recovery" href="/bbs/password_lost.php">아이디 · 비밀번호 찾기</a>
<p id="noa-login-help" class="noa-muted">기존 NOA STUDIO 계정의 비밀번호를 입력하세요.</p></form>
<section class="noa-section"><h2>음악을 만드는 당신에게</h2><p class="noa-muted">본인인증과 관리자 승인 후 7레벨 크리에이터·채널·전용 게시판이 개설됩니다. 기존 별무리 회원도 전환 신청할 수 있어요.</p><a class="noa-button" href="/noa-creator-apply.php">크리에이터 가입 신청</a></section><div class="noa-social-links"><a href="/bbs/content.php?co_id=provision">이용약관</a><a href="/bbs/content.php?co_id=privacy">개인정보처리방침</a></div><?php if(($is_admin??'')==='super'):?><p><a href="/adm/config_form.php#anc_cf_sns">구글 · 카카오 연결 설정</a></p><p class="noa-muted">Google 콜백: https://noastudio.ai.kr/plugin/social/?hauth.done=google<br>카카오 콜백: https://noastudio.ai.kr/plugin/social/?hauth.done=kakao</p><?php endif;?></main></body></html>
