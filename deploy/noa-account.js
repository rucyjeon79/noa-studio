/* Shared brand/navigation header. Private account status belongs to MY. */
(()=>{'use strict';if(document.getElementById('noa-account-bar')||location.pathname.startsWith('/adm/'))return;
 const bar=document.createElement('header');bar.id='noa-account-bar';bar.setAttribute('aria-label','NOA STUDIO · 바로가기');
 const shortcuts=document.createElement('nav');shortcuts.className='noa-account-shortcuts';shortcuts.setAttribute('aria-label','바로가기');
 const link=(text,href)=>{const a=document.createElement('a');a.textContent=text;a.href=href;return a;};
 const brand=link('','/');brand.className='noa-account-brand';brand.setAttribute('aria-label','NOA STUDIO 홈');
 const mark=document.createElement('img');mark.src='/noa-assets/papa-logo.png';mark.alt='';mark.width=36;mark.height=36;mark.decoding='async';const name=document.createElement('span');name.textContent='NOA STUDIO';brand.append(mark,name);bar.append(brand,shortcuts);
 for(const [label,href,path]of [['홈으로','/','M3 10l9-7 9 7v10H3z M9 21v-8h6v8'],['사이트맵','/noa-sitemap.php','M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4'],['앱 설치','/noa-install.php','M12 3v12 M7 10l5 5 5-5 M5 16v5h14v-5']]){
  const a=link('',href),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),shape=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');shape.setAttribute('d',path);svg.append(shape);const text=document.createElement('span');text.textContent=label;a.append(svg,text);a.className='noa-account-shortcut';if(location.pathname===href||(href==='/'&&location.pathname==='/index.php'))a.setAttribute('aria-current','page');shortcuts.append(a);
 }
 // Share the public installation guide, never an account-specific URL.
 const installUrl='https://noastudio.ai.kr/noa-install.php',shareText='NOA STUDIO에서 노아의 음악을 만나보세요. 아래 링크에서 앱을 설치할 수 있어요.';
 const share=document.createElement('button');share.type='button';share.className='noa-account-shortcut';share.setAttribute('aria-label','공유하기');share.setAttribute('aria-haspopup','dialog');share.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V3m-4 4 4-4 4 4M5 12v9h14v-9"/></svg><span>공유</span>';shortcuts.append(share);
 share.onclick=()=>{
  if(document.getElementById('noa-share-dialog'))return;
  const dialog=document.createElement('dialog');dialog.id='noa-share-dialog';dialog.setAttribute('aria-labelledby','noa-share-title');
  dialog.innerHTML='<header><h2 id="noa-share-title">NOA STUDIO 공유</h2><button type="button" aria-label="공유 창 닫기">×</button></header><p>설치 링크를 보내 함께 음악을 즐겨요.</p><div class="noa-share-actions"><button type="button" data-share="copy">링크 복사</button><a data-share="sms">문자로 보내기</a><button type="button" data-share="kakao">카카오톡으로 공유</button></div><p class="noa-share-help">카톡 버튼을 누른 뒤 휴대폰 공유 목록에서 카카오톡을 선택해 주세요.</p><label for="noa-share-link">앱 설치 링크</label><input id="noa-share-link" readonly><p class="noa-share-status" role="status"></p>';
  const input=dialog.querySelector('input'),note=dialog.querySelector('.noa-share-status');input.value=installUrl;input.onclick=()=>input.select();dialog.querySelector('header button').onclick=()=>dialog.close();
  const tell=text=>{if(window.NoaVoice?.say){note.textContent='';window.NoaVoice.say(text,{key:'share-feedback',priority:true});}else note.textContent=text;};
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
 let pending=false;
 async function update(){if(pending)return;pending=true;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);try{
  const r=await fetch('/noa-bridge/membership.php',{credentials:'same-origin',cache:'no-store',signal:abort.signal}),d=await r.json();if(!r.ok||!d.ok)throw Error('account_unavailable');
  bar.dataset.member=String(!!d.member);window.dispatchEvent(new CustomEvent('noa-membership-status',{detail:d}));
  if(summary){
   if(!d.member){summary.dataset.state='signed-out';write('noa-my-subscription','로그인이 필요합니다.');write('noa-my-points','—');if(status)status.replaceChildren(link('다시 로그인','/bbs/login.php?url=%2Fnoa-my.php'));return;}
   const active=d.grant?.status==='active'&&Number(d.remainingDays)>0;
   write('noa-my-subscription',active?'구독 중 · '+Number(d.remainingDays)+'일 남음':'구독 없음');
   write('noa-my-points',Number(d.balance).toLocaleString('ko-KR')+'P');summary.dataset.state='ready';if(status)status.textContent='';
  }
 }catch{if(summary){summary.dataset.state='error';if(status)status.textContent='현재 계정 정보를 불러오지 못했습니다. 구독·포인트 내역에서 다시 확인해 주세요.';}}
 finally{clearTimeout(timeout);pending=false;}}
 update();window.addEventListener('pageshow',update);window.addEventListener('noa-membership-change',update);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
