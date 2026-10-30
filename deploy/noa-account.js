/* Shared brand/navigation header. Private account status belongs to MY. */
(()=>{'use strict';if(document.getElementById('noa-account-bar')||location.pathname.startsWith('/adm/'))return;
 const bar=document.createElement('header');bar.id='noa-account-bar';bar.setAttribute('aria-label','NOA STUDIO · 바로가기');
 const shortcuts=document.createElement('nav');shortcuts.className='noa-account-shortcuts';shortcuts.setAttribute('aria-label','바로가기');
 const link=(text,href)=>{const a=document.createElement('a');a.textContent=text;a.href=href;return a;};
 const brand=link('','/');brand.className='noa-account-brand';brand.setAttribute('aria-label','NOA STUDIO 홈');
 const mark=document.createElement('img');mark.src='/noa-assets/papa-logo.png';mark.alt='';mark.width=36;mark.height=36;mark.decoding='async';const name=document.createElement('span');name.textContent='NOA STUDIO';brand.append(mark,name);bar.append(brand,shortcuts);
 const control=(label,path,run)=>{const button=document.createElement('button');button.type='button';button.className='noa-account-shortcut';button.setAttribute('aria-label',label);button.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="'+path+'"/></svg><span>'+label+'</span>';button.onclick=run;return button;};
 function hasInternalPrevious(referrer,origin,length){try{return length>1&&new URL(referrer).origin===origin;}catch{return false;}}
 const back=control('이전','M15 6l-6 6 6 6',()=>{if(hasInternalPrevious(document.referrer,location.origin,history.length))history.back();else location.assign('/');});back.id='noa-nav-back';bar.prepend(back);
 const top=control('맨 위','M6 14l6-6 6 6 M5 4h14',()=>{window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});top.id='noa-nav-top';shortcuts.append(top);
 const all=link('전체 메뉴','/noa-sitemap.php');all.className='noa-account-shortcut';all.id='noa-nav-all';all.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg><span>전체 메뉴</span>';if(location.pathname==='/noa-sitemap.php')all.setAttribute('aria-current','page');shortcuts.append(all);
 const account=link('','/bbs/login.php?url=%2Fnoa-my.php');account.className='noa-account-shortcut';account.id='noa-nav-account';
 const accountLabel=document.createElement('span');account.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M20 21v-2a6 6 0 0 0-12 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0"/></svg>';account.append(accountLabel);shortcuts.append(account);
 function accountState(member){account.href=member?'/noa-my.php':'/bbs/login.php?url=%2Fnoa-my.php';accountLabel.textContent=member?'MY':'로그인';account.dataset.noaAccountNav=member?'user':'login';account.setAttribute('aria-label',member?'MY':'로그인');if(member&&location.pathname==='/noa-my.php')account.setAttribute('aria-current','page');else account.removeAttribute('aria-current');}
 let initialMember=false;try{initialMember=!!JSON.parse(document.getElementById('noa-access')?.textContent||'null')?.member;}catch{}accountState(initialMember);
 window.addEventListener('noa-membership-status',event=>accountState(!!event.detail?.member));
 // Share the public installation guide, never an account-specific URL.
 const installUrl='https://noastudio.ai.kr/noa-install.php',shareText='NOA STUDIO에서 노아의 음악을 만나보세요. 아래 링크에서 앱을 설치할 수 있어요.';
 const share=document.createElement('button');share.type='button';share.className='noa-account-shortcut';share.setAttribute('aria-label','공유하기');share.setAttribute('aria-haspopup','dialog');share.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9"/></svg><span>공유</span>';if(location.pathname==='/noa-install.php')shortcuts.append(share);
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
