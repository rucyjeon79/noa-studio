(() => {
 'use strict';
 const page=document.getElementById('noa-notification-page'),api='/noa-bridge/notifications.php',login='/bbs/login.php?url=%2Fnoa-notifications.php';
 let context={member:false};try{context=JSON.parse(document.getElementById('noa-notifications-context')?.textContent||'{}');}catch{}
 let autoOpened=false,threadOpening=false;
 let state=null,busy=false,before=null,loadedMore=false,preferencesLoaded=false,device='',refreshing=false;
 const $=id=>document.getElementById(id);
 const message=(text)=>{if(page)$('nnt-status').textContent=text;};
 const errors={login_required:'로그인 후 내 알림을 확인해 주세요.',not_ready:'알림 연결을 준비하고 있어요. 잠시 후 다시 열어주세요.',device_limit:'연결된 기기가 많아요. 기기 관리에서 기존 연결을 끈 뒤 다시 시도해 주세요.',device_not_registered:'먼저 이 기기의 알림을 켜주세요.',csrf_required:'로그인 상태가 바뀌었습니다. 새로고침 후 다시 시도해 주세요.',post_not_available:'삭제되었거나 현재 볼 수 없는 게시물입니다.'};
 async function request(body,query=''){
  const r=await fetch(api+query,{credentials:'same-origin',cache:'no-store',...(body?{method:'POST',headers:{'Content-Type':'application/json','X-NOA-CSRF':state?.csrf||''},body:JSON.stringify(body)}:{})});
  if(r.status===401)throw Error('login_required');
  let data;try{data=await r.json();}catch{throw Error(r.status===403?'csrf_required':'unavailable');}
  if(!r.ok||!data.ok)throw Error(data.error||'unavailable');return data;
 }
 function failure(error){message(errors[error.message]||'알림을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');if(error.message==='login_required'){context.member=false;state=null;updateBadges(0);if(page){$('nnt-content').hidden=true;$('nnt-login').hidden=false;}}}
 function updateBadges(count){document.querySelectorAll('[data-nnt-count]').forEach(el=>{el.textContent=count>99?'99+':String(count);el.hidden=count===0;el.setAttribute('aria-label',`읽지 않은 알림 ${count}개`);});if(page){$('nnt-unread').textContent=count;$('nnt-read-all').disabled=!count;}}
 function entry(description){
  const link=document.createElement('a');link.href='/noa-notifications.php';link.className='nnt-entry';
  // Reuse the shared NOA mail icon for the personal activity inbox.
  link.innerHTML='<svg class="nnt-entry-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18v14H3z M3 5l9 8 9-8"/></svg><span class="nnt-entry-copy"><span class="nnt-entry-title">내 활동 알림</span><span class="nnt-entry-description"></span></span>';
  link.querySelector('.nnt-entry-description').textContent=description;return link;
 }
 function mount(){
  const ainoa=document.getElementById('noa-ainoa'),body=ainoa?.querySelector('.ainoa-panel-body');
  if(body&&!body.querySelector('.nnt-entry')){
   const link=entry('좋아요·댓글·답글 소식을 확인하세요.');const badge=document.createElement('span');badge.className='nnt-badge';badge.dataset.nntCount='';badge.hidden=true;link.append(badge);const header=body.querySelector('header');if(header)header.after(link);else body.prepend(link);
   if(!ainoa.querySelector(':scope > .nnt-badge')){const outer=badge.cloneNode(true);ainoa.append(outer);}
   updateBadges(state?.unread||0);
  }
  const settings=$('noa-settings-controls');if(settings&&!$('nnt-settings-link')){const link=entry('알림함 확인 및 휴대폰 알림 설정');link.id='nnt-settings-link';link.classList.add('nnt-settings-link');settings.after(link);}
 }
 mount();new MutationObserver(mount).observe(document.body,{childList:true,subtree:true});
 function support(){
  if(/\bwv\b/.test(navigator.userAgent)||window.NoaAndroid)return '설치형 앱에서는 Chrome으로 noastudio.ai.kr/noa-notifications.php를 열어 알림을 켜주세요. 이 앱에서도 알림함은 확인할 수 있어요.';
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  if(ios&&!navigator.standalone&&!matchMedia('(display-mode: standalone)').matches)return 'Safari의 공유 메뉴에서 홈 화면에 추가한 뒤, 홈 화면의 NOA STUDIO를 열어 알림을 켜주세요.';
  if(!isSecureContext||!('Notification' in window)||!('serviceWorker' in navigator)||!('PushManager' in window))return '이 브라우저에서는 휴대폰 알림을 지원하지 않아요. 최신 Chrome 또는 홈 화면에 추가한 Safari에서 설정해 주세요.';
  return '';
 }
 async function hash(value){const a=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(a)].map(b=>b.toString(16).padStart(2,'0')).join('');}
 async function subscription(){const reg=await navigator.serviceWorker.getRegistration('/');return reg?await reg.pushManager.getSubscription():null;}
 async function deviceState(){
  if(!page||!state)return;device='';let warning=support(),sub=null;
  if(!warning){try{sub=await subscription();if(sub)device=await hash(sub.endpoint);}catch{warning='기기 연결을 확인하지 못했어요. 새로고침 후 다시 시도해 주세요.';}}
  const enabled=!!device&&state.devices.includes(device)&&Notification.permission==='granted';
  $('nnt-enable').hidden=enabled||!!warning;$('nnt-enable').disabled=busy||!state;$('nnt-disable').hidden=!enabled;$('nnt-test').hidden=!enabled;
  $('nnt-device-status').textContent=warning||(Notification.permission==='denied'?'브라우저에서 알림이 차단되어 있어요. 사이트 설정의 알림을 허용한 뒤 다시 연결해 주세요.':enabled?'이 기기로 AInoa의 알림을 받을 수 있어요.':'이 기기에서 나와 관련된 소식을 받아보세요.');
  if(!warning&&Notification.permission==='denied')$('nnt-enable').hidden=true;
  $('nnt-device-count').textContent=`이 계정에 연결된 기기 ${state.devices.length}개`;$('nnt-disable-all').disabled=!state.devices.length||busy;
 }
 function render(data,append=false){
  if(!page)return;$('nnt-content').hidden=false;$('nnt-login').hidden=true;
  if(!append)$('nnt-list').replaceChildren();
  for(const item of data.items){
   if(!Number.isSafeInteger(item.id)||!String(item.url).startsWith('/')||String(item.url).startsWith('//'))continue;
   if(document.getElementById('nnt-item-'+item.id))continue;
   const li=document.createElement('li'),a=document.createElement('a'),text=document.createElement('span'),date=document.createElement('time');a.className='nnt-item';a.dataset.read=String(item.read);a.id='nnt-item-'+item.id;a.href=item.url;text.textContent=item.text;date.dateTime=item.at;
   date.textContent=new Intl.DateTimeFormat('ko-KR',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(item.at));text.append(date);a.append(text);li.append(a);$('nnt-list').append(li);
   a.addEventListener('click',async e=>{if(e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();try{await openThread(item,a);}catch(error){failure(error);}});
  }
  $('nnt-empty').hidden=$('nnt-list').children.length>0;before=data.before;$('nnt-more').hidden=!data.more;updateBadges(data.unread);
  if(!preferencesLoaded){for(const [key,value] of Object.entries(data.preferences))$('nnt-preferences').elements[key].checked=value;preferencesLoaded=true;}
  const notice=new URLSearchParams(location.search).get('notice');if(notice){const el=$('nnt-item-'+notice);if(el){el.setAttribute('aria-current','true');if(!autoOpened){autoOpened=true;const item=data.items.find(x=>x.id===Number(notice));if(item)void openThread(item,el).catch(failure);}}}
 }
 async function openThread(item,trigger){
  if(threadOpening)return;threadOpening=true;
  try{
   const data=await request(null,'?thread='+encodeURIComponent(item.id));
   await request({action:'read',id:item.id});trigger.dataset.read='true';if(!item.read){item.read=true;state.unread=Math.max(0,state.unread-1);updateBadges(state.unread);}
   if(data.thread.test){message('테스트 알림을 확인했습니다.');return;}
   if(data.thread.private){await privateThread(data.thread.id,trigger);return;}
   if(!window.NoaEngagement?.open)throw Error('unavailable');
   await window.NoaEngagement.open(data.thread.target,trigger,{preview:true,replyTo:data.thread.replyTo});
  }finally{threadOpening=false;}
 }
 async function privateThread(id,trigger){
  const dialog=document.createElement('dialog');dialog.className='noa-comments';
  const heading=document.createElement('h2');heading.textContent='사연 신청 답변';const close=document.createElement('button');close.type='button';close.textContent='닫기';close.onclick=()=>dialog.close();const body=document.createElement('section'),note=document.createElement('p');note.setAttribute('role','status');dialog.append(heading,close,body,note);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();if(trigger.isConnected)trigger.focus();},{once:true});dialog.showModal();let token='';
  async function community(query,payload){const res=await fetch('/noa-bridge/community.php'+(query?'?'+new URLSearchParams(query):''),{credentials:'same-origin',cache:'no-store',...(payload?{method:'POST',headers:{'Content-Type':'application/json','X-NOA-CSRF':token},body:JSON.stringify(payload)}:{})});const d=await res.json();if(!res.ok||!d.ok)throw Error('작성자 계정과 글 비밀번호를 확인해 주세요.');return d;}
  function show(d){body.replaceChildren();heading.textContent=d.title||'사연 신청 답변';if(d.locked){const form=document.createElement('form'),label=document.createElement('label'),pass=document.createElement('input'),save=document.createElement('button');label.textContent='글 비밀번호';pass.type='password';pass.required=true;pass.autocomplete='current-password';label.append(pass);save.type='submit';save.textContent='답변 확인';form.append(label,save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{show(await community(null,{action:'unlock',id,password:pass.value}));note.textContent='';}catch(e){note.textContent=e.message;}finally{save.disabled=false;}};body.append(form);return;}
   if(d.author){const author=document.createElement('strong');author.textContent=d.author;body.append(author);}const post=document.createElement('p');post.textContent=d.body;body.append(post);for(const c of d.comments){const row=document.createElement('p');row.textContent=(c.author||'관리자')+' · '+c.body;body.append(row);}if(!d.canComment){note.textContent='비공개 사연 신청은 기존 정책에 따라 관리자만 답변할 수 있습니다.';return;}
   const form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('textarea'),save=document.createElement('button');label.textContent='답변';input.required=true;input.maxLength=5000;label.append(input);save.textContent='답변 등록';save.type='submit';form.append(label,save);let requestId=crypto.randomUUID();input.oninput=()=>requestId=crypto.randomUUID();form.onsubmit=async e=>{e.preventDefault();save.disabled=true;input.readOnly=true;try{show(await community(null,{action:'comment',id,body:input.value,requestId}));note.textContent='답변을 등록했습니다.';}catch(e){note.textContent=e.message;}finally{save.disabled=false;input.readOnly=false;}};body.append(form);
  }
  try{const list=await community({board:'song_request'});token=list.csrf;show(await community({action:'read',board:'song_request',id}));}catch(e){note.textContent=e.message;}
 }
 function speakActivity(data){
  const account=window.NoaVoice?.getAccount();if(!account?.member||!data.items)return;
  const key='noa-notice-seen:'+account.accountKey;let previous=0;try{previous=Number(sessionStorage.getItem(key)||0);}catch{}
  const fresh=data.items.filter(item=>!item.read&&item.id>previous).sort((a,b)=>a.id-b.id);
  if(previous){for(const item of fresh)window.NoaVoice.say(item.text,{key:'activity-'+item.id,href:item.url});}
  else if(data.unread)window.NoaVoice.say('아직 읽지 않은 내 활동 소식이 '+data.unread+'개 있어요. 함께 확인해 볼까요?',{key:'activity-summary',href:'/noa-notifications.php'});
  const latest=Math.max(previous,...data.items.map(item=>item.id));try{sessionStorage.setItem(key,String(latest));}catch{}
 }
 window.addEventListener('noa-voice-ready',()=>{if(state)speakActivity(state);});
 async function refresh({quiet=false,append=false}={}){
  if(refreshing||(!page&&!context.member))return;refreshing=true;
  try{const data=await request(null,append&&before?'?before='+before:'');state=data;context.member=true;if(!append)speakActivity(data);updateBadges(data.unread);if(page){if(!quiet||!loadedMore)render(data,append);await deviceState();if(!quiet)message('내 소식은 나에게만 보여요.');const test=data.testStatus;$('nnt-delivery').textContent=!device||test.device!==device?'':test.received?'테스트 알림 표시를 확인했어요.':test.accepted?'기기의 알림 서비스에 전달했어요. 기기에서 표시를 확인하고 있어요.':['pending','leased'].includes(test.state)?(test.age>60?'발송이 지연되어 자동 재시도 중입니다. 알림을 껐다 켤 필요는 없어요.':'테스트 알림을 발송하고 있어요. 연결이 지연되면 자동으로 재시도합니다.'):test.state==='failed'?'테스트 알림을 보내지 못했어요. 알림을 다시 연결해 주세요.':'';}}
  catch(error){if(!quiet||error.message==='login_required')failure(error);}finally{refreshing=false;}
 }
 function keyBytes(value){return Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(value.length/4)*4,'=')),c=>c.charCodeAt(0));}
 async function action(fn){if(busy)return;busy=true;page?.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(error){failure(error);}finally{busy=false;if(page){page.querySelectorAll('button').forEach(b=>b.disabled=false);await deviceState();updateBadges(state?.unread||0);}}}
 if(page){
  $('nnt-enable').addEventListener('click',()=>{
   if(!state||support())return;
   // Called directly in the user's click; never prompt on page load or polling.
   const permission=Notification.permission==='granted'?Promise.resolve('granted'):Notification.requestPermission();
   action(async()=>{if(await permission!=='granted'){await deviceState();message('알림을 허용하면 휴대폰으로 소식을 받을 수 있어요.');return;}
    await navigator.serviceWorker.register('/noa-sw.js',{scope:'/',updateViaCache:'none'});const reg=await navigator.serviceWorker.ready;let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(state.publicKey)});
    await request({action:'subscribe',subscription:sub.toJSON()});await refresh();message('휴대폰 알림을 켰어요. 테스트 알림으로 연결을 확인할 수 있어요.');
   });
  });
  $('nnt-disable').addEventListener('click',()=>action(async()=>{await request({action:'unsubscribe',device});const sub=await subscription();if(sub)await sub.unsubscribe();await refresh();message('이 기기 알림을 껐어요. 알림함에서는 계속 확인할 수 있어요.');}));
  $('nnt-disable-all').addEventListener('click',()=>action(async()=>{await request({action:'unsubscribe',all:true});if(!support()){const sub=await subscription();if(sub)await sub.unsubscribe();}await refresh();message('모든 기기의 휴대폰 알림을 껐어요.');}));
  $('nnt-test').addEventListener('click',()=>action(async()=>{const result=await request({action:'test',device});if(result.queued)$('nnt-delivery').textContent='테스트 알림 발송을 요청했어요. 잠시 후 전달 상태를 확인합니다.';else await refresh();message('테스트 알림은 이 기기에만 보냅니다.');}));
  $('nnt-preferences').addEventListener('submit',e=>{e.preventDefault();action(async()=>{const preferences=Object.fromEntries(['likes','comments','replies'].map(k=>[k,e.target.elements[k].checked]));await request({action:'preferences',preferences});state.preferences=preferences;message('받을 알림 종류를 저장했어요.');});});
  $('nnt-read-all').addEventListener('click',()=>action(async()=>{const ids=[...$('nnt-list').querySelectorAll('.nnt-item')].map(a=>Number(a.id.replace('nnt-item-','')));if(ids.length)await request({action:'read',id:Math.max(...ids),all:true});loadedMore=false;await refresh();message('도착한 알림을 모두 읽음으로 표시했어요.');}));
  $('nnt-more').addEventListener('click',()=>{loadedMore=true;refresh({append:true});});
 }
 // Explicit sign-out detaches this browser so a shared phone does not keep receiving.
 document.addEventListener('click',e=>{const link=e.target.closest('a[href]');if(!link||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!=='/bbs/logout.php'||support())return;
  e.preventDefault();const detach=async()=>{try{const sub=await subscription();if(sub){const id=await hash(sub.endpoint);if(state)await request({action:'unsubscribe',device:id}).catch(()=>{});await sub.unsubscribe();}}catch{}};Promise.race([detach(),new Promise(r=>setTimeout(r,2000))]).finally(()=>location.assign(url.href));
 });
 if(page||context.member)refresh();
 setInterval(()=>{if(!document.hidden&&(page||context.member)&&!busy)refresh({quiet:true});},60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refresh({quiet:true});});
})();
