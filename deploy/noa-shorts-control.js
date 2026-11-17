(()=>{'use strict';
const $=id=>document.getElementById(id),time=t=>t?new Date(typeof t==='number'?t*1000:t).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false})+' KST':'기록 없음';
const labels={not_started:'시험 시작 대기',requested:'N80 실행 요청 전달 · 호스트 처리 대기',checking:'N80 준비 상태 점검 중',check_failed:'N80 점검 실패 · 실행 기록 확인 필요',blocked_before_production:'N80 점검 완료 · 실제 제작 시작 전 연결 단계에서 중단',readiness_passed:'준비 점검 통과 · 실제 제작 결과는 별도 확인 필요'};
const missing={persistent_browser_executor_required:'Gemini·Flow 무인 실행 연결 필요',chatgpt_unattended_dispatch_not_verified:'ChatGPT 무인 호출 검증 필요',google_drive_authorization_required:'Google Drive 인증 필요',google_drive_readback_verification_required:'Google Drive 저장·회수 검증 필요',youtube_related_video_adapter_not_verified:'YouTube 관련 동영상 연결 검증 필요',youtube_auto_publication_not_enabled:'YouTube 자동 게시 비활성',youtube_offline_connection_required:'YouTube 오프라인 인증 연결 필요'};
const stateLabel=s=>globalThis.NoaDisplay?.state?globalThis.NoaDisplay.state(s):({cancelled:'취소됨',failed:'실패',completed:'완료',published:'게시됨',ready:'준비됨',planning:'기획 중',running:'처리 중',waiting:'대기 중'}[s]||'상태 확인 필요');
let busy=false,timer=null,controller=null,shouldPoll=false,pollBudget=12;
function row(text){const li=document.createElement('li');li.textContent=text;return li;}
function render(s){
 if(!s.ok)throw Error('unavailable');
 shouldPoll=s.needsPolling===true;
 $('last-checked').classList.remove('warning');
 $('live-state').textContent=labels[s.trial?.state||'not_started']||'상태 확인 필요';
 const age=Math.max(0,s.checkedAt-(s.heartbeatAt||0));
 $('last-checked').textContent=s.runnerState==='retired'?`조회 ${time(s.checkedAt)} · 구형 상주 실행기 폐기 · 예약 자동 실행 비활성`:`조회 ${time(s.checkedAt)} · 호스트 ${s.runnerState==='running'?'응답 확인':'응답 확인 필요'} · 최근 응답 ${s.heartbeatAt?age+'초 전':'없음'}${s.paused?' · 자동화 일시정지':''}`;
 const events=[];if(s.trial)events.push(row(`${time(s.trial.requestedAt)} · 사용자 지시로 N80 실행 요청 등록 · 시험 ${s.trial.id.slice(0,8)}`));
 const r=s.receipt;if(r)events.push(row(`${time(r.startedAt)} · N80 호스트 ${s.trialReceiptMatched?'이번 시험':'최근'} 실행 · ${r.state==='succeeded'?'일정·준비 점검 처리':r.state==='failed'?'실패': '실행 중'} · 기록 ${r.id.slice(0,12)}`));
 if(r?.outcome)events.push(row(`실행 범위: 일정·준비 점검 · 처리 ${r.outcome.processed??0}건 / 업로드 ${r.outcome.uploads??0}건 · ${r.outcome.productionReady?'제작 준비됨':'제작 준비 미완료'}`));
 $('events').replaceChildren(...events);
 const j=s.job;$('job-title').textContent=j?`${j.title} · ${j.duration??'?'}초 · ${stateLabel(j.state)}`:'현재 연결된 쇼츠 작업 없음';
 $('job-progress').replaceChildren(...(j?[`기획 ${j.planned}/${j.scenes}장면`,`채택 이미지 ${j.images}/${j.scenes}`,`채택 영상 ${j.videos}/${j.scenes}`,`완성 파일 ${j.finals}개`].map(t=>{const span=document.createElement('span');span.textContent=t;return span;}):[]));
 $('job-block').textContent=j?.retryBlock?`${j.retryBlock.scene}번 장면 ${j.retryBlock.kind==='image'?'이미지':'영상'} 생성 시도 ${j.retryBlock.attempts}/${j.retryBlock.maxAttempts}회 소진 · 재시도 한도 유지`:'';
 $('schedule').textContent=`다음 준비 ${time(s.moduleCheck?.nextPreparationAt||s.campaign.nextPreparationAt)} · 다음 게시 ${time(s.moduleCheck?.nextPublicationAt||s.campaign.nextPublicationAt)}`;
 const request=s.chatgpt.request,actions={recover:'중단 원인 수정·재개',generate:'장면 생성',review:'실제 결과 검수',plan:'장면 기획',reconcile:'외부 생성 이력 대조',assemble:'원음·자막·영상 합성',review_subtitles:'자막 청취·검수',align_subtitles:'자막 시간 정렬',publish:'YouTube 최종 업로드',upload_complete:'최종 업로드 검증 완료'};
 $('chat-request').textContent=request?`${time(request.issuedAt)} · N80 요청 ${request.id.slice(0,12)} · ${actions[request.action]||'작업 확인 필요'}${request.task?.scene?' · '+request.task.scene+'번 장면':''} · ${({image:'이미지',video:'영상'}[request.task?.kind]||'')} · ${request.state==='received'?'챗지 수신':request.state==='responded'?'응답 저장':'응답 대기'}`:'제작 시험 시작 대기 · N80이 발행한 요청 없음';
 $('recovery-form').hidden=!(request?.action==='recover'&&request.state==='waiting');if(request)$('recovery-request').value=request.id;
 if(j?.controller?.enabled&&!['cancelled','failed','completed','published'].includes(j.state)){
  $('live-state').textContent='N80 제작 시험 진행 · '+(actions[request?.action]||'호스트 요청 발행 대기');
  const records=[...(j.controller.history||[]),...(request?[request]:[])].slice(-6);
  for(const q of records)$('events').append(row(`${time(q.issuedAt)} · N80 → 챗지 · ${actions[q.action]||q.action} · 요청 ${q.id.slice(0,12)} · ${q.finishedAt?'다음 단계 전환':q.receivedAt?'수신 확인':'수신 대기'}`));
  $('browser-capability').textContent='이번 시험: 활성 대화 수신기가 N80 요청에 따라 도구 실행 · 상시 서버 실행기는 미연결';
 }
 $('clock-capability').textContent=r?.state==='succeeded'?`N80 호스트 처리 확인 · ${time(r.finishedAt)}`:'최근 정상 처리 기록 확인 필요';
 if(s.runnerState==='retired'&&!shouldPoll){
  $('live-state').textContent='구형 실행 시험 종료 · 읽기 전용 점검 가능';
  $('clock-capability').textContent='과거 기록 보존 · 현재 모듈 점검 필요';
 }
 const check=s.moduleCheck;
 if(check){
  const checked=check.state==='checked';
  if(!shouldPoll)$('live-state').textContent=checked?'N80 호스트 점검 완료 · 제작·게시 미실행':check.state==='checking'?'점검 결과 미확정 · 자동 재실행하지 않음':'호스트 점검 실패 · 결과 확인 필요';
  $('events').prepend(row(`${time(check.requestedAt)} · 현재 데이터 읽기 전용 점검 · ${checked?'검증 완료':check.state==='checking'?'결과 미확정':'검증 실패'}${Number.isFinite(check.elapsedMs)?' · '+check.elapsedMs+' ms':''}`));
  $('clock-capability').textContent=checked?`실제 모듈 계산 확인 · ${check.elapsedMs} ms · 원본 데이터 변경 없음`:'점검 결과 확인 필요';
 }
 const yt=s.youtubeCheck;
 const ytErrors={youtube_reauthorize_required:'Google 인증이 만료되었거나 철회되어 다시 연결해야 합니다.',youtube_offline_connection_required:'YouTube 오프라인 인증이 필요합니다.',youtube_client_configuration_invalid:'Google 연결 설정 확인이 필요합니다.',youtube_api_disabled:'YouTube Data API 활성화가 필요합니다.',youtube_quota_limited:'YouTube 조회 한도에 도달했습니다. 자동 재시도하지 않습니다.',youtube_permission_required:'YouTube 조회 권한이 부족합니다.',youtube_channel_owner_mismatch:'현재 인증의 채널이 쇼츠 대상 채널과 다릅니다.',youtube_channel_page_unverified:'대상 채널이 첫 조회에 없어 추가 확인이 필요합니다.',youtube_destination_playlist_missing:'게시 대상 재생목록을 확인할 수 없습니다.',youtube_playlist_owner_mismatch:'게시 재생목록의 소유 채널이 다릅니다.',youtube_uploads_playlist_missing:'채널의 업로드 목록을 확인할 수 없습니다.',youtube_target_invalid:'쇼츠 대상 채널·재생목록 설정을 확인해야 합니다.'};
 if($('youtube-check'))$('youtube-check').textContent=!yt?'아직 실제 연결을 확인하지 않았습니다.':yt.state==='checking'?'YouTube 확인 결과 미확정 · 같은 요청을 자동 재실행하지 않습니다.':yt.state==='checked'?`${time(yt.finishedAt)} · 채널 ${yt.channelTitle} · 재생목록 ${yt.playlistTitle} · 소유권 조회 확인 · 업로드 권한 기록 ${yt.uploadScopeRecorded?'있음':'미확인'} · 실제 업로드 미검증`:`${time(yt.finishedAt)} · ${ytErrors[yt.error]||'YouTube 연결 확인에 실패했습니다. 설정과 연결 상태를 확인해 주세요.'}`;
 const ready=s.campaign.readiness||{};
 $('publish-capability').textContent=`YouTube 인증 ${ready.youtubeConnected?'저장됨':'필요'} · 자동 게시 ${ready.channelAutoEnabled?'활성':'비활성'} · 관련 동영상 연결 ${ready.nativeRelatedVideoAdapterReady?'준비됨':'검증 필요'}`;
 const blockers=(check?.missing||ready.missing||[]).map(k=>row(missing[k]||'실행 연결 확인 필요'));
 blockers.unshift(row('대화 종료 후 챗지 자동 깨우기 미검증 · 현재 시험은 활성 대화 수신기 사용'));
 if(j?.retryBlock)blockers.push(row($('job-block').textContent));
 if(j?.subtitles==='needs_review')blockers.push(row('한글자막 타이밍 검수 필요'));
 $('blockers').replaceChildren(...blockers);
}
function schedule(){clearTimeout(timer);if(!document.hidden&&shouldPoll&&pollBudget>0)timer=setTimeout(()=>{pollBudget--;refresh();},5000);}
async function refresh(){if(busy)return;busy=true;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),10000);try{const r=await fetch('/noa-shorts-control.php?format=json',{credentials:'same-origin',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('unavailable');render(await r.json());}catch(e){shouldPoll=false;if(!document.hidden){$('live-state').textContent='상태 조회 실패 · 새로고침으로 다시 확인해 주세요.';$('last-checked').classList.add('warning');}}finally{clearTimeout(timeout);busy=false;controller=null;schedule();}}
try{render(JSON.parse($('initial-state').textContent));}catch(e){$('live-state').textContent='상태를 읽지 못했습니다.';}
schedule();$('refresh').addEventListener('click',()=>{pollBudget=12;refresh();});document.addEventListener('visibilitychange',()=>{clearTimeout(timer);if(document.hidden)controller?.abort();else if(shouldPoll&&pollBudget>0)refresh();});
})();
