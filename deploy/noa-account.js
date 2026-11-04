/* Shared brand/navigation header. Private account status belongs to MY. */
(()=>{'use strict';if(document.getElementById('noa-account-bar')||location.pathname.startsWith('/adm/'))return;
 const bar=document.createElement('header');bar.id='noa-account-bar';bar.setAttribute('aria-label','NOA STUDIO · 바로가기');
 const shortcuts=document.createElement('nav');shortcuts.className='noa-account-shortcuts';shortcuts.setAttribute('aria-label','바로가기');
 const utilities=document.createElement('nav');utilities.className='noa-account-utilities';utilities.setAttribute('aria-label','화면 바로가기');
 const link=(text,href)=>{const a=document.createElement('a');a.textContent=text;a.href=href;return a;};
 const brand=link('','/');brand.className='noa-account-brand';brand.setAttribute('aria-label','NOA STUDIO 홈');
 const mark=document.createElement('img');mark.src='/noa-assets/papa-logo.png';mark.alt='';mark.width=36;mark.height=36;mark.decoding='async';const name=document.createElement('span');name.textContent='NOA STUDIO';brand.append(mark,name);const navigation=document.createElement('div');navigation.className='noa-navigation-bar';navigation.append(utilities,shortcuts);bar.append(navigation);
 const control=(label,path,run)=>{const button=document.createElement('button');button.type='button';button.className='noa-account-shortcut';button.setAttribute('aria-label',label);button.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg><span>'+label+'</span>';button.onclick=run;return button;};
 function hasInternalPrevious(referrer,origin,length){try{return length>1&&new URL(referrer).origin===origin;}catch{return false;}}
 const back=control('이전','M15 6l-6 6 6 6',()=>{if(document.getElementById('noa-shell-view')||hasInternalPrevious(document.referrer,location.origin,history.length))history.back();else location.assign('/');});back.id='noa-nav-back';utilities.append(back);
 const top=control('맨 위','M6 14l6-6 6 6 M5 4h14',()=>{const view=document.getElementById('noa-shell-view')?.contentWindow||window;view.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});top.id='noa-nav-top';utilities.append(top);
 const info=document.createElement('div');info.id='noa-info-bar';info.setAttribute('aria-label','NOA STUDIO');
 const infoActions=document.createElement('nav');infoActions.className='noa-info-actions';infoActions.setAttribute('aria-label','앱 바로가기');info.append(brand,infoActions);bar.prepend(info);
 const install=link('','/noa-install.php');install.id='noa-nav-install';install.className='noa-account-shortcut';install.setAttribute('aria-label','앱 설치');install.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m-4-4 4 4 4-4M5 16v5h14v-5"/></svg><span>앱 설치</span>';infoActions.append(install);
 const all=link('전체 메뉴','/noa-sitemap.php');all.className='noa-account-shortcut';all.id='noa-nav-all';all.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>전체 메뉴</span>';if(location.pathname==='/noa-sitemap.php')all.setAttribute('aria-current','page');shortcuts.append(all);
 const account=link('','/bbs/login.php?url=%2Fnoa-my.php');account.className='noa-account-shortcut';account.id='noa-nav-account';
 const accountLabel=document.createElement('span');account.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 21v-2a6 6 0 0 0-12 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"/></svg>';account.append(accountLabel);shortcuts.append(account);
 function accountState(member){account.href=member?'/noa-my.php':'/bbs/login.php?url=%2Fnoa-my.php';accountLabel.textContent=member?'MY':'로그인';account.dataset.noaAccountNav=member?'user':'login';account.setAttribute('aria-label',member?'MY':'로그인');if(member&&location.pathname==='/noa-my.php')account.setAttribute('aria-current','page');else account.removeAttribute('aria-current');}
 let initialMember=false;try{initialMember=!!JSON.parse(document.getElementById('noa-access')?.textContent||'null')?.member;}catch{}accountState(initialMember);
 window.addEventListener('noa-membership-status',event=>accountState(!!event.detail?.member));
 // Share the public installation guide, never an account-specific URL.
 const installUrl='https://noastudio.ai.kr/noa-install.php',shareText='NOA STUDIO에서 노아의 음악을 만나보세요. 아래 링크에서 앱을 설치할 수 있어요.';
 const share=document.createElement('button');share.id='noa-nav-share';share.type='button';share.className='noa-account-shortcut';share.setAttribute('aria-label','공유하기');share.setAttribute('aria-haspopup','dialog');share.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9"/></svg><span>공유</span>';infoActions.append(share);
 share.onclick=()=>{
  if(document.getElementById('noa-share-dialog'))return;
  const dialog=document.createElement('dialog');dialog.id='noa-share-dialog';dialog.setAttribute('aria-labelledby','noa-share-title');
  dialog.innerHTML='<header><h2 id="noa-share-title">NOA STUDIO 공유</h2><button type="button" aria-label="공유 창 닫기">×</button></header><p>설치 링크를 보내 함께 음악을 즐겨요.</p><div class="noa-share-actions"><button type="button" data-share="copy">링크 복사</button><a data-share="sms">문자로 보내기</a><button type="button" data-share="kakao">카카오톡으로 공유</button></div><p class="noa-share-help">카톡 버튼을 누른 뒤 휴대폰 공유 목록에서 카카오톡을 선택해 주세요.</p><label for="noa-share-link">앱 설치 링크</label><input id="noa-share-link" readonly><p class="noa-share-status" role="status"></p>';
  const input=dialog.querySelector('input'),note=dialog.querySelector('.noa-share-status');input.value=installUrl;input.onclick=()=>input.select();dialog.querySelector('header button').onclick=()=>dialog.close();
  const tell=text=>{if(window.NoaVoice?.say){note.textContent='';window.NoaVoice.say(text,{key:'share-feedback',priority:true,force:true});}else note.textContent=text;};
  dialog.querySelector('[data-share="copy"]').onclick=async()=>{try{await navigator.clipboard.writeText(installUrl);tell('설치 링크를 복사했어요. 원하는 대화방에 붙여 넣어 주세요.');}catch{input.focus();input.select();tell('링크를 길게 눌러 복사해 주세요.');}};
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  dialog.querySelector('[data-share="sms"]').href='sms:'+(ios?'&':'?')+'body='+encodeURIComponent(shareText+'\n'+installUrl);
  const kakao=dialog.querySelector('[data-share="kakao"]');kakao.onclick=async()=>{
   if(!navigator.share){input.focus();input.select();tell('이 브라우저에서는 공유 목록을 열 수 없어요. 링크를 복사해 카카오톡 대화방에 붙여 넣어 주세요.');return;}
   try{kakao.disabled=true;await navigator.share({title:'NOA STUDIO · 앱 설치',text:shareText,url:installUrl});dialog.close();}catch(e){if(e.name!=='AbortError')tell('공유 목록을 열지 못했어요. 링크 복사로 전달해 주세요.');}finally{kakao.disabled=false;}
  };
  dialog.addEventListener('close',()=>{dialog.remove();share.focus();},{once:true});document.body.append(dialog);dialog.showModal();
 };
 document.querySelector('.noa-topbar .noa-account')?.closest('.noa-topbar').remove();document.querySelector('.noa-g5-top')?.remove();document.body.prepend(bar);
 // The invitation module arrives asynchronously. Move its real control, retaining
 // the member's existing invitation action and a visible label at every width.
 const attachInvitation=()=>{const invitation=bar.querySelector('#noa-referral-share');if(!invitation||invitation.parentElement===infoActions)return;invitation.classList.add('noa-account-shortcut');if(!invitation.querySelector('span')){const label=document.createElement('span');label.textContent='공유';invitation.append(label);}share.replaceWith(invitation);};
 attachInvitation();new MutationObserver(attachInvitation).observe(shortcuts,{childList:true});
 // Anchor links clear the actual one- or two-row header, including text zoom.
 if(window.ResizeObserver)new ResizeObserver(()=>document.documentElement.style.setProperty('--noa-header-height',Math.ceil(bar.getBoundingClientRect().height)+'px')).observe(bar);
 if(window.ResizeObserver)new ResizeObserver(()=>document.documentElement.style.setProperty('--noa-info-height',Math.ceil(info.getBoundingClientRect().height)+'px')).observe(info);
 // Time follows the visitor's device; the language picker shares the existing preference.
 const clock=document.createElement('time');clock.id='noa-header-clock';clock.innerHTML='<span></span><strong></strong>';
 const context=document.createElement('div');context.className='noa-info-context';info.insertBefore(context,infoActions);context.append(clock);
 const weather=control('내 위치 · 날씨','M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13z M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0',openWeather);weather.id='noa-header-weather';weather.setAttribute('aria-haspopup','dialog');context.append(weather);
 const compact=matchMedia('(max-width:760px), (hover:none) and (pointer:coarse) and (max-height:600px) and (max-width:1024px)');
 const languages={ko:'한국어',en:'English',ja:'日本語',th:'ไทย'};
 // Inline vectors work in browsers without a regional-indicator emoji font.
 const trigram=(x,y,angle,breaks)=>'<g transform="translate('+x+' '+y+') rotate('+angle+')" fill="#171717">'+[0,1,2].map((n)=>breaks[n]?'<path d="M-2.7 '+(n-1)+'h2.38v.64H-2.7zM.32 '+(n-1)+'H2.7v.64H.32z"/>':'<rect x="-2.7" y="'+(n-1)+'" width="5.4" height=".64"/>').join('')+'</g>';
 const flagArt={
 ko:'<path fill="#fff" d="M0 0h30v20H0z"/><g transform="translate(15 10) rotate(34)"><circle r="5" fill="#cd2e3a"/><path d="M-5 0a2.5 2.5 0 0 0 5 0a2.5 2.5 0 0 1 5 0a5 5 0 0 1-10 0" fill="#0047a0"/></g>'+trigram(6.2,4.2,-56,[0,0,0])+trigram(23.8,15.5,-56,[1,1,1])+trigram(23.8,4.2,56,[1,0,1])+trigram(6.2,15.5,56,[0,1,0]),
 ja:'<path fill="#fff" d="M0 0h30v20H0z"/><circle fill="#bc002d" cx="15" cy="10" r="6"/>',
 th:'<path fill="#a51931" d="M0 0h30v20H0z"/><path fill="#fff" d="M0 3.33h30v13.34H0z"/><path fill="#2d2a4a" d="M0 6.67h30v6.66H0z"/>',
 en:'<g transform="scale(.5 .666667)"><path fill="#012169" d="M0 0h60v30H0z"/><path d="m0 0 60 30m0-30L0 30" stroke="white" stroke-width="6"/><path fill="#c8102e" d="M0 0v2.24L25.5 15H30zM60 30v-2.24L34.5 15H30zM60 0h-4.47L30 12.76V15zM0 30h4.47L30 17.24V15z"/><path stroke="white" stroke-width="10" d="M30 0v30M0 15h60"/><path stroke="#c8102e" stroke-width="6" d="M30 0v30M0 15h60"/></g>'
 };
 const flag=code=>'<svg class="noa-lang-flag" data-flag="'+code+'" viewBox="0 0 30 20" aria-hidden="true" focusable="false">'+flagArt[code]+'</svg>';
 const picker=document.createElement('div');picker.className='noa-language-picker';
 const language=document.createElement('button');language.type='button';language.id='noa-header-language';language.setAttribute('aria-haspopup','dialog');language.setAttribute('aria-controls','noa-language-options');language.setAttribute('aria-expanded','false');language.disabled=true;
 const choices=document.createElement('div');choices.id='noa-language-options';choices.hidden=true;choices.setAttribute('role','dialog');choices.setAttribute('aria-label','언어 선택');
 let activeLanguage='ko';const buttons=[];
 function closeChoices(focus=false){choices.hidden=true;language.setAttribute('aria-expanded','false');if(focus)language.focus();}
 for(const code of Object.keys(languages)){const b=document.createElement('button');b.type='button';b.dataset.language=code;b.lang=code;b.setAttribute('translate','no');b.innerHTML=flag(code)+'<span>'+languages[code]+'</span>';b.onclick=()=>{window.NoaUI.setLanguage(code);closeChoices(true);};buttons.push(b);choices.append(b);}
 language.onclick=()=>{if(!choices.hidden){closeChoices(true);return;}choices.hidden=false;language.setAttribute('aria-expanded','true');buttons.find(b=>b.dataset.language===activeLanguage).focus();};
 picker.addEventListener('keydown',e=>{if(e.key==='Escape'&&!choices.hidden){e.preventDefault();e.stopPropagation();closeChoices(true);}else if(!choices.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const i=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowDown'?1:3))%4].focus();}});
 document.addEventListener('pointerdown',e=>{if(!choices.hidden&&!picker.contains(e.target))closeChoices();});picker.addEventListener('focusout',e=>{if(e.relatedTarget&&!picker.contains(e.relatedTarget))closeChoices();});
 picker.append(language,choices);infoActions.append(picker);
 const locale=()=>({ko:'ko-KR',ja:'ja-JP',en:'en-GB',th:'th-TH'}[activeLanguage]);
 let timeFmt,dateFmt,clockTimer;
 function tick(){if(compact.matches||document.hidden)return;const now=new Date();clock.dateTime=now.toISOString();const time=timeFmt.format(now),date=dateFmt.format(now);if(clock.firstChild.textContent!==date)clock.firstChild.textContent=date;if(clock.lastChild.textContent!==time)clock.lastChild.textContent=time;}
 function clockActivity(){clearInterval(clockTimer);if(!compact.matches&&!document.hidden){tick();clockTimer=setInterval(tick,1000);}}
 function syncLanguage(){const state=window.NoaUI?.getState();activeLanguage=Object.hasOwn(languages,state?.language)?state.language:'ko';language.disabled=!state;language.dataset.language=activeLanguage;language.setAttribute('aria-label',(window.NoaUI?.translate('언어 선택')||'언어 선택')+' · '+languages[activeLanguage]);language.innerHTML=flag(activeLanguage)+'<span lang="'+activeLanguage+'" translate="no">'+languages[activeLanguage]+'</span><i aria-hidden="true"></i>';for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.language===activeLanguage));timeFmt=new Intl.DateTimeFormat(locale(),{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});dateFmt=new Intl.DateTimeFormat(locale(),{year:'numeric',month:'2-digit',day:'2-digit',weekday:'short'});tick();}
 window.addEventListener('noa-theme',syncLanguage);syncLanguage();clockActivity();document.addEventListener('visibilitychange',clockActivity);
 let weatherData=null,weatherBusy=false,weatherRefresh=null;
 const readWeather=()=>{try{return JSON.parse(sessionStorage.getItem('noa-header-weather')||'null');}catch{return null;}};
 const weatherFresh=data=>data&&Number.isFinite(data.temperature)&&Date.parse(data.validUntil)>Date.now()&&Date.parse(data.forecastAt)>Date.now()-7200000;
 function paintWeather(){const label=weather.querySelector('span');if(weatherFresh(weatherData)){label.textContent=weatherData.location+' · '+Math.round(weatherData.temperature)+'° '+(window.NoaUI?.translate(weatherData.condition)||weatherData.condition);weather.title=weatherData.location+' 부근 · '+weatherData.condition+' · '+weatherData.temperature+'°C';}else{weatherData=null;label.textContent='내 위치 · 날씨';weather.removeAttribute('title');}weather.setAttribute('aria-label',label.textContent);}
 function openWeather(){let dialog=document.getElementById('noa-weather-dialog');if(dialog){dialog.showModal();return;}
  dialog=document.createElement('dialog');dialog.id='noa-weather-dialog';dialog.className='noa-header-dialog';dialog.setAttribute('aria-labelledby','noa-weather-title');dialog.innerHTML='<form method="dialog"><button class="noa-dialog-close" aria-label="날씨 닫기">×</button></form><h2 id="noa-weather-title">현재 위치의 날씨</h2><p class="noa-weather-summary"></p><p>위치를 허용하면 지금 머무는 지역의 날씨를 보여드려요. 약 1km 단위의 대략적인 위치만 지역명과 날씨 조회에 사용합니다.</p><button type="button" class="noa-button" data-weather-locate>내 위치로 날씨 보기</button><p role="status" data-weather-status></p><small>날씨: <a href="https://api.met.no/" target="_blank" rel="noopener noreferrer">MET Norway</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a><br>지역명: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap 기여자</a><br>현재 시각에 가까운 예보를 요약해 표시합니다.</small>';
  dialog.querySelector('[data-weather-locate]').onclick=()=>locateWeather();dialog.addEventListener('close',()=>{dialog.remove();weather.focus();},{once:true});document.body.append(dialog);updateWeatherDialog();dialog.showModal();
 }
 function updateWeatherDialog(message=''){const dialog=document.getElementById('noa-weather-dialog');if(!dialog)return;const summary=dialog.querySelector('.noa-weather-summary');summary.textContent=weatherFresh(weatherData)?weatherData.location+' · '+weatherData.condition+' · '+weatherData.temperature+'°C':'';summary.hidden=!summary.textContent;dialog.querySelector('[data-weather-status]').textContent=message;dialog.querySelector('[data-weather-locate]').disabled=weatherBusy;}
 async function locateWeather(){if(compact.matches||weatherBusy)return;if(!navigator.geolocation){updateWeatherDialog('이 브라우저에서는 위치를 확인할 수 없어요.');return;}
  weatherBusy=true;weather.setAttribute('aria-busy','true');updateWeatherDialog('현재 위치와 날씨를 확인하고 있어요.');
  try{
   const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:false,timeout:12000,maximumAge:300000}));
   // Exact coordinates stay in the browser; neither addresses nor coordinates are stored in an account.
   const coordinates={latitude:Math.round(position.coords.latitude*100)/100,longitude:Math.round(position.coords.longitude*100)/100};
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),18000);let response,data;
   try{response=await fetch('/noa-bridge/weather.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(coordinates),signal:controller.signal});data=await response.json();}finally{clearTimeout(timeout);}
   if(!response.ok||!data.ok||!weatherFresh(data))throw Error('weather_unavailable');weatherData=data;try{sessionStorage.setItem('noa-header-weather',JSON.stringify(data));localStorage.setItem('noa-weather-enabled','1');}catch{}
   paintWeather();updateWeatherDialog('현재 위치의 날씨를 확인했어요.');
  }catch(error){weatherData=null;try{sessionStorage.removeItem('noa-header-weather');}catch{}paintWeather();const denied=error.code===1;updateWeatherDialog(denied?'위치 사용이 꺼져 있어요. 브라우저의 사이트 설정에서 위치를 허용해 주세요.':'지금은 날씨를 확인하지 못했어요. 잠시 후 다시 눌러 주세요.');}
  finally{weatherBusy=false;weather.removeAttribute('aria-busy');const button=document.querySelector('[data-weather-locate]');if(button)button.disabled=false;scheduleWeather();}
 }
 function scheduleWeather(){clearTimeout(weatherRefresh);if(compact.matches)return;weatherRefresh=setTimeout(async()=>{paintWeather();if(document.hidden)return;try{if(localStorage.getItem('noa-weather-enabled')==='1'&&(await navigator.permissions.query({name:'geolocation'})).state==='granted')locateWeather();}catch{}},weatherData?Math.max(60000,Date.parse(weatherData.validUntil)-Date.now()):900000);}
 weatherData=readWeather();paintWeather();scheduleWeather();window.addEventListener('noa-theme',paintWeather);
 async function resumeWeather(){if(compact.matches)return;paintWeather();try{if(!weatherData&&localStorage.getItem('noa-weather-enabled')==='1'&&(await navigator.permissions.query({name:'geolocation'})).state==='granted')locateWeather();}catch{}}
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)resumeWeather();});compact.addEventListener('change',()=>{clockActivity();scheduleWeather();if(compact.matches)document.getElementById('noa-weather-dialog')?.close();else resumeWeather();});resumeWeather();

 const summary=document.getElementById('noa-my-account'),status=document.getElementById('noa-my-account-status');
 const write=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value;};
 let pending=false,lastAttempt=0,retries=0,retryTimer=null,hasResult=false;
 const retry=document.createElement('button');retry.type='button';retry.className='noa-button';retry.textContent='다시 확인';retry.onclick=()=>{retries=0;update(true);};
 const report=(text,canRetry=false)=>{if(status){status.replaceChildren(document.createTextNode(text+' '));if(canRetry)status.append(retry);}};
 async function update(force=false){
  if(pending||(!force&&Date.now()-lastAttempt<30000))return;
  clearTimeout(retryTimer);pending=true;retry.disabled=true;lastAttempt=Date.now();
  if(summary){summary.dataset.state='loading';summary.setAttribute('aria-busy','true');report(hasResult?'계정 정보를 갱신하고 있습니다.':'계정 정보를 확인하고 있습니다.');}
  const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),15000);
  try{
   const r=await fetch('/noa-bridge/membership.php?action=summary',{credentials:'same-origin',cache:'no-store',signal:abort.signal}),d=await r.json();
   if(!r.ok||d.ok!==true||typeof d.member!=='boolean'||(d.member&&(!Number.isSafeInteger(d.balance)||!Number.isFinite(d.remainingDays))))throw Error('account_unavailable');
   bar.dataset.member=String(d.member);window.dispatchEvent(new CustomEvent('noa-membership-status',{detail:d}));
   retries=0;hasResult=true;
   if(summary){
    if(!d.member){summary.dataset.state='signed-out';write('noa-my-subscription','로그인이 필요합니다.');write('noa-my-points','—');if(status)status.replaceChildren(link('다시 로그인','/bbs/login.php?url=%2Fnoa-my.php'));return;}
    const active=d.grant?.status==='active'&&d.remainingDays>0;
    write('noa-my-subscription',active?'구독 중 · '+d.remainingDays+'일 남음':(d.admin?'관리자 이용 권한 · 유료 구독 없음':'구독 없음'));
    write('noa-my-points',d.balance.toLocaleString('ko-KR')+'P');summary.dataset.state='ready';report('');
   }
  }catch{
   if(summary){
    if(!hasResult){write('noa-my-subscription','확인 불가');write('noa-my-points','확인 불가');}
    if(retries<1&&navigator.onLine!==false){retries++;summary.dataset.state='retrying';report('연결이 지연되어 잠시 후 다시 확인합니다.',true);retryTimer=setTimeout(()=>update(true),1200);}
    else{summary.dataset.state='error';report(hasResult?'최신 정보를 확인하지 못했습니다. 이전 조회값입니다.':'계정 정보를 확인하지 못했습니다. 다시 확인을 눌러 주세요.',true);window.dispatchEvent(new Event('noa-membership-error'));}
   }else window.dispatchEvent(new Event('noa-membership-error'));
  }finally{clearTimeout(timeout);pending=false;retry.disabled=false;if(summary)summary.setAttribute('aria-busy','false');}
 }
 update();window.addEventListener('pageshow',()=>update());window.addEventListener('noa-membership-change',()=>{retries=0;update(true);});document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});window.addEventListener('online',()=>{retries=0;update(true);});
})();
