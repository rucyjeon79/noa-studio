<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Cache-Control: private, no-store');header('Referrer-Policy: same-origin');header('X-Content-Type-Options: nosniff');header('X-Frame-Options: DENY');
if(empty($is_member)&&!isset($_GET['api'])&&($_SERVER['REQUEST_METHOD']??'GET')==='GET'){header('Location: /bbs/login.php?url='.rawurlencode('/noa-notebooklm.php'),true,302);exit;}
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('관리자 로그인이 필요합니다.');}
require_once __DIR__.'/noa-bridge/lab-core.php';
require_once __DIR__.'/noa-app/engine/notebooklm.php';
require_once __DIR__.'/noa-app/engine/notebooklm-oauth.php';
require_once __DIR__.'/noa-app/engine/google-connections.php';
require_once __DIR__.'/noa-app/engine/google-probe.php';
if(empty($_SESSION['n80_notebook_csrf']))$_SESSION['n80_notebook_csrf']=bin2hex(random_bytes(32));$csrf=$_SESSION['n80_notebook_csrf'];
function nnb_json(int $code,array $data):never {http_response_code($code);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_THROW_ON_ERROR|JSON_UNESCAPED_UNICODE);exit;}
function nnb_csrf(string $csrf,mixed $given):void {if(($_SERVER['HTTP_ORIGIN']??'')!==NOA_LAB_ORIGIN||!is_string($given)||!hash_equals($csrf,$given))throw new DomainException('notebook_request_verification_failed');}
function nnb_e(mixed $v):string {return htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$notice=(string)($_SESSION['n80_notebook_notice']??'');unset($_SESSION['n80_notebook_notice']);
try{
 if(isset($_GET['service'])&&($_SERVER['REQUEST_METHOD']??'GET')==='GET'){header('Location: '.n80_google_route((string)$_GET['service']),true,302);exit;}
 if(isset($_GET['api'])){
  if(($_SERVER['REQUEST_METHOD']??'GET')!=='POST')nnb_json(405,['ok'=>false,'error'=>'notebook_post_required']);
  nnb_csrf($csrf,$_SERVER['HTTP_X_N80_CSRF']??null);
  if(strtolower(trim(explode(';',$_SERVER['CONTENT_TYPE']??'')[0]))!=='application/json')nnb_json(415,['ok'=>false,'error'=>'notebook_json_required']);
  $raw=file_get_contents('php://input',false,null,0,1100001);if($raw===false||strlen($raw)>1100000)nnb_json(413,['ok'=>false,'error'=>'notebook_invalid_text']);
  $body=json_decode($raw,true);if(!is_array($body)||array_is_list($body))nnb_json(400,['ok'=>false,'error'=>'notebook_invalid_request']);
  if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
  $action=$body['action']??'';$actor=(string)$member['mb_id'];
  if($action==='google_status')nnb_json(200,['ok'=>true,'google'=>n80_google_overview()]);
  if($action==='google_config')nnb_json(200,n80_google_save_client($body,$actor));
  if($action==='google_check')nnb_json(200,n80_google_check($body,$actor));
  $result=n80_notebook_action($body);
  if(in_array($action,['check','mcp_check','mcp_rest','disconnect'],true))$result['google']=n80_google_overview();
  nnb_json(200,$result);
 }
 if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
  nnb_csrf($csrf,$_POST['csrf']??null);if(($_POST['action']??'')!=='authorize')throw new InvalidArgumentException('notebook_invalid_action');
  header('Location: '.n80_notebook_auth_url($_SESSION,(string)$member['mb_id']),true,303);exit;
 }
 $google=n80_google_overview();$googleClientId=(string)(lab_read()['config']['oauthClientId']??'');
 $status=n80_notebook_status();try{n80_notebook_client();$configured=true;}catch(Throwable $e){$configured=false;}
}catch(Throwable $e){$error=n80_google_error($e);if(isset($_GET['api']))nnb_json($e instanceof InvalidArgumentException?400:409,['ok'=>false,'error'=>$error]);$notice=$error;$google=['services'=>[],'channels'=>[],'clientRevision'=>0];$googleClientId='';$configured=false;$status=['state'=>'check_required','authorized'=>false,'revision'=>0,'receipts'=>[],'lastError'=>$error];}
if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NotebookLM · Google 통합관리 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css?v=<?=hash_file('sha256',__DIR__.'/noa-ui.css')?>"><link rel="stylesheet" href="/noa-notebooklm.css?v=2"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js?v=<?=hash_file('sha256',__DIR__.'/noa-ui.js')?>" defer></script><script src="/noa-notebooklm.js?v=<?=substr(hash_file('sha256',__DIR__.'/noa-notebooklm.js'),0,12)?>" defer></script></head><body class="noa-page"><main class="nnb" id="nnb" data-csrf="<?=nnb_e($csrf)?>" data-notice="<?=nnb_e($notice)?>">
<nav class="nnb-nav" aria-label="상위 메뉴"><a href="/noa-hub.php">← N80 Hub</a><a href="/noa-library.php">홈페이지 설정</a></nav>
<header><p class="noa-eyebrow">N80 ENGINE · GOOGLE CONTROL</p><h1>NotebookLM 통합관리</h1><p>Google 연결과 제작 자료를 한곳에서 관리합니다.</p></header>
<section id="google-connections" aria-labelledby="google-title"><div class="nnb-section-head"><h2 id="google-title">Google 서비스 연결</h2><button type="button" id="google-refresh">전체 상태 새로고침</button></div><p class="nnb-help">N80가 연결을 관리하고 각 서비스의 권한·실행 결과를 구분해 표시합니다.</p><p id="google-message" role="status" hidden></p><div id="google-services" class="ng-services"></div><label for="google-channel">YouTube·Analytics 검사 대상 채널<select id="google-channel"><option value="">연결된 채널 없음</option></select></label><p class="nnb-help">상태 새로고침은 저장된 근거를 읽습니다. 서비스별 ‘API 검사’는 실제 Google 응답을 확인하며, 제작·게시·파일 업로드를 시작하지 않습니다.</p></section>
<section id="google-client"><h2>공통 Google 앱 설정</h2><p class="nnb-help">NotebookLM·YouTube·Drive는 기존 웹 OAuth 앱 설정을 함께 사용합니다. Gemini·Flow 로그인과 회원 Google 로그인은 각 서비스에서 연결합니다.</p><details><summary>Google Client ID·Secret 관리</summary><form id="google-client-form"><label>Client ID<input name="clientId" value="<?=nnb_e($googleClientId)?>" autocomplete="off" required></label><label>Client Secret<input name="clientSecret" type="password" autocomplete="new-password" placeholder="변경할 때만 입력"></label><p class="nnb-help">Client ID를 바꾸면 새 앱의 Secret이 필요하며 연결된 서비스의 재승인이 필요할 수 있습니다.</p><button type="submit">Google 앱 설정 저장</button></form><label>승인된 반환 주소<input readonly value="https://noastudio.ai.kr/noa-bridge/lab-oauth.php"></label></details></section>
<section aria-labelledby="connection-title"><h2 id="connection-title">NotebookLM 자료 연결</h2><p id="nnb-state" role="status">연결 상태 확인 중</p><p id="nnb-message" role="alert" hidden></p><div class="nnb-actions"><form method="post"><input type="hidden" name="csrf" value="<?=nnb_e($csrf)?>"><button id="nnb-authorize" name="action" value="authorize" class="nnb-primary" <?=$configured?'':'disabled'?>>Google 계정 연결</button></form><button type="button" id="nnb-check">연결 확인</button><a href="https://notebook.google.com" target="_blank" rel="noopener noreferrer">NotebookLM 열기 ↗</a></div>
<?php if(!$configured):?><p>먼저 위의 <a href="#google-client">공통 Google 앱 설정</a>을 저장해 주세요.</p><?php endif;?>
<details><summary>처음 연결할 때</summary><ol><li><a href="https://notebook.google.com" target="_blank" rel="noopener noreferrer">NotebookLM</a>에 개인 Google 계정으로 한 번 로그인합니다.</li><li>기존 OAuth 클라이언트가 있는 Google Cloud 프로젝트에서 <a href="https://console.cloud.google.com/apis/library/notebook.googleapis.com" target="_blank" rel="noopener noreferrer">Gemini Notebook API</a>를 활성화합니다.</li><li><a href="https://console.cloud.google.com/auth/scopes" target="_blank" rel="noopener noreferrer">동의 화면의 데이터 액세스</a>에 Notebook 권한을 추가한 뒤 위의 계정 연결을 누릅니다. 테스트 상태라면 사용할 계정을 테스트 사용자에 등록합니다.</li></ol><p>기존 Google 연결의 반환 주소를 그대로 사용합니다. 현재 개인 계정용 API는 미리보기 단계입니다.</p><label>추가할 권한<input readonly value="https://www.googleapis.com/auth/notebook"></label><button type="button" id="nnb-disconnect">N80에서 연결 해제</button><small>저장된 Notebook 연결만 제거합니다. Google의 연결 앱 관리에서는 권한을 별도로 해제할 수 있습니다.</small></details></section>
<section id="mcp-connection" aria-labelledby="mcp-title"><h2 id="mcp-title">N80 MCP 연결</h2><p id="nnb-mcp-state" role="status">연결 검사 전</p><p class="nnb-help">저장된 Google 승인으로 공식 Notebook MCP에 연결합니다. 검사에 성공하면 아래 노트북·자료 작업이 MCP를 사용합니다.</p><div class="nnb-actions"><button type="button" id="nnb-mcp-check">MCP 연결 검사</button><button type="button" id="nnb-mcp-rest">기존 API 사용</button></div><details><summary>연결된 기능</summary><ul id="nnb-mcp-tools"></ul><p class="nnb-help">노트북·자료 관리용 연결입니다. Notebook 질문·이미지·영상 생성은 이 연결에서 제공하지 않습니다.</p></details></section>
<section aria-labelledby="notebooks-title"><div class="nnb-section-head"><h2 id="notebooks-title">내 노트북</h2><button type="button" id="nnb-load">목록 불러오기</button></div><form id="nnb-create" class="nnb-row"><label>새 노트북 이름<input name="title" maxlength="500" placeholder="NOA 제작 자료" required></label><button type="submit">노트북 만들기</button></form><label for="nnb-notebooks">자료를 보낼 노트북</label><select id="nnb-notebooks"><option value="">목록을 불러와 선택해 주세요</option></select><details><summary>선택한 노트북 이름 변경</summary><form id="nnb-rename" class="nnb-row"><label>노트북 이름<input name="title" maxlength="500" required></label><button type="submit">이름 저장</button></form></details><button type="button" id="nnb-more" hidden>노트북 더 보기</button><p id="nnb-empty" hidden>연결된 계정에 노트북이 없습니다. 새 노트북을 만들어 주세요.</p></section>
<section aria-labelledby="source-title"><h2 id="source-title">자료 추가</h2><form id="nnb-add"><label>자료 제목<input name="title" required maxlength="500" placeholder="가사·제작 규칙·참고 자료"></label><label>자료 형식<select name="kind" id="nnb-kind"><option value="text">텍스트 · Markdown</option><option value="url">웹페이지 · YouTube 주소</option></select></label><label id="nnb-text-label">자료 내용<textarea name="text" rows="8" placeholder="노트북에 저장할 내용을 입력하세요."></textarea></label><label id="nnb-url-label" hidden>공개 자료 주소<input name="url" type="url" placeholder="https://"></label><p class="nnb-help">선택한 노트북으로 위 자료를 전송합니다. Google Docs·Drive 주소와 파일 업로드는 아직 지원하지 않습니다.</p><button type="submit" class="nnb-primary">선택한 노트북으로 전송</button></form></section>
<section aria-labelledby="sources-title"><div class="nnb-section-head"><h2 id="sources-title">자료 처리 상태</h2><button type="button" id="nnb-sources-refresh">자료 새로고침</button></div><ul id="nnb-sources" class="nnb-list"></ul><button type="button" id="nnb-sources-more" hidden>자료 더 보기</button><p class="nnb-help">전송 접수와 자료 처리 완료를 구분해 표시합니다. 요약·질문·오디오 제작은 NotebookLM에서 이용해 주세요.</p></section>
<section><h2>최근 전송 기록</h2><ul id="nnb-receipts" class="nnb-list"></ul></section>
<script type="application/json" id="google-initial"><?=json_encode($google,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE)?></script>
<script type="application/json" id="nnb-initial"><?=json_encode($status,JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE)?></script><noscript><p>노트북 관리에는 JavaScript가 필요합니다.</p></noscript>
</main></body></html>
