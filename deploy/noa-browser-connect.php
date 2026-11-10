<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';require_once __DIR__.'/noa-bridge/lab-core.php';lab_admin();
require_once __DIR__.'/noa-app/engine/ai-lab.php';
if((n80_lab_tools()['browser']['page']??'')!=='noa-browser-connect.php')throw new RuntimeException('n80_browser_not_registered');
require_once __DIR__.'/noa-bridge/browser-control.php';
if(empty($_SESSION['noa_lab_csrf']))$_SESSION['noa_lab_csrf']=bin2hex(random_bytes(32));
$csrf=$_SESSION['noa_lab_csrf'];$owner=(string)$member['mb_id'];
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');header('Referrer-Policy: same-origin');header('X-Frame-Options: SAMEORIGIN');
try{
 if(isset($_GET['api'])){
  if(($_SERVER['REQUEST_METHOD']??'GET')==='GET'){
   if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
   lab_json(200,['ok'=>true]+nb_view(lab_read(),$owner,time()));
  }
  lab_csrf();$b=lab_json_body(8192);if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
  $r=lab_lock(fn(&$s)=>nb_admin($s,$b,$owner,time()));
  if(($b['command']??'')==='open'){require_once __DIR__.'/noa-app/engine/worker-wake.php';$r['wake']=n80_ai_wake();}
  lab_json(200,$r);
 }
}catch(DomainException $e){lab_json(409,['error'=>$e->getMessage()]);}catch(InvalidArgumentException $e){lab_json(400,['error'=>$e->getMessage()]);}catch(Throwable $e){lab_json(503,['error'=>'browser_connection_unavailable']);}
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
?><!doctype html>
<html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Gemini·Flow 연결 | NOA STUDIO</title>
<link rel="stylesheet" href="/noa-ui.css">
<link rel="stylesheet" href="/noa-ai-lab.css">
<link rel="stylesheet" href="/noa-browser-connect.css?v=<?=hash_file('sha256',__DIR__.'/noa-browser-connect.css')?>">
<script src="/noa-brand.js" defer></script>
<script src="/noa-ui.js" defer></script>
<script src="/noa-browser-connect.js?v=<?=hash_file('sha256',__DIR__.'/noa-browser-connect.js')?>" defer></script>
</head><body class="noa-page">
<main class="lab-main" id="browser-app" data-csrf="<?=htmlspecialchars($csrf,ENT_QUOTES,'UTF-8')?>">
<nav aria-label="상위 메뉴"><a class="browser-back" href="/noa-ai-lab.php?tool=settings">← AI·YouTube 연결</a></nav>
<header class="lab-heading browser-heading"><div><p class="noa-eyebrow">AI LAB</p><h1>Gemini·Flow 연결</h1><p class="browser-intro">Google에 로그인한 뒤 두 서비스의 연결을 확인해 주세요.</p></div></header>
<section class="browser-connection" aria-label="Google 연결 화면">
<div class="browser-state"><span class="browser-state-dot" aria-hidden="true"></span><p id="browser-status" role="status" aria-live="polite">연결 상태를 확인하고 있습니다.</p><button type="button" class="noa-button" id="browser-refresh" hidden>상태 다시 확인</button></div>
<p id="browser-feedback" role="alert" hidden></p>
<div id="browser-stage" class="browser-stage" aria-busy="true">
<div id="browser-placeholder" class="browser-placeholder"><span class="browser-loader" aria-hidden="true"></span><strong id="browser-placeholder-title">연결 상태 확인 중</strong><p id="browser-placeholder-help">잠시만 기다려 주세요.</p><p id="browser-elapsed" hidden></p></div>
<img id="browser-screen" class="browser-screen" width="1280" height="900" alt="Google 연결 브라우저 화면. 입력란을 누른 후 아래 입력 도구를 사용하세요." hidden>
</div>
<p id="browser-url" hidden></p>
<div id="browser-interaction" hidden>
<div class="browser-keyboard-row"><button type="button" class="noa-button" id="browser-keyboard" disabled>키보드 열기</button><p>Google 화면에서 입력란을 선택한 뒤 키보드를 열어 주세요.</p></div>
<p id="browser-input-status" role="status" hidden></p>
<div class="browser-services" aria-label="서비스 확인"><button type="button" class="noa-button" data-target="gemini" disabled>Gemini 확인</button><button type="button" class="noa-button" data-target="flow" disabled>Flow 확인</button></div>
<form id="browser-type"><label for="browser-text">여기에 입력한 뒤 입력하기를 누르면 선택한 Google 입력란에 전달됩니다.</label><div class="browser-input-row"><input id="browser-text" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" enterkeyhint="send" aria-label="선택한 입력란에 넣을 내용" placeholder="이메일 또는 비밀번호 입력" maxlength="2048" disabled><button class="noa-button" type="submit" disabled>입력하기</button></div></form>
<details class="browser-tools"><summary>키보드·스크롤 도구</summary><div class="browser-keys"><button type="button" class="noa-button" data-key="Tab" disabled>다음 입력란</button><button type="button" class="noa-button" data-key="Control+a" disabled>전체 선택</button><button type="button" class="noa-button" data-key="Backspace" disabled>지우기</button><button type="button" class="noa-button" data-key="Enter" disabled>Enter</button><button type="button" class="noa-button" data-scroll="-600" disabled>위로</button><button type="button" class="noa-button" data-scroll="600" disabled>아래로</button></div></details>
</div>
<div class="browser-actions"><button type="button" class="noa-button primary" id="browser-open" disabled>연결 화면 열기</button><button type="button" class="noa-button primary" id="browser-save" hidden disabled>연결 저장 후 닫기</button><button type="button" class="noa-button" id="browser-close" hidden disabled>저장 없이 닫기</button></div>
</section>
<p class="browser-note">연결 정보는 암호화해 보관하며, 연결 화면은 최대 15분간 사용할 수 있습니다.</p>
<p class="browser-note">로그인 연결만 설정하며 영상 제작·게시는 시작하지 않습니다.</p>
<noscript><p>연결 화면을 사용하려면 브라우저에서 JavaScript를 켜 주세요.</p></noscript>
</main></body></html>
