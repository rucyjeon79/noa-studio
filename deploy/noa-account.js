/* The account control occupies its own sticky row; no overlay on native confirmation buttons. */
(()=>{'use strict';if(document.getElementById('noa-account-bar')||location.pathname.startsWith('/adm/'))return;
 const bar=document.createElement('header');bar.id='noa-account-bar';bar.setAttribute('aria-label','NOA STUDIO · 바로가기 · 계정');
 const shortcuts=document.createElement('nav');shortcuts.className='noa-account-shortcuts';shortcuts.setAttribute('aria-label','바로가기');
 const content=document.createElement('nav');content.className='noa-account-status';content.setAttribute('aria-label','내 계정');bar.append(shortcuts,content);
 const link=(text,href)=>{const a=document.createElement('a');a.textContent=text;a.href=href;return a;};
 const brand=link('','/');brand.className='noa-account-brand';brand.setAttribute('aria-label','NOA STUDIO 홈');
 const mark=document.createElement('img');mark.src='/noa-assets/papa-logo.png';mark.alt='';mark.width=36;mark.height=36;mark.decoding='async';brand.append(mark);shortcuts.append(brand);
 for(const [label,href,path]of [['홈으로','/','M3 10l9-7 9 7v10H3z M9 21v-8h6v8'],['사이트맵','/noa-sitemap.php','M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4']]){
  const a=link('',href),svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),shape=document.createElementNS(svg.namespaceURI,'path');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');svg.setAttribute('aria-hidden','true');shape.setAttribute('d',path);svg.append(shape);const text=document.createElement('span');text.textContent=label;a.append(svg,text);a.className='noa-account-shortcut';if(location.pathname===href||(href==='/'&&location.pathname==='/index.php'))a.setAttribute('aria-current','page');shortcuts.append(a);
 }
 let signature='';
 const login=()=>{signature='';delete bar.dataset.member;content.replaceChildren(link('로그인','/bbs/login.php?url='+encodeURIComponent(location.pathname+location.search)));};login();document.querySelector('.noa-topbar .noa-account')?.closest('.noa-topbar').remove();document.querySelector('.noa-g5-top')?.remove();document.body.prepend(bar);
 let pending=false;
 async function update(){if(pending)return;pending=true;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);try{
  const r=await fetch('/noa-bridge/membership.php',{credentials:'same-origin',cache:'no-store',signal:abort.signal}),d=await r.json();if(!r.ok||!d.ok)throw Error('account_unavailable');
  if(!d.member){login();return;}const active=d.grant?.status==='active'&&d.remainingDays>0;
  const nextSignature=JSON.stringify([d.balance,active,d.remainingDays,d.name]);if(signature!==nextSignature){signature=nextSignature;content.replaceChildren(link(Number(d.balance).toLocaleString('ko-KR')+'P · 내역','/noa-membership.php#points'),link(active?'구독 중 · '+d.remainingDays+'일 남음':'구독 없음','/noa-membership.php'),link(d.name+' · MY','/noa-my.php'));}bar.removeAttribute('title');
  bar.dataset.member='true';window.dispatchEvent(new CustomEvent('noa-membership-status',{detail:d}));
 }catch{if(bar.dataset.member==='true'){bar.title='계정 상태를 갱신하지 못했습니다. 다음 접속 시 다시 확인합니다.';}else content.replaceChildren(link('계정 확인 · 로그인','/bbs/login.php'));}finally{clearTimeout(timeout);pending=false;}}
 update();window.addEventListener('pageshow',update);window.addEventListener('noa-membership-change',update);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
