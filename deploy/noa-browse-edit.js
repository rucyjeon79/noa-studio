/* Inline administrator metadata editing. Uses the existing audited bridge writer. */
(()=>{'use strict';if(window.NoaBrowseEdit)return;
async function generationReply(response){
 const denied=response.status===401||response.status===403;
 if(denied)throw Error('최고관리자 로그인 상태와 접근 권한을 확인해 주세요.');
 if(response.redirected||!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')){
  throw Error('서버에서 생성 응답을 확인할 수 없습니다. (HTTP '+response.status+') 곡 편집기를 다시 열어 저장 상태를 확인해 주세요.');
 }
 try{return await response.json();}catch{throw Error('생성 응답이 중간에 끊겼습니다. 곡 편집기를 다시 열어 저장 상태를 확인해 주세요.');}
}
const formReady=window.NoaRecordForm?Promise.resolve():new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='/noa-record-form.js?v=20261027-clear1';script.onload=resolve;script.onerror=()=>reject(Error('곡정보 폼을 불러오지 못했습니다. 다시 열어 주세요.'));document.head.append(script);});
const fieldErrors={collection_revision_conflict:'묶음의 수록곡이 다른 곳에서 변경되었습니다. 취소 후 다시 열어 최신 목록을 확인해 주세요.',collection_unavailable:'선택한 묶음의 장르나 공개 상태가 바뀌었습니다. 취소 후 다시 열어 확인해 주세요.',invalid_collections:'곡 묶음 선택을 다시 확인해 주세요.',invalid_genre:'카테고리와 세부 장르를 선택해 주세요.',classification_ep_required:'K-POP 원곡은 EP 번호를 입력해 주세요.',classification_ep_conflict:'선택한 장르에 같은 EP 번호가 있습니다. 기존 곡을 확인해 주세요.',classification_source_linked:'원곡·파생곡 연결이 있는 곡입니다. 연결을 유지하기 위해 분류 변경을 보류했습니다.',classification_playlist_linked:'이 곡이 수록된 곡 묶음이 있습니다. 묶음의 수록곡에서 먼저 제외한 후 분류를 바꿔 주세요.',record_already_exists:'해당 장르·번호의 문서가 이미 있습니다. 곡 검색·수정에서 기존 곡을 열어 주세요.',number_required:'EP 또는 ACT 번호를 입력해 주세요.',original_ep_conflict:'이 EP 번호의 원곡이 이미 있습니다. 다른 번호를 쓰거나 기존 원곡을 수정해 주세요.',invalid_members:'ACT에는 해당 범위의 EP 10곡이 필요합니다. 수록곡 선택을 확인해 주세요.',act_requires_ep_range:'ACT 수록곡은 해당 EP 10곡을 번호순으로 선택해 주세요.',member_missing_or_ambiguous:'수록곡의 원본 연결이 없거나 중복되어 있습니다. 곡 연결을 먼저 확인해 주세요.',member_genre_or_ep_mismatch:'수록곡의 장르 또는 EP 번호가 이 목록과 맞지 않습니다.',invalid_url:'미디어 주소는 https 주소로 입력해 주세요.',invalid_media_host:'Suno 또는 YouTube의 올바른 공유 주소를 입력해 주세요.',title_required:'곡 제목을 입력해 주세요.',ambiguous_song:'같은 곡에 여러 원본이 연결되어 있습니다. 원본 연결을 먼저 검토해 주세요.',restore_required:'휴지통에 있는 곡입니다. 복원 후 수정해 주세요.'};
const paths={edit:'m16 3 5 5-12 12-6 1 1-6L16 3ZM13 6l5 5',save:'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',cancel:'m6 6 12 12M6 18 18 6',ai:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z'};
function control(icon,label,name){const b=document.createElement('button');b.type='button';b.className='noa-action noa-edit-'+icon;b.setAttribute('aria-label',name);b.innerHTML='<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[icon]+'"/></svg>';const text=document.createElement('span');text.textContent=label;b.append(text);return b;}
function mount({host,rows=[],kind='곡',isOrdering,onSaved=()=>{},onClose,standalone=false}){
 const byKey=new Map();for(const r of rows){const key=String(r.key);if(!byKey.has(key)||(byKey.get(key).kind==='playlist'&&r.kind!=='playlist'))byKey.set(key,r);}let active=null;
 const style=document.getElementById('noa-inline-editor-style')||document.createElement('style');style.id='noa-inline-editor-style';style.textContent='html[data-noa-precision] .noa-page .noa-inline-act:is([data-act-number],[data-playlist-id]){position:relative}html[data-noa-precision] .noa-page .noa-inline-act:is([data-act-number],[data-playlist-id]):not(:has(>.noa-collection-tools))>.noa-browse-card{padding-inline-end:52px}.noa-inline-act>.noa-act-edit{position:absolute;right:0;top:10px}.noa-inline-titlebar{display:flex;align-items:center;gap:8px;min-width:0;width:100%}.noa-inline-titlebar>.noa-browse-card{flex:1;min-width:0}.noa-inline-titlebar>.noa-edit-edit{flex:none}.noa-page .noa-edit-edit,.noa-page .noa-edit-form .noa-action{min-width:44px;min-height:52px;padding:4px 6px}.noa-inline-video-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.noa-inline-video-row>.noa-inline-song{flex:1;min-width:0;width:auto}.noa-inline-song-row>.noa-inline-song{min-width:0}.noa-edit-form{flex-basis:100%;width:100%;min-width:0;padding:12px 0 20px;border-top:1px solid var(--noa-line);color:var(--noa-text)}.noa-edit-field-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}.noa-edit-field-heading>label{flex:1;min-width:0;word-break:keep-all;overflow-wrap:break-word}html[data-noa-precision] body:has(#noa-ainoa) .noa-page .noa-edit-field-heading{padding-inline-end:112px}html[data-noa-precision] .noa-page .noa-edit-form .noa-edit-field-heading .noa-action{display:flex;flex-direction:row;flex:0 0 auto;align-items:center;gap:6px;min-width:96px;min-height:44px;padding:8px}.noa-edit-form label{display:block;margin:10px 0;font-size:14px}.noa-edit-form :is(input,textarea,select){display:block;width:100%;box-sizing:border-box;min-height:44px;margin-top:4px;border:1px solid var(--noa-line);border-radius:var(--noa-control-radius,8px);padding:8px;background:var(--noa-bg);color:var(--noa-text);font:inherit}.noa-edit-form textarea{min-height:120px;resize:vertical}.noa-edit-form .noa-edit-readonly{color:var(--noa-muted);font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.noa-edit-buttons{display:flex;gap:6px}.noa-edit-status{font-size:13px;min-height:1.5em;overflow-wrap:anywhere}.noa-inline-song-row:has(>.noa-edit-form),.song:has(>.noa-edit-form){flex-wrap:wrap}.noa-order-list .noa-edit-edit,.noa-create-list .noa-edit-edit{display:none}.noa-inline-video-row>.noa-inline-playback{flex-basis:100%;width:100%;order:1}.noa-edit-form{order:2}.noa-inline-titlebar>:is(h2,.song-select){flex:1;min-width:0}'+ 'html[data-noa-precision] .noa-page .noa-edit-form .noa-edit-ai,html[data-noa-precision] .noa-page .noa-edit-form .noa-edit-ai:hover,html[data-noa-precision] .noa-page .noa-edit-form .noa-edit-ai:focus-visible{color:var(--noa-creative);border-color:var(--noa-creative)}html[data-noa-precision] .noa-page .noa-edit-form .noa-edit-ai>svg{color:var(--noa-creative)}.noa-ai-feedback{margin:8px 0 16px;min-width:0}.noa-ai-feedback p{margin:6px 0;font-size:13px;overflow-wrap:anywhere}.noa-ai-feedback[data-error=true]{color:var(--noa-danger)}.noa-ai-feedback textarea{min-height:120px}.noa-ai-feedback-actions{display:flex;flex-wrap:wrap;gap:8px}.noa-ai-feedback-actions button{min-height:44px;padding:8px 12px}.noa-ai-feedback[hidden]{display:none}';document.head.append(style);
 function close(){if(!active||active.busy)return;active.button.setAttribute('aria-expanded','false');active.form.remove();active=null;onClose?.();}
 function message(text){if(active)active.status.textContent=text;}
 function refresh(){
  for(const node of host.querySelectorAll('.noa-inline-song-row,.noa-inline-video-row')){
   if(node.querySelector(':scope>.noa-edit-edit'))continue;const record=byKey.get(node.dataset.inlineKey);if(!record)continue;
   const b=control('edit','수정',(record.title||record.key)+' 정보 수정');b.setAttribute('aria-expanded','false');b.onclick=()=>open(node,b,{type:'song',source:kind==='영상'&&!record.comingSoon?'youtube':'music',key:String(record.musicKey||record.key)});const actions=node.querySelector('.noa-song-actions');if(actions)actions.before(b);else node.append(b);
  }
  for(const raw of document.querySelectorAll('.song[data-key],.yt-card[data-browse-key]')){
   if(raw.querySelector('.noa-edit-edit'))continue;const key=raw.dataset.key||raw.dataset.browseKey,record=byKey.get(key);if(!record)continue;const title=raw.querySelector('.song-select,h2');if(!title)continue;const bar=document.createElement('div');bar.className='noa-inline-titlebar';title.before(bar);bar.append(title);const b=control('edit','수정',(record.title||key)+' 정보 수정');b.setAttribute('aria-expanded','false');b.onclick=()=>open(raw,b,{type:'song',source:kind==='영상'&&!record.comingSoon?'youtube':'music',key:String(record.musicKey||key)});if(record.customPlaylistId)b.onclick=()=>open(raw,b,{type:'playlist',id:record.customPlaylistId});else if(record.kind==='playlist'&&Number(record.act)>0)b.onclick=()=>open(raw,b,{type:'act',genre:record.genre,act:String(record.act)});bar.append(b);
  }
  for(const section of host.querySelectorAll('.noa-inline-act:is([data-act-number],[data-playlist-id])')){
   if(section.querySelector('.noa-collection-tools>.noa-act-edit,:scope>.noa-act-edit'))continue;const card=section.querySelector(':scope>.noa-browse-card');if(!card)continue;const b=control('edit','수정',card.querySelector('strong')?.textContent+' 정보 수정');b.classList.add('noa-act-edit');b.setAttribute('aria-expanded','false');b.onclick=()=>open(section,b,section.dataset.playlistId?{type:'playlist',id:section.dataset.playlistId}:{type:'act',genre:section.dataset.actGenre,act:section.dataset.actNumber});const tools=section.querySelector(':scope>.noa-collection-tools');if(tools)tools.append(b);else card.after(b);
  }
 }
 async function open(node,button,selector,draftFields=null){
  if(isOrdering?.())return;if(active){if(active.busy||active.dirty){message('먼저 수정 중인 내용을 저장하거나 취소해 주세요.');return;}if(active.button===button){close();return;}close();}
  const form=document.createElement('form');form.className='noa-edit-form';form.setAttribute('aria-label',selector.type==='act'?'ACT 플레이리스트 세부정보 수정':selector.type==='playlist'?'플레이리스트 세부정보 수정':'곡 세부정보 수정');const status=document.createElement('p');status.className='noa-edit-status';status.setAttribute('role','status');status.textContent='세부정보를 불러오는 중입니다.';form.append(status);
  const titlebar=node.querySelector(':scope>.noa-inline-titlebar')||(['act','playlist'].includes(selector.type)?node.querySelector(':scope>.noa-collection-tools,:scope>.noa-act-edit'):null);if(titlebar)titlebar.after(form);else node.append(form);button.setAttribute('aria-expanded','true');
  const state={node,button,form,status,selector,busy:false,dirty:false,requestId:null,signature:null};active=state;
  const cancel=control('cancel','취소','정보 수정 취소');cancel.onclick=close;form.append(cancel);
  try{await formReady;const response=await fetch('/noa-inline-edit.php?'+new URLSearchParams(selector),{credentials:'same-origin',cache:'no-store'});let data=null;try{data=await response.json();}catch{}if(!response.ok||!data?.ok||!data.writeKey)throw Error(fieldErrors[data?.error]||'세부정보를 불러오지 못했습니다. 로그인 상태와 곡 연결을 확인해 주세요.');if(active!==state)return;state.data=data;form.replaceChildren();
   const context=document.createElement('p');context.className='noa-edit-readonly';if(standalone)context.id='editor-classification';form.append(context);window.NoaBrowse.renderPath(context,{...data.context,key:data.writeKey,orderKey:byKey.get(selector.key)?.orderKey,title:data.fields.title},{base:kind==='영상'?'/noa-youtube.php':'/noa-music.php'});
   const inputs={};const classification=typeof data.fields.genre==='string'&&data.kind!=='playlist'&&selector.type!=='new'?window.NoaRecordForm.classificationEditor(form,{genre:data.fields.genre,ep:data.context.ep,inputs,collections:data.collections,selected:data.fields.collections||[]}):null;const sections=window.NoaRecordForm.sections(form);const aiFields=new Set(['title','lyrics','sunoPrompt','geminiPrompt','youtubeTitle','description','communityPost']);
   function field(key,label,tag='input'){
    const value=key==='vocal'?(data.fields.vocal||({female:'여자솔로',male:'남자솔로',duet:'남녀듀엣'}[data.fields.cast]||'')):data.fields[key];
    const {wrap,heading,caption,input}=window.NoaRecordForm.createField(key,{type:data.packageType,value});
    label=window.NoaRecordForm.describe(key,data.packageType).label;
    let feedback=null;
    if(aiFields.has(key)&&selector.type!=='new'){
     const ai=control('ai','AI 생성',label+' AI 생성 또는 수정');feedback=document.createElement('div');feedback.className='noa-ai-feedback';feedback.hidden=true;feedback.setAttribute('aria-live','polite');
     const tell=(text,error=false)=>{feedback.hidden=false;feedback.dataset.error=String(error);feedback.replaceChildren();const p=document.createElement('p');p.textContent=text;feedback.append(p);status.textContent=text;};
     async function api(url,options={},timeout=40000){
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
      try{const response=await fetch(url,{credentials:'same-origin',cache:'no-store',...options,signal:controller.signal});let result=null;try{result=await response.json();}catch{}if(!response.ok||!result?.ok){const code=result?.error||response.headers.get('X-NOA-Error-Code');const error=Error(result?.message||(code==='ai_not_configured'?'AI LAB에서 텍스트 AI 연결과 사용 한도를 먼저 설정해 주세요.':'AI 응답을 확인하지 못했습니다. 같은 버튼으로 결과를 다시 확인해 주세요.'));error.code=code;throw error;}return result;}
      catch(e){if(e.name==='AbortError')throw Error('응답 대기 시간이 지났습니다. 같은 버튼으로 결과를 다시 확인해 주세요. 같은 요청을 중복 생성하지 않습니다.');throw e;}finally{clearTimeout(timer);}
     }
     ai.onclick=async()=>{
      if(state.busy){tell('다른 요청을 처리 중입니다. 잠시 기다려 주세요.');return;}
      state.busy=true;ai.disabled=true;ai.setAttribute('aria-busy','true');tell(label+' AI 연결을 확인하고 있습니다.');const original=input.value;
      try{
       const fields=Object.fromEntries(Object.entries(inputs).filter(([k])=>aiFields.has(k)||['vocal','originalArtist'].includes(k)).map(([k,v])=>[k,v.value]));
       const payload={action:'generate',selector,field:key,fields,expectedRevision:state.data.revision};
       const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload)))),b=>b.toString(16).padStart(2,'0')).join('');
       const storageKey='noa-ai-request:'+signature;state.aiRequests??={};let requestId=state.aiRequests[signature];
       try{requestId??=sessionStorage.getItem(storageKey);}catch{}requestId??=crypto.randomUUID();state.aiRequests[signature]=requestId;try{sessionStorage.setItem(storageKey,requestId);}catch{}
       const session=await api('/noa-ainoa.php?action=status',{},12000);
       if(session.generation?.ready===false){
        const names={api_key:'OpenAI API 키',text_enabled:'텍스트 AI 활성화',per_request_budget:'요청당 이용 한도',daily_budget:'일일 이용 한도',daily_budget_exhausted:'남은 일일 이용 한도',model:'사용 가능한 모델',settings_unavailable:'서비스 설정 연결'};
        tell('AI 생성 준비가 필요합니다: '+session.generation.missing.map(k=>names[k]||k).join(' · ')+'.',true);const link=document.createElement('a');link.href='/noa-ai-lab.php';link.textContent='AI LAB 서비스 설정 열기';feedback.append(link);return;
       }
       tell(label+' AI 초안을 작성 중입니다. 기존 내용은 유지됩니다.');
       const result=await api('/noa-ainoa.php',{method:'POST',headers:{'Content-Type':'application/json','X-NOA-CSRF':session.csrf},body:JSON.stringify({...payload,requestId})});if(active!==state)return;
       tell('AI 초안을 확인한 뒤 적용해 주세요. 저장은 별도로 진행합니다.');
       const preview=document.createElement('textarea');preview.value=result.text;preview.readOnly=true;preview.setAttribute('aria-label',label+' AI 초안');const actions=document.createElement('div');actions.className='noa-ai-feedback-actions';
       const apply=document.createElement('button');apply.type='button';apply.textContent='초안 적용';apply.onclick=()=>{if(state.busy)return;if(input.value!==original){tell('초안을 만드는 동안 입력이 바뀌었습니다. 현재 내용을 보존했습니다. 필요한 부분을 초안에서 복사해 주세요.',true);feedback.append(preview);return;}input.value=result.text;input.dispatchEvent(new Event('input',{bubbles:true}));tell('초안을 적용했습니다. 확인 후 저장해 주세요.');input.focus();};
       const discard=document.createElement('button');discard.type='button';discard.textContent='초안 닫기';discard.onclick=()=>{tell('초안을 닫았습니다. 입력한 내용은 그대로 유지됩니다.');};actions.append(apply,discard);feedback.append(preview,actions);
      }catch(e){tell(/[가-힣]/.test(e.message)?e.message:'네트워크 연결을 확인해 주세요. 입력 내용은 유지됩니다. 같은 버튼으로 결과를 다시 확인할 수 있습니다.',true);}
      finally{state.busy=false;ai.disabled=false;ai.removeAttribute('aria-busy');}
      };if(selector.type!=='song')heading.append(ai);
     if(selector.type==='song'){
      const gpt=control('ai','생성',label+' ChatGPT로 생성');
      // Keep the configured API route for installations using AI LAB.
      state.gptMode??=fetch('/noa-gpt.php?op=config',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-NOA-Bridge-Request':'1'},body:'{}'})
       .then(generationReply).then(async cfg=>{
        if(cfg.ok&&cfg.workerConfigured)return 'worker';
        if(!cfg.ok||cfg.pluginEnabled||cfg.url)return 'gpt';
        const session=await api('/noa-ainoa.php?action=status',{},12000);
        return session.generation?.ready?'api':'gpt';
       }).catch(()=>'gpt');
      gpt.disabled=true;
      state.gptMode.then(mode=>{state.privateWorker=mode==='worker';gpt.disabled=false;if(mode==='api'&&gpt.isConnected)gpt.replaceWith(ai);});
      gpt.onclick=async()=>{
       if(state.busy)return;
       if(state.dirty){tell('먼저 곡 정보를 저장한 뒤 다시 눌러 주세요.',true);return;}
       const replace=Boolean(input.value.trim());
       if(replace&&!window.confirm(label+'에 기존 내용이 있습니다. 새 결과로 교체할까요?'))return;
       if(state.gptTask && state.gptField!==key && !window.confirm('앞선 생성 요청을 종료하고 '+label+' 작업을 시작할까요?'))return;
       // Create the tab during the tap so mobile browsers keep the user gesture.
       const tab=state.privateWorker?null:window.open('about:blank','_blank');
       if(tab)tab.opener=null;
       let launched=false;
       state.busy=true;gpt.disabled=true;
       try{
        const response=await fetch('/noa-gpt.php?op=start',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json','X-NOA-Bridge-Request':'1'},body:JSON.stringify({selector,field:key,revision:state.data.revision,replace,worker:state.privateWorker})});
        const result=await generationReply(response);
        if(result.error==='setup_required'){
         tell('처음 한 번 전용 GPT를 연결해 주세요.');
         const link=document.createElement('a');link.href='/noa-gpt-setup.php';link.textContent='전용 GPT 연결 설정';feedback.append(link);return;
        }
        if(!response.ok||!result.ok)throw Error(result.error==='worker_offline'?'비공개 실행기가 오프라인이에요. 연결 후 다시 눌러 주세요.':result.error==='revision_conflict'?'곡이 변경되었습니다. 편집기를 다시 열어 주세요.':'작업을 등록하지 못했습니다. 다시 시도해 주세요.');
        if(!result.plugin&&!result.worker){if(tab){tab.location.replace(result.url);launched=true;}else location.assign(result.url);return;}
        const title=state.data.fields.title||'선택한 곡';
        const taskId=result.id;
        const request='NOA STUDIO Assistant로 선택한 작업을 읽어줘. 작업 ID가 '+taskId+'일 때만 지정된 항목의 결과를 작성해 그 작업에 저장해줘.';
        if(state.gptFeedback && state.gptFeedback!==feedback){state.gptFeedback.hidden=true;state.gptFeedback.replaceChildren();}
        state.gptTask=taskId;state.gptField=key;state.gptFeedback=feedback;
        const chat=new URL('https://chatgpt.com/');chat.searchParams.set('q',request);
        if(result.worker){tell('생성 중이에요. 완료되면 이 칸에 저장됩니다.');}else{tell('ChatGPT에서 요청을 보내면 여기에 저장됩니다.');
        if(tab && !tab.closed){tab.location.replace(chat.href);launched=true;}
        else{
         const launch=document.createElement('a');launch.href=chat.href;launch.target='_blank';launch.rel='noopener';launch.textContent='ChatGPT 열기';feedback.append(launch);
        }
        }
        const until=Date.now()+3600000;
        async function refreshTask(){
         if(active!==state||state.gptTask!==taskId)return;
         if(Date.now()>until){state.gptTask=null;tell('요청 시간이 지났습니다. 생성 버튼을 다시 눌러 주세요.');return;}
         if(!document.hidden){
          try{
           const response=await fetch('/noa-gpt.php?op=progress',{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json','X-NOA-Bridge-Request':'1'},body:JSON.stringify({id:taskId})});
           if(active!==state||state.gptTask!==taskId)return;
           if(response.status===409){state.gptTask=null;tell('다른 작업으로 바뀌었거나 작업 시간이 만료됐습니다.');return;}
           const progress=await generationReply(response);
           if(progress.failed){state.gptTask=null;tell('생성을 완료하지 못했어요. 다시 시도해 주세요.',true);return;}
           if(progress.saved){
            if(state.dirty){state.gptTask=null;tell('결과가 저장됐어요. 현재 편집 내용은 유지됩니다. 편집기를 다시 열면 결과를 볼 수 있어요.');return;}
            const res=await fetch('/noa-inline-edit.php?'+new URLSearchParams(selector),{cache:'no-store',headers:{Accept:'application/json'}});
            const updated=await generationReply(res);
            if(active!==state||state.gptTask!==taskId)return;
            if(updated.ok&&updated.writeKey===state.data.writeKey&&!state.dirty){
             state.data=updated;
             for(const [name,el] of Object.entries(inputs))window.NoaRecordForm.set(el,updated.fields[name]);
             state.gptTask=null;tell('저장됨');return;
            }
           }
          }catch(e){if(active===state&&state.gptTask===taskId)tell(/[가-힣]/.test(e.message)?e.message:'연결을 확인하고 있습니다.',true);}
         }
         setTimeout(refreshTask,5000);
        }
        setTimeout(refreshTask,1800);
       }catch(e){tell(/[가-힣]/.test(e.message)?e.message:'서버에 연결할 수 없습니다. 곡 편집기를 다시 열어 주세요.',true);}finally{if(tab&&!launched&&!tab.closed)tab.close();state.busy=false;gpt.disabled=false;}
      };heading.append(gpt);
     }
    }
    if(feedback)wrap.append(feedback);sections.add(key,wrap);inputs[key]=input;
   }
   const playlist=['act','playlist'].includes(data.packageType)||selector.type==='act';
   if(data.packageType==='ep'){
    const source=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='원곡 정보 · 읽기 전용';source.append(legend);
    if(data.original?.status==='linked')for(const[key,label]of [['ep','EP 번호'],['title','원곡 제목'],['lyrics','원곡 가사']]){const wrap=document.createElement('label'),input=document.createElement(key==='lyrics'?'textarea':'input');wrap.textContent=label;input.value=data.original[key]||'';input.readOnly=true;wrap.append(input);source.append(wrap);}
    else{const note=document.createElement('p');note.textContent='원곡 연결을 확인해 주세요. 원곡 정보는 이 곡에서 변경할 수 없습니다.';source.append(note);}context.after(source);
   }
   for(const key of window.NoaRecordForm.keys(data.packageType)){const d=window.NoaRecordForm.describe(key,data.packageType);field(key,d.label,d.tag);}
   if(playlist){
    const members=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='수록곡';members.append(legend);const hidden=document.createElement('textarea');hidden.hidden=true;hidden.name='members';hidden.value=JSON.stringify(data.fields.members||[],null,2);inputs.members=hidden;members.append(hidden);let chosen=structuredClone(data.fields.members||[]);
    const selected=document.createElement('ol'),choices=document.createElement('details'),summary=document.createElement('summary'),pool=document.createElement('div');summary.textContent='수록곡 선택 · 누른 순서대로 번호 표시';choices.append(summary,pool);members.append(selected,choices);sections.add('members',members);
    const candidates=data.candidates||rows.filter(r=>r.kind!=='playlist'&&r.genre===data.context.genre).map(r=>({key:String(r.orderKey||r.key).replace(/^catalog:/,''),ep:Number(r.ep)||0,title:r.title}));
    function drawMembers(){selected.replaceChildren();pool.replaceChildren();for(const m of chosen){const item=document.createElement('li');item.textContent=m.title||candidates.find(c=>c.key===m.key)?.title||m.key;selected.append(item);}for(const m of candidates){const button=document.createElement('button');button.type='button';const position=chosen.findIndex(c=>c.key===m.key);button.textContent=(position>=0?(position+1)+'. ':'')+(m.ep?'EP.'+m.ep+' · ':'')+m.title;button.setAttribute('aria-pressed',String(position>=0));button.style.cssText='display:block;width:100%;min-height:44px;margin:4px 0;text-align:start';button.onclick=()=>{if(state.busy)return;if(position>=0)chosen.splice(position,1);else chosen.push({...m});if(data.packageType==='act')chosen.sort((a,b)=>Number(a.ep)-Number(b.ep));hidden.value=JSON.stringify(chosen,null,2);hidden.dispatchEvent(new Event('input',{bubbles:true}));drawMembers();};pool.append(button);}}
    drawMembers();if(data.packageType==='act'){const range=document.createElement('p');range.className='noa-edit-readonly';range.textContent='ACT '+data.context.act+' · '+data.context.range+' · 해당 EP 10곡을 오름차순으로 저장합니다.';members.append(range);}
   }
   if(selector.type==='song'){
    const names={geminiPrompt:'썸네일 프롬프트',youtubeTitle:'유튜브 제목',description:'영상 설명',communityPost:'커뮤니티 글'};
    const keys=Object.keys(names).filter(k=>inputs[k]);
    const publish=control('ai','게시 자료 생성','게시 자료 일괄 생성');
    const choices=document.createElement('details'),summary=document.createElement('summary');summary.textContent='생성할 항목 선택';choices.append(summary);
    choices.addEventListener('input',e=>e.stopPropagation());choices.addEventListener('change',e=>e.stopPropagation());
    const options=new Map();
    for(const k of keys){const line=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=!String(data.fields[k]||'').trim();line.append(box,document.createTextNode(names[k]+(box.checked?'':' · 기존 내용 교체')));choices.append(line);options.set(k,box);}
    const info=document.createElement('p');info.setAttribute('role','status');
    const area=document.createElement('section');area.append(publish,choices,info);form.prepend(area);
    async function post(url,body){
     const r=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-Bridge-Request':'1'},body:JSON.stringify(body)});
     const j=await r.json().catch(()=>({}));if(!r.ok||!j.ok)throw Error(j.error||r.headers.get('X-NOA-Error-Code')||'publish_unavailable');return j;
    }
    publish.onclick=async()=>{
     if(state.busy)return;
     if(state.dirty){info.textContent='먼저 수정 중인 곡 정보를 저장해 주세요.';return;}
     const targets=keys.filter(k=>options.get(k).checked);
     if(!targets.length){choices.open=true;info.textContent='빈 항목이 없습니다. 교체할 항목만 선택해 주세요.';return;}
     const revision=state.data.revision,job={selector,revision,targets};
     state.busy=true;publish.disabled=true;const wasDisabled=[...form.querySelectorAll('input,textarea,button,select')].map(el=>[el,el.disabled]);for(const [el] of wasDisabled)el.disabled=true;
     try{
      const config=await post('/noa-publish-set.php',{...job,mode:'inspect'});
      if(!config.ready){info.textContent='AI LAB의 서버 키와 텍스트 생성 한도 설정이 필요합니다.';return;}
      const creditMark='noa-free-api-confirm:'+config.keyId;
      if(localStorage.getItem(creditMark)!=='yes'){
       if(!confirm('AI LAB 키가 Pro 무료 크레딧을 받은 조직의 키이고, 구매 잔액과 자동 충전이 없음을 확인했나요? 확인한 경우에만 생성합니다.'))return;
       localStorage.setItem(creditMark,'yes');
      }
      info.textContent=config.eligible.map(k=>names[k]).join(' · ')+' 생성 중…';
      const result=await post('/noa-publish-set.php',{...job,creditSetupConfirmed:config.keyId});
      const saveId=crypto.randomUUID();
      const saved=await post('/noa-inline-edit.php',{selector,expectedRevision:revision,requestId:saveId,patch:result.patch});
      const r=await fetch('/noa-inline-edit.php?'+new URLSearchParams(selector),{cache:'no-store'}),fresh=await r.json();
      if(!fresh.ok||fresh.revision!==saved.revision||fresh.writeKey!==state.data.writeKey||Object.entries(result.patch).some(([k,v])=>fresh.fields[k]!==v))throw Error('readback');
      state.data=fresh;for(const k of Object.keys(result.patch)){window.NoaRecordForm.set(inputs[k],fresh.fields[k]);options.get(k).checked=false;}
      info.textContent=Object.keys(result.patch).map(k=>names[k]).join(' · ')+' 저장 완료';
      onSaved({selector,record:byKey.get(selector.key),data:fresh});
     }catch(e){info.textContent=({revision_conflict:'곡이 다른 곳에서 수정됐습니다. 다시 열어 최신 내용을 확인해 주세요.',ai_revision_changed:'곡이 변경되었습니다. 편집기를 다시 열어 주세요.',ai_provider_rate_limit:'API 한도 또는 크레딧 잔액을 확인해 주세요.',ai_budget_exceeded:'AI LAB의 사용 한도에 도달했습니다.',no_enabled_fields:'선택한 항목은 장르 규칙에서 꺼져 있습니다.',readback:'저장 응답을 받았지만 다시 읽어 확인하지 못했습니다. 곡을 다시 열어 주세요.'})[e.message]||'게시 자료 생성을 확인하지 못했습니다. 곡을 다시 열어 저장 상태를 확인해 주세요.';}
     finally{for(const [el,disabled]of wasDisabled)el.disabled=disabled;publish.disabled=false;state.busy=false;}
    };
   }
   const download=document.createElement('a');download.href='/noa-inline-edit.php?'+new URLSearchParams({...selector,download:'1'});download.textContent='전체 정보 JSON 파일';download.download='';if(selector.type!=='new')form.append(download);
   const fold=document.createElement('button');fold.type='button';fold.className='noa-action';fold.textContent='곡정보 접기';fold.setAttribute('aria-expanded','true');let folded=false;const content=[...form.children].map(child=>[child,child.hidden]);fold.onclick=()=>{folded=!folded;for(const [child,hidden] of content)child.hidden=folded||hidden;fold.textContent=folded?'곡정보 펼치기':'곡정보 접기';fold.setAttribute('aria-expanded',String(!folded));};form.prepend(fold);const buttons=document.createElement('div');buttons.className='noa-edit-buttons';const save=control('save','저장','정보 수정 저장');save.type='submit';buttons.append(save);buttons.append(cancel);form.append(buttons,status);status.textContent='곡·플레이리스트의 전체 정보를 한 문서에 저장하고 YouTube·음원에서 함께 사용합니다.';
   if(draftFields){for(const [key,value]of Object.entries(draftFields))if(inputs[key])window.NoaRecordForm.set(inputs[key],value);state.dirty=true;status.textContent='AI 제작 초안입니다. 검토 후 저장하면 곡에 반영됩니다.';}
   form.addEventListener('input',()=>{state.dirty=true;});form.addEventListener('change',()=>{state.dirty=true;});
   form.onsubmit=async event=>{
    event.preventDefault();if(state.busy)return;const patch={};try{for(const[key,input]of Object.entries(inputs)){const value=window.NoaRecordForm.value(input),before=state.data.fields[key]??(key==='creativeFields'?{}:key==='confirmed'?false:'');if(JSON.stringify(value)!==JSON.stringify(before))patch[key]=key==='title'?value.trim():value;}}catch{status.textContent='추가 제작 자료의 JSON 형식을 확인해 주세요.';return;}
    for(const key of Object.keys(patch))if(typeof patch[key]==='string'&&!patch[key].trim()&&typeof state.data.fields[key]==='string'&&state.data.fields[key].trim())patch[key]=state.data.fields[key];
    if(!Object.keys(patch).length&&selector.type!=='new'){state.dirty=false;close();return;}if('title'in patch&&!patch.title){status.textContent='제목을 입력해 주세요.';return;}
    if('ep'in patch)patch.ep=String(Number(patch.ep)).padStart(2,'0');
    if(selector.type==='new'&&inputs.members)patch.members=window.NoaRecordForm.value(inputs.members);
    const signature=JSON.stringify([state.data.writeKey,state.data.revision,patch]);if(signature!==state.signature){state.signature=signature;state.requestId=crypto.randomUUID();}
    let saved=false;state.busy=true;save.disabled=true;cancel.disabled=true;classification?.setBusy(true);for(const input of Object.values(inputs))input.disabled=true;status.textContent='저장 중입니다.';
    try{const response=await fetch('/noa-inline-edit.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-Bridge-Request':'1'},body:JSON.stringify({selector,expectedRevision:state.data.revision,requestId:state.requestId,patch,...('collections'in patch?{collectionRevisions:state.data.collectionRevisions}:{})})});let result=null;try{result=await response.json();}catch{}if(!response.ok||!result?.ok)throw Error(fieldErrors[result?.error]||(response.status===409?'다른 곳에서 먼저 수정했습니다. 변경 내용은 유지됩니다. 취소 후 다시 열어 최신 정보를 확인해 주세요.':'저장하지 못했습니다. 변경 내용을 유지했으니 다시 시도해 주세요.'));
     const savedSelector=selector.type==='new'?{type:'song',source:'music',key:state.data.writeKey}:selector;
     const check=await fetch('/noa-inline-edit.php?'+new URLSearchParams(savedSelector),{credentials:'same-origin',cache:'no-store'});let confirmed=null;try{confirmed=await check.json();}catch{}if(!check.ok||!confirmed?.ok||confirmed.writeKey!==state.data.writeKey||confirmed.revision!==result.revision||Object.entries(patch).some(([key,value])=>JSON.stringify(confirmed.fields[key])!==JSON.stringify(value)))throw Error('저장 결과를 확인하지 못했습니다. 같은 내용으로 다시 저장해 확인해 주세요.');
     saved=true;selector=savedSelector;state.selector=selector;state.data=confirmed;state.dirty=false;window.NoaBrowse.renderPath(context,{...confirmed.context,key:confirmed.writeKey,orderKey:byKey.get(selector.key)?.orderKey,title:confirmed.fields.title},{base:kind==='영상'?'/noa-youtube.php':'/noa-music.php'});for(const[key,input]of Object.entries(inputs))window.NoaRecordForm.set(input,confirmed.fields[key]);onSaved({selector,record:selector.type==='song'?byKey.get(selector.key):null,data:confirmed});status.textContent='저장했습니다.';button.setAttribute('aria-label',confirmed.fields.title+' 정보 수정');if(!standalone&&('genre'in patch||'collections'in patch)){status.textContent='분류를 저장했습니다. 목록에 반영하는 중입니다.';location.reload();}
    }catch(error){status.textContent=/[가-힣]/.test(error.message)?error.message:'저장하지 못했습니다. 변경 내용을 유지했으니 다시 시도해 주세요.';}finally{state.busy=false;save.disabled=false;cancel.disabled=false;classification?.setBusy(false);for(const input of Object.values(inputs))input.disabled=false;if(saved&&active===state)close();}
   };
  }catch(error){if(active===state)status.textContent=/[가-힣]/.test(error.message)?error.message:'세부정보를 불러오지 못했습니다. 로그인 상태와 연결을 확인해 주세요.';}
 }
 host.addEventListener('click',event=>{if(active&&event.target.closest('.noa-browse-card,.noa-list-toggle,.noa-browse-crumbs button,.noa-browse-pager button,.noa-order-controls')){event.preventDefault();event.stopImmediatePropagation();message('수정창의 저장 또는 취소를 눌러 편집을 마쳐 주세요.');}},true);
 window.addEventListener('beforeunload',event=>{if(active?.dirty){event.preventDefault();event.returnValue='';}});
 refresh();return{refresh,isEditing:()=>!!active,openRecord(selector,draftFields=null){const trigger=document.createElement('button');return open(host,trigger,selector,draftFields);}};
}
window.NoaBrowseEdit={mount};})();
