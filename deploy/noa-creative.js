/* N80 creative draft client. MySQL acknowledgments are the only saved-state signal. */
(()=>{'use strict';
const $=id=>document.getElementById('creative-'+id),csrf=document.querySelector('meta[name=n80-creative-csrf]').content,R=window.NoaRecordForm;
const targets=['vocal','title','lyrics','sunoPrompt','geminiPrompt','youtubeTitle','description','communityPost','creativeFields'];
const invalidFields=new Set();
const labels={story:'이야기 입력',questions:'질문 답변',intent:'의도 확인',writing:'곡정보 생성',review:'검토 중',published:'등록 완료',deleted:'삭제 보관함'};
const conditions={theme:'이야기',emotion:'분위기',genre:'음악 장르',instruments:'악기',vocal:'보컬',structure:'노래의 흐름',language:'언어',prohibitions:'피하고 싶은 표현'};
const errors={content_required:'내용을 입력하면 복구 저장을 시작합니다.',complete_song_info_first:'곡정보 생성을 마친 뒤 제작 파일을 연결해 주세요.',revision_conflict:'다른 창이나 처리 작업에서 내용이 변경되었습니다. 현재 입력은 화면에 남겨 두었습니다. 필요한 내용을 복사한 뒤 서버 버전을 불러와 주세요.',draft_not_found:'초안을 찾을 수 없거나 접근 권한이 없습니다.',generation_busy:'진행 중인 생성 작업이 있습니다.',worker_timeout:'AI 작업 응답 시간이 지났습니다. 저장된 내용은 유지됩니다. 다시 요청해 주세요.',dispatch_failed:'만들기를 시작하지 못했어요. 다시 시도해 주세요.',worker_unavailable:'지금은 만들기를 시작할 수 없어요. 잠시 후 다시 시도해 주세요.',four_choices_required:'질문을 준비하지 못했어요. 다시 시도해 주세요.',intent_evidence_required:'이야기를 제대로 정리하지 못했어요. 다시 시도해 주세요.',draft_changed:'새로 만든 내용이 있어요. 이전 작업에서 확인할 수 있어요.',field_changed:'수정 요청 후 이 항목이 변경되었습니다. 현재 내용을 기준으로 다시 요청해 주세요.',confirm_intent_first:'창작 의도 요약을 먼저 확정해 주세요.',unanswered_questions:'아직 답하지 않은 질문이 있습니다.',verified_audio_required:'실제 음원 업로드·검증이 필요합니다.',verified_cover_required:'실제 카드 이미지 연결·검증이 필요합니다.',ep_required:'EP 번호를 입력해 주세요.',ep_already_exists:'사용 중인 EP 번호입니다.',review_related_fields:'내용이 바뀐 연관 항목을 확인해 주세요.',resolve_proposals:'항목별 수정안을 적용하거나 취소해 주세요.',verify_sunoUrl:'Suno 주소의 실제 카드 이미지를 확인해 주세요.',verify_youtubeUrl:'YouTube 주소 검증이 필요합니다.',verify_mvUrl:'뮤직비디오 주소 검증이 필요합니다.',collection_unavailable:'선택한 곡 묶음을 확인해 주세요.',suno_verification_failed:'Suno 주소의 실제 곡·이미지를 확인하지 못했습니다. 주소를 확인하고 다시 시도해 주세요.',publication_not_ready:'게시 준비 항목을 먼저 확인해 주세요.',preview_changed:'미리보기 이후 데이터가 바뀌었습니다. 미리보기를 다시 확인해 주세요.',preview_required:'게시 미리보기를 먼저 확인해 주세요.',csrf_required:'로그인 상태가 바뀌었습니다. 입력한 내용을 보관하고 다시 로그인해 주세요.',creative_service_unavailable:'서버 저장을 확인하지 못했습니다. 입력을 유지하고 재시도해 주세요.',suno_prompt_too_long:'Suno 지시문이 1,000자를 넘었습니다. 다시 요청해 주세요.',fields_complete:'내용이 완성됐어요. 곡정보에서 원하는 부분을 다듬어 보세요.',generation_failed:'내용을 완성하지 못했어요. 선택한 내용은 그대로 있어요. 다시 시도해 주세요.'};
let draft=null,items=[],pending={},saving=null,timer=0,poll=null,questionIndex=0,inputs={},collections=[],upload=null,busy=false,epoch=0,conflict=false,assetActive=false,jobActive=false,currentJob=null,room=null,conversationLoading=null,storyEditing=false,editingQuestion=false,storyBase='';
const id=()=>[...crypto.getRandomValues(new Uint8Array(16))].map(x=>x.toString(16).padStart(2,'0')).join('');
const text=v=>typeof v==='string'?v:JSON.stringify(v,null,2);
function el(tag,value,cls){const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;if(tag==='dialog')n.classList.add('creative-dialog');return n;}
function button(label,fn){const b=el('button',label);b.type='button';b.onclick=()=>run(fn);return b;}
function message(error){return errors[error?.message||error]||'요청을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.';}
function status(s){$('status').textContent=s;room?.status(s);}
async function api(action,body,query={}){const url='/noa-bridge/creative.php?'+new URLSearchParams({action,...query});const response=await fetch(url,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json','X-NOA-CSRF':csrf},body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json();}catch{throw Error('creative_service_unavailable');}if(!response.ok)throw Error(data.error||'creative_service_unavailable');return data;}
function state(kind,s){if(kind==='saved'&&draft?.storage?.mode==='recovery')s='자동 저장됨';$('save').dataset.state=kind;$('save').textContent=s;if(kind==='saved'&&$('chat-retry')){$('chat-retry').remove();room?.status($('job').textContent);}}
function meaningful(value){return typeof value==='string'?!!value.trim():!!value&&typeof value==='object'&&Object.values(value).some(meaningful);}
function dirty(){return Object.keys(pending).length>0;}
function composedStory(){return [storyBase,$('story').value.trim()].filter(Boolean).join('\n\n');}
function acceptStory(){storyBase=draft?.creative.story||'';$('story').value='';$('story').blur();renderChat();}
async function submitStory(){
 const story=composedStory();if(!story.trim()){room?.status('이야기를 고르거나 전하고 싶은 내용을 적어 주세요.');return;}
 queue({story});await flush();acceptStory();
 // While story choices are open, a chat message adds a note. The choice's Next
 // button submits the selected directions and notes together exactly once.
 if($('fortune-options').childElementCount){room?.status('추가사항을 담았어요. 이야기를 고른 뒤 다음으로 진행해 주세요.');return;}
 await generate('analyze');
}
function queue(part){pending={...pending,...part,answerDrafts:{...(pending.answerDrafts||{}),...(part.answerDrafts||{})},fields:{...(pending.fields||{}),...(part.fields||{})},requests:{...(pending.requests||{}),...(part.requests||{})}};state('saving','저장 대기');$('final').disabled=true;clearTimeout(timer);timer=setTimeout(()=>flush().catch(fail),500);}
function fail(e){
 status(message(e));if(e.message==='revision_conflict'){conflict=true;$('reload').hidden=false;}
 // Only unsaved input needs a save retry. A failed generation has its own action.
 if(!dirty()&&!conflict)return;
 state('failed','저장하지 못했어요. 입력한 내용은 그대로 있어요.');$('retry-save').hidden=false;
 if(room?.active()){room.status(message(e)+' 입력한 내용은 그대로 있어요.');$('chat-retry')?.remove();const retry=button(conflict?'저장된 내용 확인하기':'다시 저장하기',()=>conflict?room?.close():flush());retry.id='creative-chat-retry';$('guide').append(retry);}
}
async function flush(){if(invalidFields.size)throw Error('invalid_creative_fields');clearTimeout(timer);if(saving){await saving;if(dirty())return flush();return;}if(conflict)throw Error('revision_conflict');if(!dirty())return;if(!draft&&!meaningful([pending.story,pending.fields,pending.requests])){pending={};state('idle','아직 저장된 내용이 없습니다.');return;}
 const wasNew=!draft,captured=pending;pending={};state('saving','서버에 저장 중');saving=(async()=>{try{let data;if(!draft){const draftId=new URL(location.href).searchParams.get('draft')||id();history.replaceState(null,'',location.pathname+'?tool=creative&draft='+draftId);data=await api('create',{id:draftId,story:captured.story||'',fields:captured.fields||{},requests:captured.requests||{}});draft=data.draft;}
 if(Object.keys(captured).some(k=>!['fields','requests','answerDrafts'].includes(k)||Object.keys(captured[k]).length))data=await api('save',{id:draft.id,revision:draft.revision,...captured});if(data)draft=data.draft;state('saved','저장 완료');$('retry-save').hidden=true;syncMeta();if(wasNew){const focused=document.activeElement,keep=$('record').contains(focused)?{name:focused.name,start:focused.selectionStart,end:focused.selectionEnd}:null;renderRecord();const next=keep&&inputs[keep.name];if(next){next.focus({preventScroll:true});if(typeof keep.start==='number')next.setSelectionRange(keep.start,keep.end);}}}
 catch(e){pending={...captured,...pending,answerDrafts:{...(captured.answerDrafts||{}),...(pending.answerDrafts||{})},fields:{...(captured.fields||{}),...(pending.fields||{})},requests:{...(captured.requests||{}),...(pending.requests||{})}};throw e;}finally{saving=null;window.N80Runtime?.wake();}})();await saving;if(dirty())await flush();}
async function run(fn){if(busy)return;busy=true;syncComposer();try{await fn();}catch(e){fail(e);}finally{busy=false;syncComposer();window.N80Runtime?.wake();}}
async function mutate(action,body={}){await flush();if(!draft)throw Error('story_required');const data=await api(action,{id:draft.id,revision:draft.revision,...body});if(data.draft){draft=data.draft;render();state('saved','저장 완료');}return data;}
function syncMeta(){if(!draft)return;$('ep-label').hidden=draft.genre!=='kpop-original';$('location-note').textContent=draft.genre==='kpop-original'?'EP 번호에 따라 ACT '+(Math.ceil(Number($('ep').value)/10)||'—')+'에 배치됩니다.':'사연곡으로 등록됩니다. 아래에서 곡 묶음을 선택할 수 있습니다.';const field=document.querySelector('[data-record-field=sunoTitle] input');if(field)field.value=draft.sunoTitle;}
function paintList(){const rows=items;$('list').replaceChildren();if(!rows.length)$('list').append(el('p','보관된 초안이 없습니다. 새로운 이야기를 시작해 보세요.'));for(const row of rows){const wrap=el('article',undefined,'creative-row'),info=el('div');info.append(el('h3',row.title||'새 창작곡'),el('p',(row.genre==='kpop-original'?'오리지널송':'사연곡')+' · '+labels[row.stage]+' · 창작 정보 '+row.completion+'% · '+new Date(row.updatedAt).toLocaleString('ko-KR')));const controls=el('div',undefined,'creative-controls');controls.append(button(row.stage==='deleted'?'복구':'이어하기',async()=>{await open(row.id);if(row.stage==='deleted')await mutate('restoreDeleted');}));if(row.stage!=='deleted')controls.append(button('삭제',async()=>{if(!confirm('이 초안을 삭제 보관함으로 옮길까요? 이력과 연결 파일은 유지되며 복구할 수 있습니다. 정식 등록한 곡은 삭제되지 않습니다.'))return;await open(row.id);await mutate('delete',{confirm:row.id});await library();}));wrap.append(info,controls);$('list').append(wrap);}}
async function library(){await flush();epoch++;stopWatching();$('work').hidden=true;$('library').hidden=false;history.replaceState(null,'',location.pathname+'?tool=creative');await loadList();status('곡정보가 완성된 초안을 보관합니다. 진행 중 내용은 마지막 입력부터 24시간 동안 복구할 수 있습니다.');}
async function open(draftId){await flush();epoch++;const data=await api('get',undefined,{id:draftId});draft=data.draft;storyBase=draft.creative.story;$('story').value='';status('저장된 초안을 이어서 작업합니다.');questionIndex=draft.creative.questionPosition??Math.max(0,Object.keys(draft.creative.questions).findIndex(k=>!draft.creative.answers[k]));pending={};conflict=false;storyEditing=false;editingQuestion=false;invalidFields.clear();$('reload').hidden=true;history.replaceState(null,'',location.pathname+'?tool=creative&draft='+draft.id);$('library').hidden=true;$('work').hidden=false;render();showJob(data.job);state('saved','저장 완료');await loadCollections();await assets();schedule();}
async function loadList(more=false){const data=await api('list',undefined,{q:$('search').value,filter:$('filter').value,sort:$('sort').value,offset:String(more?items.length:0)});items=more?[...items,...data.items]:data.items;$('more').hidden=!data.hasMore;paintList();const recovery=$('recoveries');recovery.replaceChildren();recovery.hidden=!(data.recoveries||[]).length;if(!recovery.hidden){recovery.append(el('h2','중단한 창작 이어가기'),el('p','앱이 종료됐어도 저장된 대화부터 이어갈 수 있습니다.'));for(const row of data.recoveries){const item=el('div',undefined,'creative-row creative-recovery-row'),info=el('div');info.append(el('p',row.title||'입력 중인 창작'),el('small',new Date(row.expiresAt*1000).toLocaleString('ko-KR',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'})+'까지 복구 가능'));item.append(info,button('대화 이어가기',async()=>{await open(row.id);await openConversation();}));recovery.append(item);}}}
function chatMessage(root,value,speaker='ainoa',edit,editLabel='수정'){
 const turn=el('div',undefined,'creative-chat-turn');turn.dataset.speaker=speaker;
 const bubble=el('p',value,'ainoa-conversation-message');bubble.dataset.speaker=speaker;
 turn.append(el('small',speaker==='user'?'나':'AInoa'),bubble);
 if(edit)turn.append(button(editLabel,edit));root.append(turn);
}
async function conversationReady(){
 if(window.NoaAInoa?.openConversation)return;
 const main=document.querySelector('.creative-main');
 if(!document.querySelector('link[href*="/noa-ainoa.css"]')){const css=document.createElement('link');css.rel='stylesheet';css.href='/noa-ainoa.css?v='+main.dataset.ainoaCss;document.head.append(css);}
 conversationLoading??=new Promise((resolve,reject)=>{
  const existing=document.querySelector('script[src*="/noa-ainoa.js"]'),script=existing||document.createElement('script');
  const timeout=setTimeout(()=>reject(Error('AInoa 대화창을 불러오지 못했습니다. 다시 눌러 주세요.')),12000);
  script.addEventListener('load',()=>{clearTimeout(timeout);window.NoaAInoa?.openConversation?resolve():reject(Error('AInoa 대화창 연결을 확인해 주세요.'));},{once:true});
  script.addEventListener('error',()=>{clearTimeout(timeout);if(!existing)script.remove();reject(Error('AInoa 대화창을 불러오지 못했습니다.'));},{once:true});
  if(!existing){script.src='/noa-ainoa.js?v='+main.dataset.ainoaJs;document.head.append(script);}
 }).catch(e=>{conversationLoading=null;throw e;});
 await conversationLoading;
}
async function openConversation(){
 if(room?.active()){room.focus();return;}await conversationReady();
 room=window.NoaAInoa.openConversation({title:'노래 창작하기 · 이야기를 노래로',onClose:()=>{
  room=null;$('guide').hidden=true;$('work').insertBefore($('guide'),$('job'));$('guide').append($('composer'));
  // The same draft stays open in the song-info form, including while AI is running.
  $('library').hidden=true;$('work').hidden=false;
  requestAnimationFrame(()=>{$('record').focus({preventScroll:true});$('record').scrollIntoView({block:'start',behavior:'instant'});});
  flush().catch(fail);
 }});
 room.content.closest('dialog').classList.add('creative-conversation');
 room.content.append($('guide'));$('guide').hidden=false;room.actions.append($('composer'));
 renderChat();renderQuestions();renderIntent();syncComposer();room.focus();room.status($('job').textContent);
}
function renderChat(){
 const root=$('chat-log');root.replaceChildren();
 chatMessage(root,'안녕하세요, AInoa예요. 어떤 이야기를 노래로 남기고 싶으세요? 각 단계에서 네 가지 중 여러 개를 고르고, 다음을 눌러 함께 정해요.');
 const c=draft?.creative,story=pending.story??c?.story??$('story').value;
 if(story)chatMessage(root,story,'user',c?.publication?null:()=>{storyEditing=true;renderIntent();syncComposer();$('story').focus({preventScroll:true});},'추가 요청');
 for(const [key,q] of Object.entries(c?.questions||{}))if(c.answers[key]){
  chatMessage(root,q.prompt);chatMessage(root,c.answers[key],'user',c.publication?null:()=>{editingQuestion=true;storyEditing=false;questionIndex=Object.keys(c.questions).indexOf(key);renderQuestions();renderIntent();syncComposer();});
 }
 syncComposer();
}
function syncComposer(){
 for(const key of ['record','assets','publish','chat-log','intent'])$(key).inert=busy;
 for(const key of ['new','back','jobs','retry-save','reload'])$(key).disabled=busy;
 const c=draft?.creative,hasAnalysis=!!Object.keys(c?.intent||{}).length||!!Object.keys(c?.questions||{}).length;
 const storyMode=!c?.publication&&(!hasAnalysis||storyEditing)&&!jobActive;
 $('questions').hidden=storyMode||jobActive||(!editingQuestion&&hasAnalysis&&Object.keys(c.questions||{}).every(k=>c.answers[k]));
 $('story-next').hidden=!storyMode||!composedStory().trim()||!!$('fortune-options').childElementCount;
 $('story-next').disabled=busy||jobActive;
 $('fortune-start').hidden=!storyMode;
 $('fortune-start').disabled=busy||jobActive;
 $('fortune-options').hidden=!storyMode;
 $('story-compose').hidden=!storyMode;
 $('answer-compose').hidden=storyMode||jobActive||!!c?.publication||!$('answer-compose').childElementCount;
 if(room?.active())room.actions.hidden=$('story-compose').hidden&&$('answer-compose').hidden;
 $('analyze').disabled=busy||jobActive||!!c?.publication||!$('story').value.trim();
 $('story').disabled=busy||jobActive||!!c?.publication||draft?.stage==='deleted';
 for(const b of $('fortune-options').querySelectorAll('button'))b.disabled=busy||jobActive;
 for(const b of $('questions').querySelectorAll('button'))b.disabled=busy||jobActive||!!c?.publication;
 const answer=$('answer-send'),custom=$('answer-compose').querySelector('textarea');if(custom)custom.disabled=busy||jobActive||!!c?.publication;if(answer)answer.disabled=busy||jobActive||!!c?.publication||!custom?.value.trim();
}
async function answerQuestion(key,value){
 if(!value.trim()){room?.status('선택지를 고르거나 추가 설명을 입력해 주세요.');return;}
 if([...value].length>4000){room?.status('선택과 추가 설명을 합해 4,000자 이내로 줄여 주세요.');return;}
 $('answer-compose').querySelector('textarea')?.blur();await mutate('answer',{condition:key,answer:value});editingQuestion=false;
 questionIndex=Math.max(0,Object.keys(draft.creative.questions).findIndex(k=>!draft.creative.answers[k]));
 renderChat();renderQuestions();renderIntent();syncComposer();
 room?.status('');
}
function renderQuestions(){
 const root=$('questions'),compose=$('answer-compose');root.replaceChildren();compose.replaceChildren();
 const c=draft?.creative,entries=Object.entries(c?.questions||{});if(!entries.length){syncComposer();return;}
 const answered=entries.filter(([k])=>c.answers[k]).length;
 root.append(el('h2','창작 조건 · '+answered+' / '+entries.length+' 답변'));
 if((answered===entries.length&&!editingQuestion)||c.publication){syncComposer();return;}
 questionIndex=Math.min(questionIndex,entries.length-1);
 const [key,q]=entries[questionIndex];chatMessage(root,q.prompt);
 const saved=pending.answerDrafts?.[key]??c.answerDrafts?.[key];let restored;
 try{const parsed=JSON.parse(saved);if(parsed?.version===1&&Array.isArray(parsed.choices)&&typeof parsed.custom==='string')restored=parsed;}catch{}
 const selected=new Set(restored?restored.choices.filter(v=>q.options.includes(v)):q.options.filter(v=>c.answers[key]===v));
 const custom=el('textarea');custom.rows=2;custom.maxLength=2500;custom.placeholder='추가 설명 · 선택지와 함께 반영해요';custom.setAttribute('aria-label','직접 입력');custom.value=restored?.custom??saved??'';
 // Versioned UI state stays in the existing recovery checkpoint; AI receives
 // all selected labels as plain text only after the explicit Next action.
 const checkpoint=()=>{const value=JSON.stringify({version:1,choices:[...selected],custom:custom.value});if([...value].length>4000){room?.status('추가 설명을 조금 줄여 주세요. 현재 입력은 화면에 유지됩니다.');return;}queue({answerDrafts:{[key]:value}});};
 root.append(el('p','복수 선택 가능 · 고른 뒤 다음을 눌러 주세요.'));
 const grid=el('div',undefined,'creative-options');for(const option of q.options){const b=button(option,()=>{selected.has(option)?selected.delete(option):selected.add(option);b.setAttribute('aria-pressed',String(selected.has(option)));checkpoint();});b.setAttribute('aria-pressed',String(selected.has(option)));grid.append(b);}root.append(grid);
 custom.oninput=()=>{checkpoint();syncComposer();};
 const advance=()=>answerQuestion(key,[...selected,custom.value.trim()].filter(Boolean).join('\n'));
 const next=button('다음',advance);next.id='creative-question-next';root.append(next);
 const send=button('전송',advance);send.id='creative-answer-send';compose.append(custom,send);
 const nav=el('div',undefined,'creative-controls');
 if(questionIndex>0)nav.append(button('이전 질문',()=>{editingQuestion=true;questionIndex--;queue({progress:questionIndex});renderQuestions();}));root.append(nav);syncComposer();
}
async function fortuneStories(){
 const target=room,capturedEpoch=epoch,root=$('fortune-options');root.replaceChildren(el('p','오늘의 운세를 불러오고 있어요.'));
 try{
  const response=await fetch('/noa-bridge/listening.php',{credentials:'same-origin'});
  if(!response.ok)throw Error('fortune_unavailable');const data=await response.json();
  if(epoch!==capturedEpoch||room!==target||!room?.active())return;
  root.replaceChildren();room.status('');const f=data.fortune;
  if(!f?.date||!f?.headline||!f?.body){
   root.append(el('p','오늘의 운세를 만들려면 생년월일 설정이 필요해요. 설정 후 다시 눌러 주세요.'));
   const link=el('a','생년월일 설정 열기');link.href='/?setup=fortune#noa-daily-fortune';link.target='_blank';link.rel='noopener';root.append(link);return;
  }
  const source=[f.headline,f.body,f.tip].filter(v=>typeof v==='string').join('\n');
  root.append(el('h2','오늘, 어떤 이야기를 담아볼까요?'),el('p','마음이 가는 이야기를 골라 주세요. 여러 개를 함께 골라도 좋아요.'));
  const stories=[['나에게 건네는 위로','고단했던 하루 끝에 잠시 쉬어 가며, 내 마음을 다독이는 이야기.'],['미뤄 둔 한마디','쉽게 꺼내지 못했던 마음을 전하고, 서로에게 조금 더 가까워지는 이야기.'],['작은 시작','망설이던 첫걸음을 내딛고, 서툴러도 나만의 속도로 나아가는 이야기.'],['문득 떠오른 너','우연히 들은 노래에 오래된 기억이 떠올라, 그때의 마음을 다시 만나는 이야기.']];
  const selected=new Set(),grid=el('div',undefined,'creative-options');
  for(const [index,[label,story]] of stories.entries()){const b=button(label+' · '+story,()=>{selected.has(index)?selected.delete(index):selected.add(index);b.setAttribute('aria-pressed',String(selected.has(index)));});b.setAttribute('aria-pressed','false');grid.append(b);}
  const next=button('선택한 이야기로 다음',async()=>{
   if(!selected.size){room?.status('이야기 방향을 하나 이상 골라 주세요.');return;}
   const inspiration=[...selected].map(i=>stories[i][1]).join('\n')+'\n\n이야기에 담고 싶은 마음\n'+source;
   const story=[composedStory(),inspiration].filter(Boolean).join('\n\n');
   queue({story});await flush();acceptStory();root.replaceChildren();
   await generate('analyze');
  });root.append(grid,next);
 }catch{if(epoch===capturedEpoch&&room===target){root.replaceChildren(el('p','운세를 불러오지 못했어요. 잠시 후 다시 눌러 주세요.'));}}
}
function renderIntent(){
 const root=$('intent');root.replaceChildren();const c=draft?.creative;if(jobActive||!c||!Object.keys(c.intent||{}).length)return;
 const complete=Object.keys(conditions).every(k=>c.intent[k]?.value&&(!c.questions[k]||c.answers[k]));if(!complete||editingQuestion||storyEditing)return;
 if(c.intentConfirmed&&draft.completion.percent===100){chatMessage(root,'노래에 담을 내용을 완성했어요. 곡정보에서 확인하고 다듬어 보세요.');const b=button('곡정보 확인하기',()=>room?.close());b.className='creative-chat-ready';root.append(b);return;}
 if(c.publication)return;
 const review=el('details',undefined,'creative-intent-review');review.append(el('summary','선택한 내용 보기'));
 for(const key of Object.keys(conditions)){const row=el('div',undefined,'creative-intent-row');row.append(el('strong',conditions[key]),el('p',c.intent[key].value));review.append(row);}root.append(review);
 const failed=currentJob?.operation==='generate'&&currentJob.state==='failed';
 const b=button(failed?'다시 만들기':c.intentConfirmed?'계속 만들기':'이대로 노래 만들기',()=>generate('generate'));b.className='creative-chat-ready';root.append(b);
}
function renderRecord(){const host=$('record');host.replaceChildren();inputs={};if(!draft){host.append(el('h2','곡정보 · 새 창작곡'));const form=el('div');host.append(form);const view=R.render(form,{type:'song',fields:{},keys:R.visibleKeys('song').filter(k=>k!=='ep'),prefix:'creative-field',sunoTitle:''});inputs=view.inputs;for(const [key,input]of Object.entries(inputs)){input.readOnly=['cardImageLocation','audioFileLocation'].includes(key);input.oninput=()=>{try{const value=R.value(input);invalidFields.delete(key);queue({fields:{[key]:value}});}catch{invalidFields.add(key);state('failed','추가 제작 자료 형식을 확인해 주세요.');}}}return;}host.append(el('h2','곡정보 · 창작 정보 '+draft.completion.percent+'%'));const form=el('div');host.append(form);const keys=R.visibleKeys(draft.type).filter(k=>k!=='ep');const view=R.render(form,{type:draft.type,fields:{...draft.fields,...pending.fields},keys,prefix:'creative-field',sunoTitle:draft.sunoTitle});inputs=view.inputs;for(const [key,input]of Object.entries(inputs)){const wrap=input.closest('[data-record-field]')||input.parentElement;
 input.disabled=!!draft.creative.publication;input.readOnly=input.readOnly||['cardImageLocation','audioFileLocation'].includes(key);input.addEventListener('input',()=>{try{const value=R.value(input);invalidFields.delete(key);queue({fields:{[key]:value}});}catch{invalidFields.add(key);$('final').disabled=true;state('failed','추가 제작 자료 형식을 확인해 주세요.');}});
 if(targets.includes(key)){const label=el('label','AI 요구사항', 'creative-request'),request=el('textarea');request.rows=2;request.maxLength=4000;request.value=pending.requests?.[key]??draft.creative.requests[key]??'';request.placeholder='이 항목에서 바꾸고 싶은 내용을 적어 주세요.';request.disabled=!!draft.creative.publication;request.oninput=()=>queue({requests:{[key]:request.value}});label.append(request);wrap.append(label);const controls=el('div',undefined,'creative-controls');const revise=button('해당 항목 수정',()=>generate('revise',key));revise.disabled=!draft.creative.intentConfirmed;controls.append(revise,button('수정 이력',async()=>{const data=await api('history',undefined,{id:draft.id,field:key});const dialog=el('dialog');const title=el('h2',R.describe(key,draft.type).label+' 이력');const list=el('select'),value=el('pre');data.versions.forEach((v,i)=>list.add(new Option('버전 '+v.revision,String(i))));const show=()=>value.textContent=text(data.versions[Number(list.value)]?.value||'');list.onchange=show;show();dialog.append(title,list,value,button('이 버전 복원',async()=>{await mutate('restoreField',{field:key,version:data.versions[Number(list.value)].revision});dialog.close();dialog.remove();}),button('닫기',()=>{dialog.close();dialog.remove();}));document.body.append(dialog);dialog.showModal();}));wrap.append(controls);
 if(draft.creative.needsReview[key]){wrap.append(el('p','연관 내용이 변경되었습니다. 이 항목의 일치 여부를 확인해 주세요.','creative-review'),button('내용 확인 완료',()=>mutate('review',{field:key})));}
 const p=draft.creative.proposals[key];if(p){const compare=el('div',undefined,'creative-compare');for(const [name,v]of [['현재 내용',draft.fields[key]],['수정안',p.value]]){const col=el('div');col.append(el('h3',name),el('pre',text(v)));compare.append(col);}wrap.append(compare,button('수정안 적용',()=>mutate('proposal',{field:key,decision:'apply'})),button('취소 · 현재 내용 유지',()=>mutate('proposal',{field:key,decision:'cancel'})));}
 }
 if(['sunoUrl','youtubeUrl','mvUrl'].includes(key))wrap.append(button(key==='sunoUrl'?'실제 곡 확인 · 카드 이미지 연결':'실제 영상 확인',async()=>{await mutate(key==='sunoUrl'?'sunoCover':'verifyUrl',{field:key});await assets();}));
 }if(draft.creative.publication)for(const b of form.querySelectorAll('button'))if(!b.textContent.includes('이력')&&!b.textContent.includes('복사'))b.disabled=true;}
function render(){if(!draft)return;const published=!!draft.creative.publication;$('story').disabled=published||draft.stage==='deleted';$('analyze').disabled=published||draft.stage==='deleted';renderChat();renderQuestions();renderIntent();renderRecord();$('assets').hidden=published||draft.storage?.mode!=='draft';$('publish').hidden=draft.stage==='deleted'||draft.storage?.mode!=='draft';$('category').value=draft.genre;$('ep').value=draft.fields.ep||'';syncMeta();paintCollections();$('preview').replaceChildren();$('final').disabled=true;$('published').replaceChildren();if(published){const p=draft.creative.publication,a=el('a','등록한 곡 보기');a.href=p.href;$('published').append(el('p','등록 완료 · '+p.category),a);$('final').hidden=true;}else $('final').hidden=false;}
async function loadCollections(){collections=(await api('collections',undefined,{id:draft.id})).collections;paintCollections();}
function paintCollections(){const root=$('collections');root.replaceChildren();for(const c of collections.filter(c=>c.genre===$('category').value)){const label=el('label'),check=el('input');check.type='checkbox';check.value=c.key;check.checked=(draft?.creative.collections||[]).includes(c.key);check.onchange=saveLocation;label.append(check,document.createTextNode(c.title));root.append(label);}}
function saveLocation(){queue({location:{genre:$('category').value,ep:$('ep').value,collections:[...$('collections').querySelectorAll('input:checked')].map(i=>i.value)}});$('ep-label').hidden=$('category').value!=='kpop-original';$('location-note').textContent=$('category').value==='kpop-original'?'ACT '+(Math.ceil(Number($('ep').value)/10)||'—')+'에 배치됩니다.':'사연곡으로 등록됩니다.';}
async function generate(operation,field=''){
 storyEditing=false;editingQuestion=false;showJob({operation,field,state:'queued'});let accepted=false;
 try{
  if(operation==='generate'&&!draft.creative.intentConfirmed)await mutate('confirmIntent');
  const submitted=await mutate('generate',{operation,field,requestId:id()});accepted=true;showJob(submitted.job);schedule();
  const data=await api('get',undefined,{id:draft.id});if(data.draft.revision!==draft.revision){draft=data.draft;render();}showJob(data.job);
 }catch(e){if(!accepted)showJob({operation,field,state:'failed',error:e.message});throw e;}
}
function jobMessage(job){
 if(!job)return '';
 if(['queued','running'].includes(job.state))return ({analyze:'다음 질문을 준비하고 있어요.',generate:'노래에 담을 내용을 만들고 있어요.',revise:'요청하신 내용을 다듬고 있어요.'}[job.operation]||'요청하신 내용을 준비하고 있어요.');
 return {succeeded:'',review:'새로 만든 내용이 있어요. 현재 내용과 비교해 보세요.',failed:message(job.error||'generation_failed'),canceled:'만들기를 취소했어요.'}[job.state]??'진행 상황을 확인하고 있어요.';
}
function showJob(job){
 currentJob=job;jobActive=['queued','running'].includes(job?.state);if(job?.id)window.N80Activity?.snapshot('creative',[{id:job.id,state:job.state}]);
 $('job').dataset.busy=String(jobActive);$('job').textContent=jobMessage(job);if(room?.active())room.status($('job').textContent);
 renderIntent();syncComposer();$('job-result').hidden=job?.state!=='review';
 $('job-result').onclick=()=>run(async()=>{const data=await api('jobResult',undefined,{id:draft.id});const dialog=el('dialog');dialog.append(el('h2','새로 만든 내용'));renderResult(dialog,data.result);dialog.append(button('닫기',()=>{dialog.close();dialog.remove();}));document.body.append(dialog);dialog.showModal();});
}
function renderResult(root,result){
 // Present only creative content. Worker envelopes and unparsed output remain on the server.
 if(typeof result==='string')try{result=JSON.parse(result.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{result=null;}
 let count=0;const add=(label,value)=>{if(typeof value!=='string'||!value.trim())return;root.append(el('h3',label),el('pre',value));count++;};
 const fields=result?.fields||{};
 for(const key of targets)if(key!=='creativeFields')add(R.schema[key]?.[0]||'노래 내용',key==='vocal'?result?.vocal||fields[key]:fields[key]);
 const extras={storyPlan:'이야기 구성',chorusHook:'후렴',englishHook:'영어 후렴',hashtags:'해시태그',localizations:'다른 언어 표현',genreRecommendation:'추천 장르'};
 for(const [key,label]of Object.entries(extras))add(label,fields.creativeFields?.[key]);
 for(const [key,label]of Object.entries(conditions)){add(label,result?.intent?.[key]?.value);const q=result?.questions?.[key];if(q?.prompt&&Array.isArray(q.options))add(label,q.prompt+'\n'+q.options.filter(v=>typeof v==='string').join('\n'));}
 if(!count)root.append(el('p','표시할 수 있는 내용이 아직 없어요.'));
}
function stopWatching(){if(poll){poll();poll=null;}}
function schedule(){stopWatching();const current=epoch;poll=N80Runtime.watch('creative:'+draft.id,()=>N80Runtime.read('creative:get:'+draft.id,()=>api('get',undefined,{id:draft.id})),async data=>{if(current!==epoch)return;if(data.draft.revision!==draft.revision){draft=data.draft;render();state('saved','저장 완료');}showJob(data.job);if(!$('assets').hidden)try{await assets();}catch(e){status(message(e));}},{interval:7000,immediate:false,active:()=>current===epoch&&draft&&!$('work').hidden&&!dirty()&&!saving&&!busy&&!conflict&&!invalidFields.size&&(jobActive||assetActive),error:e=>status(message(e))});}

async function assets(){if(!draft)return;const data=await api('assets',undefined,{id:draft.id});const a=data.assets;assetActive=['uploading','queued','retrying','analyzing','processing','verifying'].includes(a.status);$('asset-state').textContent='음원 '+(a.audioReady?'검증 완료':({audio_pending:'파일 연결 필요',ready:'현재 곡의 파일 확인 필요',uploading:'업로드 중',queued:'처리 대기',retrying:'재시도 중',analyzing:'분석 중',processing:'최적화 중',verifying:'검증 중',failed:'처리 실패'}[a.status]||'파일 확인 중'))+' · 이미지 '+(a.coverReady?'검증 완료':'연결 필요');const root=$('media-preview');root.replaceChildren();if(a.cover){const img=el('img');img.className='creative-cover';img.src=a.cover;img.alt='검증한 카드 이미지';root.append(img);inputs.sunoUrl?.setSavedPreview?.(draft.fields.sunoUrl,a.cover);}if(a.audio){const audio=el('audio');audio.controls=true;audio.preload='none';audio.src=a.audio;root.append(audio);}if(a.upload){upload=a.upload;$('audio-retry').hidden=a.status!=='failed';}}
async function binary(action,file,query){const response=await fetch('/noa-bridge/creative.php?'+new URLSearchParams({action,id:draft.id,revision:String(draft.revision),...query}),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/octet-stream','X-NOA-CSRF':csrf},body:file});const data=await response.json();if(!response.ok)throw Error(data.error);return data;}
$('cover-file').onchange=()=>run(async()=>{const file=$('cover-file').files[0];if(!file)return;await flush();const data=await binary('cover',file,{});draft=data.draft;render();await assets();});
$('audio-file').onchange=()=>run(async()=>{const file=$('audio-file').files[0];if(!file)return;await flush();const head=new Uint8Array(await file.slice(0,65536).arrayBuffer()),meta=new TextEncoder().encode(file.name+':'+file.size),bytes=new Uint8Array(head.length+meta.length);bytes.set(head);bytes.set(meta,head.length);const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');const res=await api('init',{id:draft.id,revision:draft.revision,filename:file.name,bytes:file.size,fingerprint});upload={id:res.id};$('upload-progress').hidden=false;const chunks=new Set(res.chunks);for(let index=0;index<Math.ceil(file.size/res.chunkSize);index++){if(!chunks.has(index))await binary('chunk',file.slice(index*res.chunkSize,(index+1)*res.chunkSize),{upload:res.id,index:String(index)});$('upload-progress').value=Math.min(100,(index+1)*res.chunkSize/file.size*100);}$('asset-state').textContent='전송 완료 · 음원 최적화 접수 중';await api('finish',{id:draft.id,revision:draft.revision,upload:res.id});await assets();schedule();});
$('audio-retry').onclick=()=>run(async()=>{await mutate('retry',{upload:upload.id});await assets();});
$('preview-button').onclick=()=>run(async()=>{const data=await mutate('preview');const v=data.preview.validation,root=$('preview');root.replaceChildren(el('h3',v.title||'곡 제목 확인 필요'),el('p',v.category+(v.act?' · ACT '+v.act:'')),el('p','Suno 제목 · '+v.sunoTitle));if(v.assets.cover){const image=el('img');image.className='creative-cover';image.src=v.assets.cover;image.alt='게시 카드 이미지';root.append(image);}root.append(el('pre',v.lyrics),el('pre',v.description));for(const issue of v.issues)root.append(el('p','• '+(errors[issue]||(R.schema[issue]?R.schema[issue][0]+' 입력 필요':issue)),'creative-review'));$('final').disabled=!v.ready||!$('rights').checked;});
$('rights').onchange=()=>{$('final').disabled=!$('rights').checked||!draft?.creative.preview?.validation.ready||dirty();};
$('final').onclick=()=>run(async()=>{await mutate('publish',{token:draft.creative.preview?.token||'',rightsConfirmed:$('rights').checked});status('정식 등록을 완료했습니다. 초안 이력은 보관함에 유지됩니다.');});
$('story').oninput=()=>{queue({story:composedStory()});syncComposer();};$('story-compose').onsubmit=event=>{event.preventDefault();run(submitStory);};
$('story-next').onclick=()=>run(submitStory);
$('fortune-start').onclick=()=>run(fortuneStories);
$('chat').onclick=()=>openConversation().catch(fail);
$('new').onclick=()=>run(async()=>{await flush();epoch++;stopWatching();draft=null;storyBase='';pending={};inputs={};conflict=false;assetActive=false;storyEditing=false;editingQuestion=false;invalidFields.clear();history.replaceState(null,'',location.pathname+'?tool=creative');$('library').hidden=true;$('work').hidden=false;$('story').value='';$('story').disabled=false;for(const x of ['questions','intent','record','preview','published','fortune-options'])$(x).replaceChildren();$('assets').hidden=true;$('publish').hidden=true;showJob(null);renderRecord();state('idle','내용을 입력하면 24시간 동안 복구할 수 있습니다.');await openConversation();status('이야기를 입력하거나 오늘의 운세에서 시작해 보세요.');});
$('jobs').onclick=()=>run(async()=>{await flush();if(!draft)return;const data=await api('jobs',undefined,{id:draft.id});const dialog=el('dialog');dialog.append(el('h2','이전 작업'));if(!data.jobs.length)dialog.append(el('p','아직 완료한 작업이 없어요.'));for(const j of data.jobs){const row=el('div'),operation={analyze:'이야기 정리',generate:'노래 만들기',revise:'내용 다듬기'}[j.operation]||'창작',state={queued:'준비 중',running:'만드는 중',succeeded:'완료',review:'확인 필요',failed:'완성하지 못함',canceled:'취소됨'}[j.state]||'확인 중';row.append(el('p',operation+' · '+state));if(j.error)row.append(el('p',message(j.error)));if(['succeeded','review'].includes(j.state))row.append(button('내용 보기',async()=>{const v=await api('jobResult',undefined,{id:draft.id,job:j.id});let result=row.querySelector('.creative-job-content');if(!result){result=el('div',undefined,'creative-job-content');row.append(result);}result.replaceChildren();renderResult(result,v.result);}));dialog.append(row);}dialog.append(button('닫기',()=>{dialog.close();dialog.remove();}));document.body.append(dialog);dialog.showModal();});
$('back').onclick=()=>run(library);$('retry-save').onclick=()=>run(flush);$('reload').onclick=()=>run(async()=>{if(!confirm('현재 입력을 필요한 곳에 복사했나요? 서버에 저장된 버전을 불러옵니다.'))return;pending={};conflict=false;invalidFields.clear();await open(draft.id);});let searchTimer;for(const x of ['search','filter','sort'])$(x).oninput=()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>run(()=>loadList()),250);};$('more').onclick=()=>run(()=>loadList(true));$('category').onchange=()=>{paintCollections();saveLocation();};$('ep').oninput=saveLocation;
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty())flush().catch(fail);});
window.addEventListener('beforeunload',event=>{if(dirty()||saving){event.preventDefault();event.returnValue='';}});
const initial=new URL(location.href).searchParams.get('draft');run(()=>initial?open(initial):library());
})();
