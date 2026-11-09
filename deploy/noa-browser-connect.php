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
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>브라우저 연결 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ai-lab.css"><style>.noa-page #browser-app{margin:0 auto;max-width:1280px}#browser-url{overflow-wrap:anywhere}.browser-screen{width:100%;height:auto;display:block;border:1px solid #b4975a;touch-action:manipulation}.browser-controls{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.browser-controls input{min-width:180px;flex:1;padding:12px}.browser-status{padding:12px 0}button{min-height:44px}.browser-screen[hidden]{display:none}</style><script src="/noa-browser-connect.js?v=<?=hash_file('sha256',__DIR__.'/noa-browser-connect.js')?>" defer></script></head><body class="noa-page"><main class="lab-main" id="browser-app" data-csrf="<?=htmlspecialchars($csrf,ENT_QUOTES,'UTF-8')?>"><h1>Gemini·Flow 연결</h1><p><a href="/noa-ai-lab.php?tool=settings">AI·YouTube 연결로 돌아가기</a></p><p>Google 로그인은 아래 브라우저 화면에서 직접 진행하세요. 연결 정보는 N80에 암호화해 보관합니다. 한 번에 최대 15분간 연결하며, 만료되면 다시 열 수 있습니다.</p><p id="browser-status" class="browser-status" role="status">연결 상태를 확인하고 있습니다.</p><div class="browser-controls"><button class="noa-button" id="browser-open">연결 화면 열기</button><button class="noa-button" id="browser-save">연결 저장 후 닫기</button><button class="noa-button" id="browser-close">저장 없이 닫기</button></div><p id="browser-url"></p><img id="browser-screen" class="browser-screen" width="1280" height="900" alt="Google 연결 브라우저 화면. 입력란을 누른 후 아래 입력 도구를 사용하세요." hidden><div class="browser-controls"><button class="noa-button" data-target="gemini">Gemini 확인</button><button class="noa-button" data-target="flow">Flow 확인</button><button class="noa-button" data-key="Tab">다음 입력란</button><button class="noa-button" data-key="Control+a">전체 선택</button><button class="noa-button" data-key="Backspace">지우기</button><button class="noa-button" data-key="Enter">Enter</button><button class="noa-button" data-scroll="-600">위로</button><button class="noa-button" data-scroll="600">아래로</button></div><form id="browser-type" class="browser-controls"><input id="browser-text" type="password" autocomplete="off" aria-label="선택한 입력란에 넣을 내용" placeholder="화면에서 입력란을 누른 후 여기에 입력" maxlength="2048"><button class="noa-button" type="submit">선택한 입력란에 입력</button></form><p>Gemini와 Flow에 로그인한 화면을 각각 확인한 뒤 저장하세요. 이 연결 화면은 영상 제작·공개 게시 완료를 뜻하지 않습니다.</p></main></body></html>
