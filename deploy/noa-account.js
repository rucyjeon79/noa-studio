/* The account control occupies its own sticky row; no overlay on native confirmation buttons. */
(()=>{'use strict';if(document.getElementById('noa-account-bar')||location.pathname.startsWith('/adm/'))return;
 const bar=document.createElement('header');bar.id='noa-account-bar';bar.setAttribute('aria-label','로그인 · 포인트 · 구독');const content=document.createElement('nav');bar.append(content);
 const link=(text,href)=>{const a=document.createElement('a');a.textContent=text;a.href=href;return a;};
 let signature='';
 const login=()=>{signature='';delete bar.dataset.member;content.replaceChildren(link('로그인','/bbs/login.php?url='+encodeURIComponent(location.pathname+location.search)));};login();document.body.prepend(bar);
 let pending=false;
 async function update(){if(pending)return;pending=true;const abort=new AbortController(),timeout=setTimeout(()=>abort.abort(),10000);try{
  const r=await fetch('/noa-bridge/membership.php',{credentials:'same-origin',cache:'no-store',signal:abort.signal}),d=await r.json();if(!r.ok||!d.ok)throw Error('account_unavailable');
  if(!d.member){login();return;}const active=d.grant?.status==='active'&&d.remainingDays>0;
  const nextSignature=JSON.stringify([d.balance,active,d.remainingDays,d.name]);if(signature!==nextSignature){signature=nextSignature;content.replaceChildren(link(Number(d.balance).toLocaleString('ko-KR')+'P · 내역','/noa-membership.php#points'),link(active?'구독 중 · '+d.remainingDays+'일 남음':'구독 없음','/noa-membership.php'),link(d.name+' · MY','/noa-my.php'));}bar.removeAttribute('title');
  bar.dataset.member='true';window.dispatchEvent(new CustomEvent('noa-membership-status',{detail:d}));
 }catch{if(bar.dataset.member==='true'){bar.title='계정 상태를 갱신하지 못했습니다. 다음 접속 시 다시 확인합니다.';}else content.replaceChildren(link('계정 확인 · 로그인','/bbs/login.php'));}finally{clearTimeout(timeout);pending=false;}}
 update();window.addEventListener('pageshow',update);window.addEventListener('noa-membership-change',update);document.addEventListener('visibilitychange',()=>{if(!document.hidden)update();});
})();
