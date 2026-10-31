(()=>{'use strict';
 const icon='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4m-6.8 7 6.8 4"/></svg>';
 let state=null,loading=null;
 async function load(){if(loading)return loading;loading=fetch('/noa-bridge/referral.php',{credentials:'same-origin',cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();const v=await r.json();if(!v.ok||(v.member&&!/^https:\/\/noastudio\.ai\.kr\/\?invite=[a-f0-9]{48}$/.test(v.url)))throw Error();state=v;return v;}).finally(()=>loading=null);return loading;}
 const shareData=()=>({title:'NOA STUDIO · 친구 초대',text:'음악과 이야기를 함께 즐겨요. 이 링크로 가입하면 친구도 나도 각각 500P!',url:state.url});
 async function nativeShare(){try{await navigator.share(shareData());return true;}catch(e){return e.name==='AbortError';}}
 function dialog(){
  if(document.getElementById('noa-referral-dialog'))return;
  const d=document.createElement('dialog');d.id='noa-referral-dialog';d.setAttribute('aria-labelledby','nrf-title');
  d.innerHTML='<form method="dialog"><button class="nrf-close" aria-label="초대 창 닫기">×</button></form><span class="nrf-eyebrow">함께 듣는 즐거움</span><h2 id="nrf-title">친구도 나도 <strong>500P</strong></h2><p>내 초대 링크로 친구가 가입하면<br>두 사람에게 각각 500P를 드려요.</p><div class="nrf-content"></div><p class="nrf-status" role="status">초대 링크를 준비하고 있어요.</p><small>신규 회원의 가입 완료 시 1회 지급됩니다.<br>이미 가입한 회원의 로그인은 보상 대상이 아니에요.</small>';
  document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();
  const box=d.querySelector('.nrf-content'),status=d.querySelector('.nrf-status');
  function render(v){status.textContent='';if(!v.member){box.innerHTML='<a class="nrf-primary" href="/noa-login.php?url=%2F%3Finvite_share%3D1">로그인하고 내 초대 링크 받기</a>';return;}
   box.innerHTML='<label for="nrf-url">내 초대 링크</label><input id="nrf-url" readonly><div class="nrf-actions"><button class="nrf-primary" type="button" data-native>친구에게 공유</button><button type="button" data-copy>링크 복사</button></div>';
   const input=box.querySelector('input');input.value=v.url;input.onclick=()=>input.select();
   const copy=async()=>{try{await navigator.clipboard.writeText(v.url);status.textContent='초대 링크를 복사했어요. 친구에게 보내 주세요.';}catch{input.focus();input.select();status.textContent='아래 링크를 길게 누르거나 선택해서 복사해 주세요.';}};
   box.querySelector('[data-copy]').onclick=copy;box.querySelector('[data-native]').onclick=async()=>{if(!navigator.share||!await nativeShare())await copy();};
   if(!navigator.share){box.querySelector('[data-native]').remove();box.querySelector('[data-copy]').classList.add('nrf-primary');}
  }
  if(state)render(state);else load().then(render).catch(()=>{status.textContent='초대 링크를 준비하지 못했어요.';const retry=document.createElement('button');retry.textContent='다시 시도';retry.onclick=()=>{d.close();dialog();};box.append(retry);});
 }
 async function open(){if(state?.member&&navigator.share){if(await nativeShare())return;}dialog();}
 function mount(){
  const brand=document.querySelector('#noa-account-bar .noa-account-brand');if(brand&&!document.getElementById('noa-referral-share')){const b=document.createElement('button');b.id='noa-referral-share';b.type='button';b.innerHTML=icon;b.setAttribute('aria-label','친구 초대 링크 공유 · 각각 500포인트');b.title='친구 초대 · 500P';b.onclick=open;brand.after(b);}
  const section=document.querySelector('[data-home-section="recommendations"]');if(section&&!document.getElementById('noa-referral-banner')){const b=document.createElement('button');b.id='noa-referral-banner';b.type='button';b.innerHTML='<span class="nrf-banner-mark" aria-hidden="true">'+icon+'</span><span class="nrf-banner-copy"><small>좋은 음악, 친구와 함께</small><strong>친구도 나도 <em>500P</em></strong><span>초대 링크로 가입하면 각각 지급</span></span><span class="nrf-banner-action">친구 초대 <span aria-hidden="true">↗</span></span>';b.onclick=open;section.before(b);}
 }
 mount();const observer=new MutationObserver(mount);observer.observe(document.body,{childList:true,subtree:true});
 load().then(v=>{if(v.invited){const banner=document.getElementById('noa-referral-banner');if(banner){banner.querySelector('.nrf-banner-copy').innerHTML='<small>친구의 초대가 도착했어요</small><strong>가입하고 <em>500P</em> 받기</strong><span>초대한 친구에게도 500P가 지급돼요</span>';banner.querySelector('.nrf-banner-action').textContent='가입하기 ↗';banner.onclick=()=>location.assign('/noa-login.php?url=%2F');}}
  if(new URLSearchParams(location.search).get('invite_share')==='1'&&v.member)dialog();
 }).catch(()=>{});
})();
