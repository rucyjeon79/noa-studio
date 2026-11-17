(() => {
 'use strict';
 const el=id=>document.getElementById(id), app=el('nnb');if(!app)return;
 let state=JSON.parse(el('nnb-initial').textContent), busy=false, notebookPage='', sourcePage='';
 const messages={
  notebook_google_setup_required:'Google OAuth 설정을 먼저 확인해 주세요.',notebook_authorization_required:'Google 계정 연결이 필요합니다.',
  notebook_permission_required:'Notebook 권한 또는 API 활성화 상태를 확인한 뒤 다시 연결해 주세요.',notebook_api_disabled:'Google Cloud 프로젝트에서 Gemini Notebook API를 활성화해 주세요.',
  notebook_personal_account_required:'현재 공식 API는 개인 Google 계정으로 연결해야 합니다.',notebook_reconnect_required:'연결 승인이 만료되었습니다. Google 계정을 다시 연결해 주세요.',
  notebook_not_found:'노트북을 찾지 못했습니다. 같은 계정으로 NotebookLM에 먼저 로그인했는지 확인해 주세요.',notebook_rate_limit:'Google 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.',
  notebook_result_unconfirmed:'이전 전송의 접수 여부를 확인하지 못했습니다. 중복 전송하지 않았습니다. NotebookLM에서 자료를 확인해 주세요.',
  notebook_transport_uncertain:'Google 응답을 확인하지 못했습니다. 전송했다면 NotebookLM에서 접수 여부를 확인해 주세요.',
  notebook_dns_failed:'운영 서버에서 Google API 주소를 찾지 못했습니다. 서버 DNS 연결을 확인해 주세요.',
  notebook_connection_failed:'운영 서버에서 Google API에 접속하지 못했습니다. 호스팅의 외부 HTTPS 연결을 확인해 주세요.',
  notebook_timeout:'운영 서버에서 Google API 응답을 기다리다 시간이 초과되었습니다. 전송한 자료가 있다면 접수 여부를 먼저 확인해 주세요.',
  notebook_tls_failed:'운영 서버와 Google API의 보안 연결을 확인하지 못했습니다. 서버 인증서 설정을 확인해 주세요.',
  notebook_response_too_large:'Google API 응답이 허용된 크기를 초과했습니다.',
  notebook_service_unavailable:'Google API가 일시적인 서버 오류를 반환했습니다. 잠시 후 연결을 다시 확인해 주세요.',
  notebook_response_invalid:'Google 응답을 확인하지 못했습니다. 전송했다면 NotebookLM에서 접수 여부를 확인해 주세요.',
  notebook_revision_conflict:'연결 상태가 변경되었습니다. 화면을 새로 연 뒤 다시 시도해 주세요.',notebook_busy:'다른 연결 작업을 처리 중입니다. 잠시 후 다시 시도해 주세요.',
  notebook_invalid_title:'제목을 500자 이내로 입력해 주세요.',notebook_invalid_text:'자료 내용을 입력해 주세요. 최대 1MB까지 지원합니다.',
  notebook_invalid_url:'공개 HTTPS 주소를 입력해 주세요. Drive·Docs 주소는 아직 지원하지 않습니다.',notebook_invalid_resource:'자료를 보낼 노트북을 선택해 주세요.',
  notebook_oauth_expired:'연결 요청이 만료되었습니다. Google 계정 연결을 다시 시작해 주세요.',notebook_oauth_denied:'Google 연결을 승인하지 않았습니다.',
  notebook_offline_required:'지속 연결 권한이 누락되었습니다. Google 계정 연결을 다시 승인해 주세요.',notebook_request_verification_failed:'인증 정보가 만료되었습니다. 화면을 새로 열어 주세요.',
  notebook_previous_request_failed:'이전 요청이 거절되었습니다. 원인을 해결한 뒤 내용을 변경해 새 요청을 보내 주세요.',notebook_request_rejected:'Google이 요청을 거절했습니다. 입력 자료와 연결 설정을 확인해 주세요.',
  notebook_receipt_limit:'전송 기록 한도에 도달했습니다. 관리자에게 기록 정리를 요청해 주세요.',notebook_request_conflict:'전송 요청이 변경되었습니다. 화면을 새로 열어 주세요.'
 };
 function message(text,error=false){el('nnb-message').hidden=!text;el('nnb-message').textContent=text;el('nnb-message').className=error?'nnb-error':'nnb-info';}
 const mcpToolLabels={create_notebook:'노트북 만들기',get_notebook:'노트북 정보 조회',list_notebooks:'노트북 목록',update_notebook:'노트북 이름 변경',create_source:'자료 추가',get_source:'자료 처리 확인',list_sources:'자료 목록'};
 Object.assign(messages,{
  notebook_mcp_check_required:'Google 연결이 변경되었습니다. MCP 연결 검사를 다시 진행해 주세요.',
  notebook_mcp_response_invalid:'MCP 응답을 검증하지 못했습니다. 자료 전송 여부를 먼저 확인해 주세요.',
  notebook_mcp_request_rejected:'Google MCP가 요청을 거부했습니다. 기존 API로 전환하거나 연결을 다시 검사해 주세요.',
  notebook_mcp_result_unconfirmed:'MCP 처리 결과가 불명확합니다. 같은 자료를 자동으로 재전송하지 않습니다.',
  notebook_mcp_tool_failed:'MCP 도구가 오류를 반환했습니다. 전송한 자료는 접수 여부를 먼저 확인해 주세요.',
  notebook_mcp_tools_missing:'필요한 Notebook MCP 기능이 확인되지 않았습니다. 연결을 활성화하지 않았습니다.',
  notebook_mcp_catalog_incomplete:'MCP 기능 목록을 끝까지 확인하지 못했습니다.'
 });
 function renderMcp(m={}){
  const node=el('nnb-mcp-state');if(!node)return;
  const labels={authorization_required:'Google 계정 승인 필요',not_verified:'연결 확인 전',check_required:'MCP 연결 확인 필요',verification_required:'MCP 연결 검사 갱신 필요',connected:'공식 MCP 연결 확인됨'};
  node.textContent=(labels[m.state]||'연결 확인 전')+' · 현재 '+(m.transport==='mcp'?'통합 연결 사용':'기존 연결 사용');
  if(m.verifiedAt)node.textContent+=' · '+new Date(m.verifiedAt*1000).toLocaleString('ko-KR');
  if(m.lastError)node.textContent+=' · '+(messages[m.lastError]||'연결 검사 오류');
  node.className=m.state==='connected'?'nnb-connected':'nnb-pending';
  el('nnb-mcp-tools').replaceChildren();
  for(const name of m.tools||[]){if(!mcpToolLabels[name])continue;const li=document.createElement('li');li.textContent=mcpToolLabels[name];el('nnb-mcp-tools').append(li);}
 }
 function render(s){state=s;renderMcp(s.mcp);const labels={authorization_required:'계정 연결 대기',verification_required:'계정 승인됨 · 서비스 연결 확인 필요',check_required:'연결 확인 필요',connected:'Google 연결 확인됨'};el('nnb-state').textContent=labels[s.state]||'연결 확인 필요';el('nnb-state').className=s.state==='connected'?'nnb-connected':'nnb-pending';if(s.verifiedAt)el('nnb-state').textContent+=' · '+new Date(s.verifiedAt*1000).toLocaleString('ko-KR');el('nnb-receipts').replaceChildren();for(const r of s.receipts||[]){const li=document.createElement('li');li.textContent=`${r.title} · ${{received:'접수 확인',sending:'접수 확인 필요',unconfirmed:'접수 확인 필요',rejected:'거절됨'}[r.state]||'상태 확인 필요'}`;el('nnb-receipts').append(li);}}
 async function request(body){const response=await fetch('/noa-notebooklm.php?api=1',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-N80-CSRF':app.dataset.csrf},body:JSON.stringify(body)});let data;try{data=await response.json();}catch{throw new Error('notebook_transport_uncertain');}if(!response.ok||!data.ok)throw new Error(data.error||'notebook_request_rejected');if(data.status)render(data.status);if(data.google)renderGoogle(data.google);return data;}
 async function run(fn){if(busy)return;busy=true;const controls=[...app.querySelectorAll('button,input,select,textarea')].filter(b=>!b.disabled);controls.forEach(b=>b.disabled=true);app.setAttribute('aria-busy','true');message('처리 중입니다.');try{await fn();}catch(e){message(messages[e.message]||'응답을 확인하지 못했습니다. 전송한 자료가 있다면 NotebookLM에서 확인해 주세요.',true);if(el('google-message'))googleMessage(messages[e.message]||'연결 요청을 확인하지 못했습니다.',true);}finally{busy=false;controls.forEach(b=>b.disabled=false);app.querySelectorAll('#google-services button').forEach(b=>b.disabled=false);if(el('nnb-authorize')&&googleState)el('nnb-authorize').disabled=!googleState.clientConfigured;app.removeAttribute('aria-busy');}}
 async function requestId(body){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([state.connectionId||'',body])));const key='n80-notebook-'+Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');let id=sessionStorage.getItem(key);if(!id){id=Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');sessionStorage.setItem(key,id);}return id;}
 async function notebooks(more=false){const old=el('nnb-notebooks').value;const r=await request({action:'list',pageToken:more?notebookPage:''});if(!more)el('nnb-notebooks').replaceChildren(new Option('노트북 선택',''));for(const n of r.notebooks||[]){if(![...el('nnb-notebooks').options].some(o=>o.value===n.name))el('nnb-notebooks').add(new Option(n.displayName||'제목 없음',n.name));}el('nnb-notebooks').value=old;notebookPage=r.nextPageToken||'';el('nnb-more').hidden=!notebookPage;el('nnb-empty').hidden=el('nnb-notebooks').options.length>1;message('노트북 목록을 확인했습니다.');}
 function drawSource(n){const li=document.createElement('li'),name=document.createElement('span');name.textContent=(n.displayName||'제목 없음')+' · '+({ACTIVE:'처리 완료',PROCESSING:'처리 중',FAILED:'처리 실패',DELETING:'삭제 중'}[n.state]||'상태 확인 필요');li.append(name);if(n.state==='PROCESSING'||!n.state){const button=document.createElement('button');button.type='button';button.textContent='상태 확인';button.onclick=()=>run(async()=>{const r=await request({action:'source',source:n.name});li.replaceWith(drawSource(r.item));message('자료 상태를 확인했습니다.');});li.append(button);}return li;}
 async function sources(more=false){const notebook=el('nnb-notebooks').value;if(!notebook)throw new Error('notebook_invalid_resource');const r=await request({action:'sources',notebook,pageToken:more?sourcePage:''});if(!more)el('nnb-sources').replaceChildren();for(const n of r.sources||[])el('nnb-sources').append(drawSource(n));sourcePage=r.nextPageToken||'';el('nnb-sources-more').hidden=!sourcePage;message('자료 상태를 확인했습니다.');}
 el('nnb-mcp-check').onclick=()=>run(async()=>{const r=await request({action:'mcp_check',revision:state.revision});message(r.probeError?(messages[r.probeError]||'MCP 연결 검사에 실패했습니다.'):('공식 MCP 연결과 '+r.mcp.tools.length+'개 기능을 확인했습니다. 노트북 작업에 적용했습니다.'),!!r.probeError);});
 el('nnb-mcp-rest').onclick=()=>run(async()=>{await request({action:'mcp_rest',revision:state.revision});message('이후 노트북 작업은 기존 API를 사용합니다.');});
 el('nnb-rename').onsubmit=e=>{e.preventDefault();const title=new FormData(e.target).get('title');run(async()=>{const notebook=el('nnb-notebooks').value;if(!notebook)throw new Error('notebook_invalid_resource');const body={action:'rename',notebook,title};const r=await request({...body,requestId:await requestId({...body,revision:state.revision}),revision:state.revision});const option=[...el('nnb-notebooks').options].find(o=>o.value===notebook);if(option)option.textContent=r.item.displayName;message('노트북 이름을 저장했습니다.');});};
 el('nnb-check').onclick=()=>run(async()=>{const r=await request({action:'google_check',service:'notebooklm'});if(r.probeError)throw new Error(r.probeError);message('Google API 연결을 확인했습니다.');});
 el('nnb-load').onclick=()=>run(()=>notebooks());el('nnb-more').onclick=()=>run(()=>notebooks(true));
 el('nnb-notebooks').onchange=()=>{sourcePage='';el('nnb-sources').replaceChildren();el('nnb-sources-more').hidden=true;el('nnb-rename').elements.title.value='';if(el('nnb-notebooks').value)run(async()=>{const r=await request({action:'get',notebook:el('nnb-notebooks').value});el('nnb-rename').elements.title.value=r.item.displayName||'';await sources();});};
 el('nnb-sources-refresh').onclick=()=>run(()=>sources());el('nnb-sources-more').onclick=()=>run(()=>sources(true));
 el('nnb-kind').onchange=()=>{const text=el('nnb-kind').value==='text';el('nnb-text-label').hidden=!text;el('nnb-url-label').hidden=text;};
 el('nnb-create').onsubmit=event=>{event.preventDefault();const formData=new FormData(event.target);run(async()=>{const body={action:'create',title:formData.get('title').trim()};const r=await request({...body,requestId:await requestId(body),revision:state.revision});if(![...el('nnb-notebooks').options].some(o=>o.value===r.item.name))el('nnb-notebooks').add(new Option(r.item.displayName||body.title,r.item.name));el('nnb-notebooks').value=r.item.name;el('nnb-sources').replaceChildren();el('nnb-empty').hidden=true;sourcePage='';el('nnb-sources-more').hidden=true;message(r.duplicate?'이미 생성한 노트북을 선택했습니다.':'노트북을 만들었습니다.');});};
 el('nnb-add').onsubmit=event=>{event.preventDefault();const formData=new FormData(event.target);run(async()=>{const f=formData,kind=f.get('kind'),body={action:'add',notebook:el('nnb-notebooks').value,title:f.get('title').trim(),kind};if(!body.notebook)throw new Error('notebook_invalid_resource');body[kind==='text'?'text':'url']=f.get(kind==='text'?'text':'url');const r=await request({...body,requestId:await requestId(body),revision:state.revision});el('nnb-sources').prepend(drawSource(r.item));message(r.item.state==='ACTIVE'?'자료 처리가 완료되었습니다.':'자료 전송이 접수되었습니다. 아래에서 처리 상태를 확인해 주세요.');});};
 el('nnb-disconnect').onclick=()=>run(async()=>{await request({action:'disconnect',revision:state.revision});el('nnb-notebooks').replaceChildren(new Option('목록을 불러와 선택해 주세요',''));el('nnb-sources').replaceChildren();el('nnb-more').hidden=true;el('nnb-sources-more').hidden=true;message('N80의 Notebook 연결을 해제했습니다.');});
 const googleLabels={authorization_required:'연결 필요',authorization_blocked:'Google 로그인 거부',verification_required:'API 확인 필요',check_required:'확인 필요',connected:'API 확인됨',authorization_saved:'권한 저장됨',connection_saved:'브라우저 연결 저장됨',browser_verified:'브라우저 로그인 확인',configuration_required:'설정 필요',configured:'설정됨',partly_verified:'일부 채널 확인됨'};
 const googleErrors={google_invalid_client:'Google 웹 OAuth Client ID를 확인해 주세요.',google_invalid_secret:'공백 없이 Google Client Secret을 입력해 주세요.',google_secret_required_for_client_change:'Client ID를 변경할 때에는 같은 앱의 Secret도 입력해야 합니다.',google_secret_required:'Google Client Secret이 필요합니다.',google_revision_conflict:'설정이 변경되었습니다. 화면을 새로 열어 최신 설정을 확인해 주세요.',google_select_channel:'검사할 YouTube 채널을 선택해 주세요.',google_configuration_required:'공통 Google 앱 설정을 먼저 저장해 주세요.',google_authorization_required:'서비스 계정 연결이 필요합니다.',google_drive_connection_required:'Drive 연결을 저장한 관리자와 지정 폴더를 확인해 주세요.',google_drive_folder_unavailable:'지정된 비공개 임시저장 폴더에 접근할 수 없습니다.',google_reconnect_required:'계정 승인이 만료되었습니다. 해당 서비스를 다시 연결해 주세요.',google_permission_or_api_required:'해당 서비스의 Google 권한·API 활성화 상태를 확인해 주세요.',google_channel_mismatch:'승인 계정과 선택한 채널이 일치하지 않습니다.',google_rate_limit:'Google 요청 한도에 도달했습니다. 잠시 후 다시 검사해 주세요.',google_transport_failed:'Google 응답을 확인하지 못했습니다. 잠시 후 다시 검사해 주세요.',google_check_requires_browser:'이 서비스는 연결 관리 화면에서 로그인 상태를 확인해 주세요.'};
 Object.assign(messages,googleErrors);
 let googleState=el('google-initial')?JSON.parse(el('google-initial').textContent):null;let googleFormRevision=googleState?.clientRevision;
 function googleMessage(text,error=false){if(!el('google-message'))return;el('google-message').hidden=!text;el('google-message').textContent=text;el('google-message').className=error?'nnb-error':'nnb-info';}
 function renderGoogle(value){
  if(!el('google-services'))return;googleState=value;const host=el('google-services');host.replaceChildren();
  for(const row of value.services||[]){
   if(!/^(notebooklm|gemini|flow|youtube|analytics|drive|signin|cloud)$/.test(row.id))continue;
   const article=document.createElement('article');article.className='ng-service';article.id='service-'+row.id;
   const description=document.createElement('div'),title=document.createElement('h3'),purpose=document.createElement('p'),detail=document.createElement('p');title.textContent=row.label;purpose.textContent=row.purpose;detail.textContent=row.detail;detail.className='nnb-help';description.append(title,purpose,detail);
   const actions=document.createElement('div');actions.className='ng-actions';const status=document.createElement('span');status.textContent=googleLabels[row.state]||'상태 확인 필요';status.className=row.state==='connected'?'nnb-connected':'nnb-pending';actions.append(status);
   if(row.verifiedAt){const time=document.createElement('small');time.textContent=new Date(row.verifiedAt*1000).toLocaleString('ko-KR');actions.append(time);}
   if(row.executionScope==='unattended_browser')status.textContent='무인 실행 · '+status.textContent;
   const evidence=row.sessionEvidence;
   if(evidence?.state==='asset_received'){
    const received=document.createElement('p'),note=document.createElement('small');received.className='nnb-info';
    const media=evidence.asset||{},size=media.width+'×'+media.height,duration=Number.isFinite(media.duration)?' · '+media.duration.toFixed(2)+'초':'';
    received.textContent='대화 중 제작 · N80 '+(row.id==='flow'?'영상':'이미지')+' 전달 기록 확인 ('+size+duration+')';
    note.textContent='기록 '+new Date(evidence.recordedAt*1000).toLocaleString('ko-KR')+' · '+(evidence.productionAccepted?'채택된 장면':'완성본 검수와 별도')+' · 현재 로그인과 상시 자동 실행은 별도 확인';
    description.append(received,note);
    const source=document.createElement('a');try{const url=new URL(evidence.sourceUrl);if(url.protocol==='https:'&&url.hostname===(row.id==='flow'?'flow.google.com':'gemini.google.com')&&!url.username&&!url.password&&!url.port){source.href=url.href;source.target='_blank';source.rel='noopener noreferrer';source.textContent=row.id==='flow'?'Flow 결과 열기 ↗':'Gemini 결과 열기 ↗';actions.append(source);}}catch{}
    const results=document.createElement('a');results.href='/noa-ai-lab.php';results.textContent='N80 제작 결과';actions.append(results);
   }
   const link=document.createElement('a');link.href='/noa-notebooklm.php?service='+encodeURIComponent(row.id);link.textContent=row.executionScope==='unattended_browser'?'무인 실행 연결 상태':(row.id==='cloud'?'공통 설정':'연결 관리');actions.append(link);
   if(row.check){const button=document.createElement('button');button.type='button';button.textContent='API 검사';button.disabled=busy;button.onclick=()=>run(async()=>{googleMessage(row.label+' 연결을 검사하고 있습니다.');const result=await request({action:'google_check',service:row.id,channel:el('google-channel').value});if(result.probeError){const text=messages[result.probeError]||'연결 검사에 실패했습니다. 서비스 설정을 확인해 주세요.';googleMessage(text,true);message(text,true);}else{googleMessage(row.label+' API 응답을 확인했습니다.');message('연결 검사를 완료했습니다.');}});actions.append(button);}
   article.append(description,actions);host.append(article);
  }
  const select=el('google-channel'),selected=select.value;select.replaceChildren();for(const channel of value.channels||[])select.add(new Option(channel.title,channel.id));if(!select.options.length)select.add(new Option('연결된 채널 없음',''));else if([...select.options].some(o=>o.value===selected))select.value=selected;
 }
 if(googleState){
  renderGoogle(googleState);
  el('google-refresh').onclick=()=>run(async()=>{await request({action:'google_status'});googleMessage('저장된 연결 상태를 새로 확인했습니다.');message('Google 서비스 상태를 갱신했습니다.');});
  el('google-client-form').onsubmit=event=>{event.preventDefault();const form=event.target,fields=new FormData(form);run(async()=>{const result=await request({action:'google_config',revision:googleFormRevision,oauthClientId:fields.get('clientId').trim(),oauthClientSecret:fields.get('clientSecret')});googleFormRevision=result.google.clientRevision;form.elements.clientSecret.value='';googleMessage('공통 Google 앱 설정을 저장했습니다.');message('Google 앱 설정을 저장했습니다.');});};
 }

 render(state);const notice=app.dataset.notice;if(notice==='authorization_saved')message(state.state==='connected'?'Google 계정 연결과 API 확인을 완료했습니다.':(messages[state.lastError]||'계정 승인을 저장했습니다. 연결 확인을 눌러 주세요.'),state.state!=='connected');else if(notice)message(messages[notice]||'연결을 확인해 주세요.',true);else if(state.lastError)message(messages[state.lastError]||'연결을 확인해 주세요.',true);
})();
