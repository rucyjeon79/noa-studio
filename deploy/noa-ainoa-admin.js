/* Highest-administrator workspace. Authentication and all authorization live on the server. */
(()=>{'use strict';if(window.NoaAInoaAdmin)return;
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
const button=(text,fn)=>{const n=el('button',text);n.type='button';n.onclick=fn;return n;};
let dialog,client,dockHost=null,state={tasks:[],generation:{ready:false,missing:['settings_unavailable']}},busy=false,thread='',retry=null,timer=null,activeTrack=null,generationRetry=null;
const names={api_key:'서비스 연결 키',text_enabled:'AI 활성화',per_request_budget:'요청 한도',daily_budget:'일일 한도',daily_budget_exhausted:'오늘 잔여 한도',model:'모델',settings_unavailable:'설정 연결'};
const states={queued:'대기',running:'작성 중',succeeded:'응답 완료',review:'초안 검토',failed:'오류',needs_review:'응답 확인 필요',cancelled:'취소'};
const fields={youtubeTitle:'YouTube 제목',description:'YouTube 설명',communityPost:'커뮤니티 글'};
const errors={ai_result_unconfirmed:'응답을 확정하지 못했습니다. 이 요청은 자동 재실행하지 않습니다.',ai_revision_changed:'곡 정보가 바뀌어 생성을 중단했습니다. 최신 곡 정보로 다시 요청하세요.',ai_provider_auth:'OpenAI 인증을 확인하세요.',ai_budget_exceeded:'AI 사용 한도에 도달했습니다.',ai_not_configured:'AI 연결 설정이 필요합니다.',ai_provider_rate_limit:'OpenAI 요청 한도에 도달했습니다.',ai_provider_unavailable:'AI 제공자 응답에 오류가 있습니다.'};
const $=s=>dialog.querySelector(s);
async function workspace(){const c=new AbortController(),t=setTimeout(()=>c.abort(),12000);try{const r=await fetch('/noa-ainoa.php?action=admin_workspace',{credentials:'same-origin',cache:'no-store',signal:c.signal});const d=await r.json();if(!r.ok||!d.ok)throw Error(r.status===403?'최고관리자로 다시 로그인해 주세요.':'대화 기록을 불러오지 못했습니다.');return d;}finally{clearTimeout(t);}}
function notice(text){$('.ainoa-admin-notice').textContent=text;}
function connection(){const g=state.generation;$('.ainoa-admin-connection').textContent=g.ready?'OpenAI 연결 · '+g.model+' · 요청 가능':'연결 설정 필요 · '+g.missing.map(k=>names[k]||k).join(' · ');}
function selection(){activeTrack=client.current();$('.ainoa-admin-context').hidden=!activeTrack;$('.ainoa-admin-song-label').textContent=activeTrack?'선택한 곡 포함 · '+activeTrack.title:'선택된 곡 없음';$('.ainoa-admin-song').disabled=!activeTrack;$('.ainoa-admin-generate').disabled=busy||!activeTrack;}
function render(){
 connection();selection();const tasks=state.tasks||[],threads=[...new Map(tasks.filter(t=>t.type==='chat').map(t=>[t.conversationId,t])).values()];
 const choose=$('.ainoa-admin-threads');choose.disabled=busy||!!retry;choose.replaceChildren();const fresh=el('option',threads.length?'이전 대화 선택':'이전 대화 없음');choose.disabled=choose.disabled||!threads.length;fresh.value='';choose.append(fresh);for(const t of threads){const o=el('option',t.title);o.value=t.conversationId;choose.append(o);}choose.value=threads.some(t=>t.conversationId===thread)?thread:'';
 const log=$('.ainoa-admin-log');log.replaceChildren();const history=tasks.filter(t=>t.type==='chat'&&t.conversationId===thread).reverse();
 for(const t of history){const turn=el('article',undefined,'ainoa-admin-turn');turn.append(el('strong','나'),el('p',t.question),el('strong','AInoa · '+states[t.state]));if(t.result)turn.append(el('p',t.result));else turn.append(el('p',errors[t.error]||((t.state==='queued'&&!state.generation.ready)?'요청은 저장됐습니다. AI 연결 설정 후 처리합니다.':states[t.state])));turn.append(el('small',new Date(t.createdAt).toLocaleString()));log.append(turn);}
 if(!history.length)log.append(el('p','가사나 곡 소개, 채널 운영에 관해 물어보세요.','noa-muted'));
 const pending=history.some(t=>['queued','running'].includes(t.state));$('.ainoa-admin-send').disabled=busy||pending;$('.ainoa-admin-input').readOnly=busy||!!retry;$('.ainoa-admin-new').disabled=busy;
 const list=$('.ainoa-admin-jobs');list.replaceChildren();for(const t of tasks.slice(0,30)){
  const item=el('details',undefined,'ainoa-admin-job');item.append(el('summary',(t.type==='chat'?'대화':fields[t.field]||'AI 생성')+' · '+t.title+' · '+states[t.state]));
  item.append(el('p',t.stage),el('small','작업 '+t.id.slice(-12)+' · '+new Date(t.updatedAt).toLocaleString()));
  if(t.error)item.append(el('p',errors[t.error]||'처리하지 못했습니다. 연결 설정과 요청 내용을 확인하세요.','ainoa-admin-error'));
  if(t.result){const text=el('textarea');text.value=t.result;text.readOnly=true;text.rows=5;text.setAttribute('aria-label','N80 AI 생성 결과');item.append(text,button('초안 복사',async()=>{try{await navigator.clipboard.writeText(t.result);notice('초안을 복사했습니다. 곡 편집 화면에서 검토 후 저장하세요.');}catch{notice('복사 권한이 없습니다. 결과 입력칸에서 텍스트를 선택해 복사하세요.');}}));}
  if(t.state==='queued')item.append(button('대기 취소',async()=>{try{await client.api({action:'admin_cancel',taskId:t.id,expectedRevision:t.revision});await refresh();notice('대기 요청을 취소했습니다.');}catch(e){notice(e.message);}}));list.append(item);
 }
 if(!tasks.length)list.append(el('p','등록된 AI 작업이 없습니다.'));$('.ainoa-admin-job-count').textContent='최근 N80 Auto 작업 · '+tasks.length;
}
async function refresh(){state=await N80Runtime.read('admin:workspace',workspace);render();N80Runtime.wake();}
async function run(task){if(task.state!=='queued')return;if(!state.generation.ready){notice('요청을 보관했습니다. AI 연결 설정 후 자동으로 처리합니다.');return;}notice('N80 AI가 초안을 작성하고 있습니다.');const result=await client.api({action:'admin_run',taskId:task.id});state.generation=result.generation;notice(result.task.result?'응답을 보관했습니다.':errors[result.task.error]||states[result.task.state]);}
async function send(e){e.preventDefault();if(busy)return;const text=$('.ainoa-admin-input').value.trim();if(!text)return;busy=true;render();
 try{
  if(!retry)retry={action:'admin_chat',requestId:crypto.randomUUID(),conversationId:thread||(thread=crypto.randomUUID()),question:text,trackKey:$('.ainoa-admin-song').checked&&activeTrack?activeTrack.key:''};
  notice('N80 Auto에 요청을 등록하고 있습니다.');const result=await client.api(retry);retry=null;$('.ainoa-admin-input').value='';await refresh();await run(result.task);await refresh();
 }catch(e){notice(e.message+(retry?' 입력은 유지됩니다. 다시 보내면 같은 요청으로 확인합니다.':''));}
 finally{busy=false;render();$('.ainoa-admin-log').scrollTop=$('.ainoa-admin-log').scrollHeight;}
}
async function generate(){if(busy||!activeTrack)return;busy=true;render();
 try{const selector={type:'song',source:'music',key:activeTrack.key},r=await fetch('/noa-inline-edit.php?'+new URLSearchParams(selector),{credentials:'same-origin',cache:'no-store'}),d=await r.json();if(!r.ok||!d.ok)throw Error('선택한 곡의 최신 정보를 읽지 못했습니다.');const input={action:'admin_generate',selector,expectedRevision:d.revision,field:$('.ainoa-admin-field').value,fields:{}};const signature=JSON.stringify(input);if(!generationRetry||generationRetry.signature!==signature)generationRetry={signature,body:{...input,requestId:crypto.randomUUID()}};const result=await client.api(generationRetry.body);generationRetry=null;notice('초안 생성 작업을 등록했습니다. 기존 곡 정보는 유지됩니다.');await refresh();await run(result.task);await refresh();}
 catch(e){notice(e.message);}finally{busy=false;render();}
}
function build(){
 dialog=el('dialog',undefined,'ainoa-admin-dialog');dialog.id='ainoa-admin-dialog';dialog.setAttribute('aria-labelledby','ainoa-admin-title');
 const head=el('header'),heading=el('div'),title=el('h2','제작 도우미');title.id='ainoa-admin-title';heading.append(el('small','ChatGPT · N80 AI','ainoa-admin-brand'),title);head.append(heading,button('닫기',()=>dialog.close()));
 const status=el('p','연결 상태 확인 중','ainoa-admin-connection'),settings=el('a','AI 연결 설정');settings.href='/noa-ai-lab.php?tool=settings';
 const connections=el('details');connections.append(el('summary','AI 연결 설정'),status,settings);
 const subscription=el('details',undefined,'ainoa-admin-subscription');subscription.append(el('summary','ChatGPT 구독 한도 연결'),el('p','현재 대화는 별도로 연결한 OpenAI 서비스를 사용합니다. ChatGPT 구독 한도 연결은 온라인 앱 연결 승인 후 별도로 연결해야 하며, 현재 연결되지 않았습니다.'));const official=el('a','공식 연결 안내');official.href='https://developers.openai.com/siwc/quickstart';official.target='_blank';official.rel='noopener noreferrer';subscription.append(official);
 const toolbar=el('div',undefined,'ainoa-admin-toolbar'),threads=el('select',undefined,'ainoa-admin-threads');threads.setAttribute('aria-label','이전 대화');threads.onchange=()=>{thread=threads.value;retry=null;$('.ainoa-admin-input').value='';render();};const fresh=button('새 대화',()=>{thread=crypto.randomUUID();retry=null;$('.ainoa-admin-input').value='';render();});fresh.className='ainoa-admin-new';toolbar.append(threads,fresh,button('새로고침',()=>refresh().catch(e=>notice(e.message))));
 const note=el('p','','ainoa-admin-notice');note.setAttribute('role','status');const log=el('section',undefined,'ainoa-admin-log');log.setAttribute('aria-label','관리자 대화 기록');log.setAttribute('role','log');
 const form=el('form'),input=el('textarea',undefined,'ainoa-admin-input');input.rows=3;input.maxLength=4000;input.required=true;input.placeholder='메시지를 입력하세요';input.setAttribute('aria-label','관리자 ChatGPT 질문');const sendButton=el('button','보내기','ainoa-admin-send');sendButton.type='submit';
 const label=el('label',undefined,'ainoa-admin-context'),check=el('input',undefined,'ainoa-admin-song');check.type='checkbox';check.checked=true;label.append(check,el('span','','ainoa-admin-song-label'));const caption=el('label','메시지','ainoa-admin-caption');input.id='ainoa-admin-message';caption.htmlFor=input.id;form.append(label,caption,input,sendButton);form.onsubmit=send;
 const automation=el('details',undefined,'ainoa-admin-automation');automation.append(el('summary','선택한 곡으로 초안 만들기'));const row=el('div',undefined,'ainoa-admin-toolbar'),field=el('select',undefined,'ainoa-admin-field');field.setAttribute('aria-label','AI 생성 항목');for(const [v,label]of Object.entries(fields)){const o=el('option',label);o.value=v;field.append(o);}const generateButton=button('초안 자동 생성',generate);generateButton.className='ainoa-admin-generate';row.append(field,generateButton);automation.append(row,el('p','N80 Auto가 요청을 순서대로 처리하고 N80 AI가 작성한 초안을 보관합니다. 결과를 검토한 뒤 곡 편집 화면에서 저장하세요.'));
 const jobs=el('details');jobs.append(el('summary','N80 Auto 작업 기록','ainoa-admin-job-count'),el('div',undefined,'ainoa-admin-jobs'));const n80=el('a','N80 Engine 운영 상태');n80.href='/noa-work-status.php';
 connections.append(subscription);const body=el('div',undefined,'ainoa-admin-body');body.append(toolbar,log,form,note,automation,jobs,connections,n80);dialog.append(head,body);document.body.append(dialog);
 dialog.addEventListener('close',()=>{if(dialog.open)return;timer?.();timer=null;window.dispatchEvent(new Event('noa-ainoa-admin-close'));});
}
function present(){const focused=document.activeElement;if(dialog.open)dialog.close();(dockHost||document.body).append(dialog);dialog.querySelector('header button').textContent=dockHost?'음악 찾기':'닫기';dialog.querySelector('h2').textContent=dockHost?'AInoa 대화':'제작 도우미';if(dockHost)dialog.show();else dialog.showModal();if(focused&&dialog.contains(focused))focused.focus({preventScroll:true});}
window.NoaAInoaAdmin={dock(host){dockHost=host;if(dialog?.open)present();},async open(c,host=null){if(!window.N80Runtime)await import('/noa-app/engine/runtime.js?v=20261107-runtime');client=c;dockHost=host;if(!dialog)build();present();notice('대화와 작업 기록을 불러오고 있습니다.');try{state=await workspace();if(!thread)thread=state.tasks.find(t=>t.type==='chat')?.conversationId||crypto.randomUUID();render();notice('');if(dialog.open&&!timer)timer=N80Runtime.watch('admin:poll',refresh,()=>{},{interval:5000,immediate:false,active:()=>dialog.open&&!busy&&state.tasks.some(t=>['queued','running'].includes(t.state)),error:e=>notice(e.message)});}catch(e){notice(e.message);}}};
})();
