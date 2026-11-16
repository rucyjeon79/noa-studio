<?php
declare(strict_types=1);require_once __DIR__.'/noa-app/user-display.php';
require_once __DIR__.'/common.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('관리자 로그인이 필요합니다.');}
require_once __DIR__.'/noa-app/engine/hub.php';
require_once __DIR__.'/noa-app/engine/registry.php';
require_once __DIR__.'/noa-app/engine/system-status.php';
require_once __DIR__.'/noa-app/engine/system-view.php';
$root=n80_hub_root();$message='';$failed=false;
if(empty($_SESSION['n80_hub_csrf']))$_SESSION['n80_hub_csrf']=bin2hex(random_bytes(32));
$csrf=$_SESSION['n80_hub_csrf'];
try{
 if(($_SERVER['REQUEST_METHOD']??'')==='POST'){
  if(!is_string($_POST['csrf']??null)||!hash_equals($csrf,$_POST['csrf']))throw new DomainException('인증 정보가 바뀌었습니다. 화면을 새로 열어 주세요.');
  $action=$_POST['action']??'';$revision=filter_var($_POST['revision']??null,FILTER_VALIDATE_INT);
  if(in_array($action,['source_download','history_download','increment_download','package_download'],true)){
   $source=n80_hub_read($root,'source.json');
   if($action==='increment_download'){
    $index=filter_var($_POST['index']??null,FILTER_VALIDATE_INT);$row=$index!==false&&$index>=0?($source['history'][$index]??null):null;
    if(!$row||!preg_match('/^history-[a-f0-9]{40}[.]bundle$/D',$row['file']??''))throw new DomainException('hub_source_missing');
    $name=$row['file'];$expected=$row['sha256'];
   }elseif($action==='package_download'){
    $index=filter_var($_POST['index']??null,FILTER_VALIDATE_INT);$releases=n80_hub_read($root,'releases.json');$row=$index!==false&&$index>=0?($releases[$index]??null):null;
    if(!$row||!preg_match('/^[a-f0-9]{32}$/D',$row['id']??''))throw new DomainException('hub_source_missing');
    if(!empty($row['backup']['url'])&&preg_match('~^https://drive[.]google[.]com/file/d/[A-Za-z0-9_-]+/~',$row['backup']['url'])){header('Location: '.$row['backup']['url']);exit;}
    $name='releases/'.$row['id'].'.json';$expected=$row['packageSha256'];
   }else{$history=$action==='history_download';$name=$history?'source.bundle':'source-initial.tar.gz';$expected=$source[$history?'bundleSha256':'sha256']??'';}
   if(!is_file($root.'/'.$name)&&is_file($root.'/storage/state.json')){$store=n80_hub_read($root.'/storage','state.json');foreach($store['groups']??[]as $g)if(($g['state']??'')==='cleaned')foreach($g['files']??[]as $f)if(($f['path']??'')==='noa-hub/'.$name&&!empty($g['url'])){header('Location: '.$g['url']);exit;}}
   $archive=$root.'/'.$name;if(is_link($archive)||!is_file($archive)||realpath($archive)!==$archive||hash_file('sha256',$archive)!==$expected)throw new DomainException('hub_source_checksum');
   header('Content-Type: application/octet-stream');header('Content-Disposition: attachment; filename="N80-Hub-'.basename($name).'"');header('Content-Length: '.filesize($archive));readfile($archive);exit;
  }elseif($action==='release'){
   if(($_FILES['package']['error']??UPLOAD_ERR_NO_FILE)!==UPLOAD_ERR_OK||!is_uploaded_file($_FILES['package']['tmp_name'])||$_FILES['package']['size']>12582912)throw new DomainException('패키지 파일을 확인해 주세요.');
   require_once __DIR__.'/noa-app/engine/hub-release.php';
   $package=json_decode((string)file_get_contents($_FILES['package']['tmp_name']),true,32,JSON_THROW_ON_ERROR);
   $receipt=n80_hub_release_apply($root,__DIR__,$package,(int)($_POST['sourceRevision']??-1));$message='배포 완료 · '.$receipt['revision'].'번째 소스 · 파일 '.count($receipt['files']).'개 검증';
  }elseif($action==='reconcile_cover_noop'){
   $id=(string)($_POST['executionId']??'');
   if(!preg_match('/^[a-f0-9]{32}$/D',$id))throw new DomainException('hub_invalid_execution');
   require_once __DIR__.'/noa-app/engine/media-covers.php';
   require_once __DIR__.'/noa-bridge/storage.php';
   require_once __DIR__.'/noa-bridge/sound-core.php';
   require_once __DIR__.'/noa-bridge/music-readmodel.php';
   require_once __DIR__.'/noa-bridge/package-record.php';
   require_once __DIR__.'/noa-bridge/suno-cover.php';
   if(count(n80_media_cover_inventory(noa_bridge_pdo())['rows']??[])!==0)throw new DomainException('hub_cover_inventory_not_empty');
   n80_hub_locked($root,function()use($root,$id){
    $rows=n80_hub_read($root,'receipts.json');$result=n80_hub_read($root,'covers-result.json');$found=false;
    foreach($rows as &$row){
     if(($row['id']??'')!==$id||($row['operation']??'')!=='covers.refresh')continue;
     $start=(int)($row['startedAt']??0);$end=(int)($result['checkedAt']??0);
     if(($row['state']??'')!=='running'||$start<=0||$end<$start||$end>$start+90
       ||($result['ok']??false)!==true||(int)($result['attempted']??-1)!==0
       ||(int)($result['recovered']??-1)!==0||(int)($result['remaining']??-1)!==0
       ||(int)($result['audioFilesChanged']??-1)!==0)throw new DomainException('hub_cover_evidence_incomplete');
     $row['state']='reconciled_noop';$row['finishedAt']=time();
     $row['reconciliation']=['mode'=>'admin_verified_noop','executionId'=>$id,'checkedAt'=>$end,'verifiedAt'=>time(),'inventoryRemaining'=>0];
     $found=true;break;
    }unset($row);
    if(!$found)throw new DomainException('hub_cover_receipt_missing');
    n80_hub_write($root,'receipts.json',$rows);
   });
   $message='이미지 처리 대상이 없음을 확인하여 미종료 기록을 정리했습니다.';
  }elseif($action==='recover'){require_once __DIR__.'/noa-app/engine/hub-release.php';if(!n80_hub_release_recover($root,__DIR__))throw new DomainException('hub_concurrent_source_change');$message='중단된 배포를 복구했습니다.';}elseif(in_array($action,['pause','resume','start','wake'],true)){
 throw new DomainException('기존 상주 실행 및 예약 요청은 폐기되었습니다.');
 }
  else throw new DomainException('허용되지 않은 요청입니다.');
 }
 $status=n80_hub_status($root);$releases=n80_hub_read($root,'releases.json');
}catch(Throwable $e){$failed=true;$message=noa_display_error($e->getMessage());$status=['revision'=>0,'paused'=>true,'runnerState'=>'not_verified','source'=>[],'operations'=>[],'dependencies'=>[],'receipts'=>[]];}
$system=n80_system_snapshot(__DIR__,$root);$operationStates=array_column($system['operations'],'state','id');
function nh_e($s):string{return htmlspecialchars((string)$s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N80 Hub | <?=nh_e($system['identity']['productName'])?></title><link rel="stylesheet" href="/noa-app/engine/system.css?v=<?=hash_file('sha256',__DIR__.'/noa-app/engine/system.css')?>"><link rel="stylesheet" href="/noa-ui.css"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js?v=20261111-copy1" defer></script><style>
.hub{max-width:1050px;margin:auto;padding:24px 16px}.hub-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.hub h1{margin:8px 0;font-size:32px}.hub p{color:var(--noa-muted)}.hub section{padding:24px 0;border-bottom:1px solid var(--noa-line)}.hub h2{font-size:18px}.hub table{border-collapse:collapse;width:100%;font-size:14px}.hub td,.hub th{text-align:left;padding:12px 8px;border-bottom:1px solid var(--noa-line)}.hub th{color:var(--noa-muted)}.hub form{margin:0}.hub button,.hub input{font:inherit;min-height:44px;border:1px solid var(--noa-line);border-radius:6px;background:var(--noa-surface);color:var(--noa-text);padding:8px 14px}.hub button{cursor:pointer}.hub .ok{color:var(--noa-success)}.hub .wait{color:var(--noa-warning)}.hub .error{color:var(--noa-danger)}.hub-scroll{overflow:auto}.hub-bar{display:flex;gap:12px;align-items:center;flex-wrap:wrap}.hub details{margin:14px 0}.hub summary{cursor:pointer;min-height:44px}.hub small{color:var(--noa-muted)}@media(max-width:600px){.hub-head{align-items:flex-start}.hub h1{font-size:26px}.hub th,.hub td{padding:10px 5px}.hub button{padding:8px}.hub .hide-mobile{display:none}}</style></head><body class="noa-page"><main class="hub">
<div class="hub-head"><div><p class="noa-eyebrow">홈페이지 설정</p><h1>N80 Hub</h1><p>소스·배포·자동화·실행 기록을 한곳에서 관리합니다.</p></div><a href="/noa-library.php">홈페이지 설정</a></div>
<?php if($message):?><p role="status" class="<?=$failed?'error':'ok'?>"><?=nh_e($message)?></p><?php endif;?>
<?php n80_system_render($system,true); ?>
<section id="n80-version-management" aria-labelledby="n80-version-heading">
<h2 id="n80-version-heading">3단계 버전 관리</h2>
<p><strong>현재 버전 <?=nh_e($system['version']['display']??('2.1.'.($status['source']['revision']??0)))?></strong> · 내부 배포번호 #<?=nh_e($status['source']['revision']??0)?></p>
<p>제품 개발단계 · N80 엔진 개발단계 · 운영 리비전 순서로 표시합니다.</p>
<p>엔진 단계 승격 조건:
<strong><?=!empty($system['versionReadiness']['engineEligible'])?'기본 실행 검증 충족 · 승인 기록 필요':'실행 검증 확인 필요 · 승격 보류'?></strong></p>
<p>제품 단계 승격은 전체 기능 검증까지 완료되어야 합니다. 단계 승격은 승인된 배포에서만 처리하며, 운영 리비전은 1부터 새로 시작합니다. 과거 배포번호와 백업 이력은 유지됩니다.</p>
</section>
<section><h2>곡 이미지 미종료 기록 복구</h2><p>처리 시도 0건 및 현재 누락 0건을 재검증한 경우에만 기록을 정리합니다. 음원과 알림은 변경하지 않습니다.</p><form method="post"><input type="hidden" name="csrf" value="<?=nh_e($csrf)?>"><input type="hidden" name="action" value="reconcile_cover_noop"><input type="hidden" name="executionId" value="<?=nh_e((string)(array_values(array_filter($status['operations']??[],static fn($o)=>($o['id']??'')==='covers.refresh'))[0]['last']['id']??''))?>"><button type="submit">곡 이미지 미종료 기록 안전 복구</button></form></section><section><h2>실행 구조</h2><div class="hub-bar"><strong class="ok">기존 상주 실행기 영구 폐기</strong><span>닷홈 CPU·메모리 과부하 재발 방지</span><a href="/noa-hub.php">상태 새로고침</a></div><p>구형 프로세스 시작·재개·반복 하트비트는 허용하지 않습니다. 사용자 요청은 인증된 N80 개별 처리 경로를 사용하며 예약 Wake는 승인 및 검증 후 연결합니다.</p></section>

<?php
$wakeCheckLabels=[
 'residentRunnerRemoved'=>'구형 상주 실행기 파일 제거',
 'legacyStopLatched'=>'구형 실행 중지 상태',
 'githubSignalOnly'=>'GitHub는 서명 신호만 전송',
 'dedicatedKeyMetadataSecure'=>'전용 서명키 파일 권한',
 'clockConfigMatchesSender'=>'예약 시간 일치',
 'hostingApproval'=>'닷홈 호스팅 승인',
 'boundedExecutor'=>'N80 단발 실행기 검증',
 'oneShotOwnerEnabled'=>'별도 실행 허용 및 긴급정지 설정',
 'hostWakePolicyActivated'=>'예약 수신 활성화',
];
$wakeReport=is_array($system['wakePreflight']??null)?$system['wakePreflight']:[];
$wakeChecks=is_array($wakeReport['checks']??null)?$wakeReport['checks']:[];
$wakeReady=!empty($wakeReport['eligibleForSignedCanary'])&&count($wakeChecks)===count($wakeCheckLabels);
$batchReview=array_values(array_filter($system['guardTriage']['items']??[],static fn($row):bool=>
 is_array($row)&&($row['operation']??'')==='ai.batch'&&($row['unconfirmed']??false)===true));
?>
<section id="n80-wake-preflight" aria-labelledby="n80-wake-preflight-heading">
 <h2 id="n80-wake-preflight-heading">예약 단발 실행 · 사전검증</h2>
 <p role="status"><strong><?= $wakeReady?'신호 수신 시험 대상 · 실전 검증 미완료':(empty($wakeChecks)?'사전검증 조회 불가':'연결 준비 중 · 예약 실행 비활성') ?></strong></p>
 <p>실제 운영 상태를 읽은 결과입니다. 점검 통과는 자동쇼츠 제작·게시 성공을 의미하지 않습니다.</p>
 <div class="hub-scroll"><table>
  <caption>구형 상주 실행기는 영구 폐기되며 GitHub는 승인된 예약 신호만 전송합니다.</caption>
  <thead><tr><th scope="col">검증 항목</th><th scope="col">현재 상태</th></tr></thead>
  <tbody>
  <?php foreach($wakeCheckLabels as $key=>$label):
   $observed=array_key_exists($key,$wakeChecks);
   $pass=$observed&&$wakeChecks[$key]===true; ?>
   <tr><th scope="row"><?=nh_e($label)?></th><td><span class="<?=$pass?'ok':'error'?>"><?= $pass?'통과':($observed?'미충족':'확인 불가') ?></span></td></tr>
  <?php endforeach; ?>
  </tbody>
 </table></div>
 <?php
 $ticketAudit=is_array($system['wakeTicketAudit']??null)?$system['wakeTicketAudit']:[];
 $ticketAuditVerified=($ticketAudit['ok']??false)===true;
 ?>
 <p role="status"><strong>서명된 예약 신호:</strong>
 <?php if($ticketAuditVerified): ?>
  <?=nh_e((int)($ticketAudit['signalCount']??0))?>건 수신 기록 ·
  <?=nh_e((int)($ticketAudit['staleCount']??0))?>건 검토 필요
 <?php else: ?>수신 기록 확인 필요<?php endif; ?>
 </p>
 <p>예약 신호는 작업 실행 증거가 아닙니다. 신호 미확정·지연 시 자동 재실행하지 않고 원본 기록과 실제 제작 결과를 별도로 확인합니다.</p>
 <?php if($batchReview): ?>
 <p role="status"><strong>미확정 묶음 작업 <?=nh_e(count($batchReview))?>건:</strong> 실행 결과가 확인되지 않았습니다. 기존 기록을 보존하고 중복 생성을 막기 위해 자동 재시도하지 않습니다.</p>
 <?php endif; ?>
 <p>이 화면은 조회 전용입니다. 승인·인증키 설정·무인 제작·게시·예약 활성화 작업을 실행하지 않습니다.</p>
</section>

<section><h2>N80 작업 연결 현황</h2><div class="hub-scroll"><table><thead><tr><th>기능</th><th>실행 담당</th><th>마지막 결과</th><th>처리 방식</th></tr></thead><tbody>
<?php foreach($status['operations'] as $op):?><tr><td><?=nh_e($op['label'])?></td><td><span><?=nh_e(n80_module($op['module'])['label']??$op['module'])?></span><br><small><?=$op['owner']==='n80_hub'?'구형 실행 차단':'연결 대기'?></small></td><td><?=nh_e(n80_system_label($operationStates[$op['id']]??'not_verified'))?></td><td><small>개별 요청 시 검증 후 처리</small></td></tr><?php endforeach;?></tbody></table></div><?php if(!empty($status['covers']['checkedAt'])&&($status['covers']['ok']??false)===true):?><p>카드 이미지: 최근 보완 <?=nh_e($status['covers']['recovered']??0)?>개 · 대기 <?=nh_e($status['covers']['remaining']??0)?>개</p><?php endif;?></section>
<section><h2>Google 통합관리</h2><p>Gemini·Flow·YouTube·Drive·Google 로그인과 제작 자료를 NotebookLM 통합관리에서 확인합니다.</p><a href="/noa-notebooklm.php">NotebookLM · Google 통합관리 →</a></section>
<section><h2>호스트 용량·백업</h2><p>백업은 Google Drive에 보관합니다. 호스트에는 실행 파일·운영 데이터·복원 위치 기록을 유지합니다.</p><a href="/noa-storage.php">용량 확인·Drive 백업 관리 →</a></section><section><h2>소스·배포</h2><p>소스 버전 <?=nh_e($status['source']['revision']??0)?> · 원본 파일 <?=nh_e($status['source']['files']??0)?>개 등록</p><p><?=(!empty($status['source']['repository']['commit'])&&$status['source']['repository']['commit']===($status['source']['historyHead']??$status['source']['bundleCommit']??null))?'소스와 변경 이력은 Google Drive 백업에서 확인할 수 있습니다.':'소스 백업 상태를 용량 관리에서 확인해 주세요.'?></p><p>패키지의 원본 해시와 PHP 문법을 검사한 뒤 적용하고, 서버 파일을 다시 검증합니다.</p><form method="post"><input type="hidden" name="csrf" value="<?=nh_e($csrf)?>"><button name="action" value="source_download">초기 전체 소스 내려받기</button><button name="action" value="history_download">초기 변경 이력 내려받기</button></form><details><summary>후속 변경·배포 소스</summary><p>초기 변경 이력에 아래 후속 이력을 순서대로 적용하면 최신 소스를 복원할 수 있습니다.</p><?php foreach($status['source']['history']??[] as $i=>$row):?><form method="post"><input type="hidden" name="csrf" value="<?=nh_e($csrf)?>"><input type="hidden" name="index" value="<?=nh_e($i)?>"><button name="action" value="increment_download">후속 이력 <?=nh_e($i+1)?> · <?=nh_e(substr($row['commit'],0,8))?></button></form><?php endforeach;?><?php foreach($releases??[] as $i=>$row):?><form method="post"><input type="hidden" name="csrf" value="<?=nh_e($csrf)?>"><input type="hidden" name="index" value="<?=nh_e($i)?>"><button name="action" value="package_download">배포 소스 <?=nh_e($row['revision'])?></button></form><?php endforeach;?></details><form method="post" enctype="multipart/form-data" class="hub-bar"><input type="hidden" name="csrf" value="<?=nh_e($csrf)?>"><input type="hidden" name="sourceRevision" value="<?=nh_e($status['source']['revision']??0)?>"><input type="file" name="package" accept="application/json,.json" required aria-label="배포 패키지"><button name="action" value="release">검증 후 배포</button></form><form method="post"><input type="hidden" name="csrf" value="<?=nh_e($csrf)?>"><button name="action" value="recover">중단된 배포 복구</button></form></section>
<section><h2>연결이 필요한 자동화</h2><p>실행 환경과 결과 검증이 끝난 기능만 전환 완료로 표시합니다.</p><?php foreach($status['dependencies']['remaining']??[] as $row):?><details><summary><?=nh_e($row['label'])?> <small>· 연결 대기</small></summary><p><?=nh_e($row['reason'])?></p></details><?php endforeach;?></section>
<section><h2>최근 실행 기록</h2><?php foreach(array_reverse(array_slice($status['receipts'],-12))as $r):?><p><?=nh_e(n80_hub_operations()[$r['operation']]['label']??'자동 작업')?> · <?=nh_e(['succeeded'=>'처리 확인','failed'=>'실패','running'=>'실행 중'][$r['state']]??'확인 필요')?> <small><?=nh_e(gmdate('m-d H:i',(int)$r['startedAt']+9*3600))?> KST</small><?php if(!empty($r['error'])):?><br><small><?=nh_e(noa_display_error($r['error']))?></small><?php endif;?></p><?php endforeach;?></section>
</main></body></html>
