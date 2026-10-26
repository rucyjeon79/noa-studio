<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
header('Cache-Control: private, no-store');header('X-Content-Type-Options: nosniff');
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('관리자 로그인이 필요합니다.');}
require_once __DIR__.'/noa-app/engine/work-state.php';
$summary=n80_work_summary(dirname(__DIR__).'/noa-ai-lab/n80-workstate');
function nws_e(mixed $v):string{return htmlspecialchars((string)$v,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
$labels=['pending'=>'대기','in_progress'=>'진행 중','needs_review'=>'확인 필요','error'=>'오류','complete'=>'완료'];
$tasks=array_values(array_filter($summary['instructionQueue']??[],fn($x)=>preg_match('/^NOA-20261026-P0-0[1-7]$/D',$x['id'])));
$original='';foreach($summary['instructionQueue']??[]as $entry)if(str_starts_with($entry['id'],'NOA-20261026-P0-ORIGINAL-'))$original.=$entry['text'];
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>N80 작업 현황 | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css?v=<?=hash_file('sha256',__DIR__.'/noa-ui.css')?>"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script>
<style>.work-ledger{max-width:1000px}.work-ledger article{padding:20px 0;border-bottom:1px solid var(--noa-line)}.work-ledger header{display:flex;justify-content:space-between;align-items:start;gap:16px}.work-ledger h2{font-size:18px;margin:0}.work-ledger dl{display:grid;grid-template-columns:130px minmax(0,1fr);gap:8px;margin:16px 0}.work-ledger dd{margin:0;overflow-wrap:anywhere}.work-ledger dt,.work-ledger small{color:var(--noa-muted)}.work-ledger pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.work-ledger [data-status=complete]{color:var(--noa-success)}.work-ledger [data-status=in_progress]{color:var(--noa-info)}.work-ledger [data-status=needs_review]{color:var(--noa-warning)}.work-ledger [data-status=error]{color:var(--noa-danger)}.work-ledger details{padding:16px 0}.work-ledger summary{min-height:44px;cursor:pointer}.work-ledger a{display:inline-flex;align-items:center;min-height:44px}@media(max-width:600px){.work-ledger dl{grid-template-columns:1fr;gap:4px}.work-ledger dd{margin-bottom:8px}.work-ledger header{flex-wrap:wrap}}</style></head><body class="noa-page"><main class="work-ledger">
<p class="noa-eyebrow">N80 ENGINE</p><h1>프로젝트 작업 현황</h1><p class="noa-muted">프로젝트 단계와 운영 검증 기록입니다. ChatGPT Work 내부 실행 상태를 제어하거나 표시하는 화면은 아닙니다.</p><p><a href="/noa-ai-lab.php">AI LAB</a> · <a href="/noa-work-status.php">최신 기록 확인</a></p>
<?php if(empty($summary['ok'])):?><p role="alert">작업 기록을 읽지 못했습니다. 완료 여부는 확인 필요 상태로 유지합니다.</p><?php else:?>
<p>마지막 기록: <time><?=nws_e($summary['lastActivityAt']??'기록 대기')?></time> · 기록 버전 <?=nws_e($summary['revision'])?></p>
<?php foreach($tasks as $task):?><article data-task-id="<?=nws_e($task['id'])?>"><header><div><small><?=nws_e($task['id'])?></small><h2><?=nws_e(explode(';',$task['text'])[0])?></h2></div><span data-status="<?=nws_e($task['status'])?>"><?=nws_e($labels[$task['status']]??'확인 필요')?></span></header><dl>
<dt>현재 단계</dt><dd><?=nws_e($task['currentStage']??'등록 완료 · 단계 확인 중')?></dd><dt>마지막 성공 단계</dt><dd><?=nws_e($task['lastSuccessfulStage']??'증거 확인 중')?></dd><dt>마지막 활동 기록</dt><dd><?=nws_e($task['lastActivityAt']??'확인 중')?></dd>
<?php if(!empty($task['error'])):?><dt>확인할 사항</dt><dd class="noa-error"><?=nws_e($task['error'])?></dd><?php endif;?></dl>
<?php foreach($task['evidence']??[]as $e):?><p><a href="https://github.com/rucyjeon79/noa-studio/actions/runs/<?=nws_e($e['verificationRun'])?>">운영 검증 증거</a> · <?=nws_e(substr($e['commit'],0,12))?></p><?php endforeach;?></article><?php endforeach;?>
<details><summary>기존 12개 영역</summary><?php foreach($summary['areas']as $area):?><p><strong><?=nws_e($area['label'])?></strong> · <?=nws_e($labels[$area['status']]??'확인 필요')?><br><span class="noa-muted"><?=nws_e($area['note'])?></span></p><?php endforeach;?></details>
<details><summary>2026.10.26 추가 지시 원문</summary><pre><?=nws_e($original)?></pre></details>
<?php endif;?></main></body></html>
