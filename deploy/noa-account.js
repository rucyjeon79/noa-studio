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
