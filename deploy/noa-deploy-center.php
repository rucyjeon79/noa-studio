<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
if (empty($is_admin) || $is_admin !== 'super') {
    http_response_code(403);
    exit('Forbidden');
}
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
header('Content-Security-Policy: default-src \'none\'; style-src \'unsafe-inline\'; script-src \'unsafe-inline\'; connect-src \'self\'; base-uri \'none\'; form-action \'none\'');
?><!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NOA DEPLOY CENTER — 운영 배포 현황</title>
<style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#101216;color:#eee}
body{max-width:860px;margin:36px auto;padding:0 18px;line-height:1.65}
h1{font-size:1.7rem;color:#d5b879} .panel{border:1px solid #474139;border-radius:16px;padding:22px;background:#1b1d22}
dl{display:grid;grid-template-columns:140px 1fr;gap:12px}dt{color:#b4b4b4}dd{margin:0;overflow-wrap:anywhere}
.notice{color:#f2d39a}button{padding:10px 18px;background:#37312a;border:1px solid #9b8057;border-radius:9px;color:#fff;cursor:pointer}
@media(max-width:520px){dl{grid-template-columns:1fr;gap:3px}dd{margin-bottom:10px}}
</style></head>
<body><h1>NOA DEPLOY CENTER</h1>
<p>닷홈 운영 서버의 실제 배포 상태를 조회합니다. 이 화면은 파일을 변경하지 않습니다.</p>
<section class="panel" aria-label="배포 현황"><dl>
<dt>운영 기준</dt><dd>닷홈 (DotHome)</dd>
<dt>호스트</dt><dd id="host">조회 중</dd>
<dt>배포 릴리스</dt><dd id="release">조회 중</dd>
<dt>검증 상태</dt><dd id="status">조회 중</dd>
<dt>적용 시각</dt><dd id="applied">조회 중</dd>
<dt>검증 파일 수</dt><dd id="files">조회 중</dd>
<dt>배포 실행기</dt><dd id="agent">확인 중</dd>
</dl><p id="message" class="notice" role="status" aria-live="polite"></p>
<button type="button" id="refresh">상태 새로고침</button></section>
<script>
const field=(id,value)=>document.getElementById(id).textContent=value;
async function refresh(){
 field('message','운영 서버 상태를 확인하는 중입니다.');
 try{
  const response=await fetch('/noa-deploy-status.php',{credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('HTTP '+response.status);
  const data=await response.json();
  if(data.ok!==true)throw new Error('invalid status');
  const release=data.server_release;
  field('host',release?.host_id||'미등록');
  field('release',release?.release||'적용 기록 없음');
  field('status',release?.status||'미확인');
  field('applied',release?.applied_at||'기록 없음');
  field('files',release?.file_count??'기록 없음');
  field('agent',data.deployment_available?'활성':'미설치 / 검증 전');
  field('message',data.deployment_available?'배포 상태를 조회했습니다.':'배포 실행기가 아직 활성화되지 않았습니다. 기존 운영 파일은 변경되지 않습니다.');
 }catch(error){
  field('message','상태 조회 실패: '+error.message);
  field('host','확인 불가');field('files','확인 불가');field('release','확인 불가');field('status','확인 불가');field('applied','확인 불가');field('agent','확인 불가');
 }
}
document.getElementById('refresh').addEventListener('click',refresh);
refresh();
</script></body></html>
