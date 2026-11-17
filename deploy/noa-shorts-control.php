<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('관리자 로그인이 필요합니다.');}
require_once __DIR__.'/noa-app/engine/shorts-monitor.php';
require_once __DIR__.'/noa-bridge/lab-core.php';
$owner=(string)$member['mb_id'];$root=n80_hub_root();$message='';$failed=false;
if(empty($_SESSION['n80_shorts_csrf']))$_SESSION['n80_shorts_csrf']=bin2hex(random_bytes(32));
$csrf=$_SESSION['n80_shorts_csrf'];
try{
 if(($_SERVER['REQUEST_METHOD']??'GET')==='POST'){
  if(!is_string($_POST['csrf']??null)||!hash_equals($csrf,$_POST['csrf']))throw new DomainException('request_verification_failed');
  $action=$_POST['action']??'';
  if(in_array($action,['start','youtube_check'],true)){
   if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
   set_time_limit($action==='youtube_check'?30:15);
   n80_shorts_monitor_start($root,$owner,(string)($_POST['requestId']??''),$action==='youtube_check'?'youtube':'clock');
  }
  elseif(in_array($action,['production_start','recover'],true)){
   require_once __DIR__.'/noa-bridge/session-shorts-control.php';
   if($action==='production_start')nsc_start($owner);
   else nsc_recover($owner,(string)($_POST['requestId']??''),(string)($_POST['note']??''));
  }else throw new DomainException('unknown_control_action');
  header('Location: /noa-shorts-control.php',true,303);exit;
 }
 if(session_status()===PHP_SESSION_ACTIVE)session_write_close();
 $observed=n80_shorts_monitor_observe($root);
 $data=n80_shorts_monitor_snapshot($observed['hub'],lab_read(750),$observed['trial'],$owner,time());
}catch(Throwable $e){$failed=true;$message='상태를 읽거나 시험을 요청하지 못했습니다. 새로고침 후 확인해 주세요.';$data=['ok'=>false,'error'=>'monitor_unavailable'];}
if(($_GET['format']??'')==='json'){if($failed)http_response_code(503);header('Content-Type: application/json; charset=utf-8');echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES|JSON_THROW_ON_ERROR);exit;}
function nsc_e($v):string{return htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N80 쇼츠 실시간 관제</title><link rel="stylesheet" href="/noa-ui.css"><style>
main{max-width:1050px;margin:auto;padding:28px 18px}header,.control-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}h1{font-size:28px}h2{font-size:19px}section{padding:20px 0;border-bottom:1px solid var(--noa-line)}p,li{line-height:1.7}.muted{color:var(--noa-muted)}.warning{color:var(--noa-danger)}.ok{color:var(--noa-success)}.scroll{overflow:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:12px 8px;border-bottom:1px solid var(--noa-line);vertical-align:top}th{white-space:nowrap}button{min-height:44px}#events{padding-left:22px}#events li{margin:10px 0}#live-state{font-weight:700}.metrics{display:flex;flex-wrap:wrap;gap:14px 28px}@media(max-width:600px){h1{font-size:24px}th,td{font-size:14px;padding:10px 5px}}
</style><script src="/noa-shorts-control.js?v=<?=hash_file('sha256',__DIR__.'/noa-shorts-control.js')?>" defer></script></head><body class="noa-page"><main>
<div class="control-bar"><div><p class="noa-eyebrow">N80 AUTO · CONTROL ROOM</p><h1>N80 쇼츠 실시간 관제</h1></div><a href="/noa-work-status.php#n80-shorts">쇼츠 작업 지시</a></div>
<p>현재 상태와 실제 점검 결과를 확인합니다. 진행 중인 제작 작업이 있을 때만 최대 1분 동안 자동 조회하며, 화면을 여는 것만으로 제작을 시작하지 않습니다.</p>
<?php if($message):?><p role="alert"><?=nsc_e($message)?></p><?php endif;?>
<section aria-labelledby="trial-heading"><h2 id="trial-heading">호스트 단발 점검</h2><p id="live-state" aria-live="polite">상태 확인 중</p><p id="last-checked" class="muted"></p><div class="control-bar"><form method="post"><input type="hidden" name="csrf" value="<?=nsc_e($csrf)?>"><input type="hidden" name="requestId" value="<?=bin2hex(random_bytes(16))?>"><button type="submit" name="action" value="start" class="noa-button">현재 데이터로 읽기 전용 점검</button></form><button id="refresh" class="noa-button" type="button">상태 새로고침</button></div><p class="muted">실제 N80 쇼츠 모듈로 현재 일정과 준비 상태를 계산합니다. 점검 기록만 저장하며 원본 데이터·작업·파일은 변경하지 않습니다. 영상 제작·게시와 예약 활성화는 실행하지 않습니다.</p><ol id="events"></ol></section>
<section aria-labelledby="youtube-heading"><h2 id="youtube-heading">YouTube 연결 확인</h2><p id="youtube-check" aria-live="polite">아직 실제 연결을 확인하지 않았습니다.</p><form method="post"><input type="hidden" name="csrf" value="<?=nsc_e($csrf)?>"><input type="hidden" name="requestId" value="<?=bin2hex(random_bytes(16))?>"><button type="submit" name="action" value="youtube_check" class="noa-button">채널·재생목록 연결 확인</button></form><p class="muted">현재 인증으로 쇼츠 대상 채널과 게시 재생목록의 소유권을 확인합니다. 최대 3회 요청하고 결과만 기록합니다. 영상 업로드·게시 설정 변경은 하지 않으며, 이 결과는 확인 시점의 조회 권한을 나타냅니다.</p></section>
<section><h2>현재 쇼츠 제작</h2><p id="job-title"></p><div class="metrics" id="job-progress"></div><p id="job-block" class="warning"></p><p id="schedule" class="muted"></p></section>
<section><h2>N80 → 챗지 요청</h2><p id="chat-request"></p><p>유효한 N80 요청이 도착하기 전에는 챗지가 기획·이미지·영상 제작을 독자적으로 시작하지 않습니다. 현재 시험은 활성 대화를 수신기로 사용하며, 대화 종료 후 자동 깨우기는 아직 검증되지 않았습니다.</p>
<form method="post"><input type="hidden" name="csrf" value="<?=nsc_e($csrf)?>"><button name="action" value="production_start" class="noa-button">최종 업로드까지 제작 시험 시작</button></form>
<form method="post" id="recovery-form" hidden><input type="hidden" name="csrf" value="<?=nsc_e($csrf)?>"><input type="hidden" name="requestId" id="recovery-request"><label for="recovery-note">N80 복구 요청에 대한 수정 내용</label><textarea id="recovery-note" name="note" minlength="20" maxlength="1500" required style="display:block;width:100%;min-height:100px"></textarea><button name="action" value="recover" class="noa-button">복구 응답 저장</button></form>
</section>
<section><h2>실행 담당과 확인된 범위</h2><div class="scroll"><table><thead><tr><th>작업</th><th>담당</th><th>현재 확인 결과</th></tr></thead><tbody>
<tr><th>예약·준비 상태 점검</th><td>N80 자체 실행</td><td id="clock-capability">실행 기록 확인 중</td></tr>
<tr><th>작업·파일 저장, 중복·한도 검사</th><td>N80 서버</td><td>기존 기능 제공 · 요청을 받아 처리하는 기능이며 영상 생성 자체를 뜻하지 않음</td></tr>
<tr><th>곡 선정·기획·프롬프트·작업오더</th><td>N80 요청 → 챗지</td><td>N80 호스트 요청 발행 → 활성 대화 수신 · 대화 종료 후 자동 깨우기는 미검증</td></tr>
<tr><th>영상·음원·자막 검수와 수정오더</th><td>N80 요청 → 챗지</td><td>요청·응답 연결 필요 · 실제 결과를 보고 검수</td></tr>
<tr><th>Gemini·Flow 생성 도구 실행</th><td>N80 실행기 필요</td><td id="browser-capability">상시 실행기 연결 미완료 · 대화 브라우저 실행과 구분</td></tr>
<tr><th>장면 편집·원음·자막 합성</th><td>N80 실행기 필요</td><td>검수된 장면·자막 및 합성 실행 연결 필요</td></tr>
<tr><th>YouTube 예약 게시·공개 확인</th><td>N80 실행기</td><td id="publish-capability">게시 준비 상태 확인 중</td></tr>
</tbody></table></div></section>
<section><h2>중단 원인</h2><ul id="blockers"></ul><p class="muted">호스트가 실행 중이라는 표시와 쇼츠 제작 완료는 별개입니다. 실행 기록이 없는 작업은 완료로 표시하지 않습니다.</p></section>
<script type="application/json" id="initial-state"><?=json_encode($data,JSON_UNESCAPED_UNICODE|JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_THROW_ON_ERROR)?></script>
</main></body></html>
