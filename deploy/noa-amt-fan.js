(()=>{
 const entry='https://www.aimusictown.com/competition/2?entryId=353';
 const collection='9fed48ee44d5b75621e4c7be';
 const playlist='/noa-music.php?group=story&genre=your-story&collection='+collection;
 const title='람준파파 응원하기 · 제2회 AMT AI 작곡대회';
 const end=Date.parse('2026-11-16T00:00:00+09:00'),key='noa-amt2-fan-2026';
 const el=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const remember=()=>{try{sessionStorage.setItem(key,'1');}catch{}};
 function cta(){const a=el('a','람준파파 응원하기 ↗');a.href=entry;a.target='_blank';a.rel='noopener noreferrer';a.className='amt-fan-cta';return a;}
 document.addEventListener('click',e=>{
  const a=e.target.closest?.('a[href]');if(!a||a.href!==entry||e.defaultPrevented||Date.now()>=end)return;
  a.target='_blank';a.rel='noopener noreferrer';remember();
  // Let the trusted link open the new tab before navigating the studio tab.
  setTimeout(()=>{(window.top===window?window:window.top).location.assign(playlist);},0);
 });
 if(location.pathname==='/noa-music.php'&&new URLSearchParams(location.search).get('collection')===collection){
  const reveal=()=>{const row=document.querySelector('.noa-user-playlist[data-playlist-id="'+collection+'"]');
   const toggle=row?.querySelector(':scope>.noa-browse-card');if(!toggle)return false;
   if(toggle.getAttribute('aria-expanded')!=='true')toggle.click();
   requestAnimationFrame(()=>document.querySelector('.noa-user-playlist[data-playlist-id="'+collection+'"]')?.scrollIntoView({block:'center'}));return true;};
  const observer=new MutationObserver(()=>{if(reveal())observer.disconnect();});if(!reveal())observer.observe(document.body,{childList:true,subtree:true});
 }
 if(Date.now()>=end)return;
 for(const post of document.querySelectorAll('.noa-notice-list details')){
  if(post.querySelector('summary strong')?.textContent===title)post.querySelector('.noa-notice-body')?.prepend(cta());
 }
 if(location.pathname==='/noa-lounge.php'){
  const noticeURL='/noa-lounge.php?board=notice&nativePost=2#noa-notice-2';
  const attach=()=>{
   const params=new URLSearchParams(location.search);
   const content=document.getElementById('ec-content');
   if(!content)return;
   if(params.get('category')==='notice'&&!params.has('post')&&!params.get('q')&&!params.get('mine')&&!params.get('saved')&&!content.querySelector('.amt-notice-link')){
    const a=el('a',title);a.className='amt-notice-link ec-link';a.href=noticeURL;content.prepend(a);
   }
   const board=content.querySelector('[data-noa-community="notice"]');
   if(board?.querySelector('a.noa-community-write[href*="login"]')&&!board.querySelector('.amt-public-notice')&&(!params.has('nativePost')||params.get('nativePost')==='2')){
    const article=el('article');article.className='amt-public-notice';
    article.append(el('h2',title),el('p','별무리 여러분, 람준파파가 K-POP 부문에 참가하고 있어요. 미전송(Unread), BLOOM, NO LIMITS 세 곡을 듣고 AMT 참가 페이지에서 응원을 보내 주세요.'),cta());
    board.prepend(article);
   }
   for(const post of document.querySelectorAll('.noa-community-post[open]')){
   if(post.querySelector('summary strong')?.textContent!==title)continue;
   const body=post.querySelector('.noa-community-text');if(body&&!body.querySelector('.amt-fan-cta'))body.append(cta());
  }};
  new MutationObserver(attach).observe(document.body,{childList:true,subtree:true});attach();
 }
 if(window.top!==window||new URLSearchParams(location.search).get('collection')===collection)return;
 try{if(sessionStorage.getItem(key))return;}catch{}
 const dialog=el('dialog');dialog.id='noa-amt-fan';dialog.setAttribute('aria-labelledby','amt-fan-heading');
 const close=el('button','닫기 ×');close.type='button';close.className='amt-close';close.onclick=()=>dialog.close();
 const art=el('div');art.className='amt-art';art.append(el('span','AMT  02   /   K-POP'));
 const box=el('div');box.className='amt-copy';
 const heading=el('h2','별무리, 람준파파에게 힘을 보내주세요');heading.id='amt-fan-heading';
 box.append(el('small','제2회 AMT AI 작곡대회'),heading,el('p','람준파파가 세 곡으로 도전합니다. AMT 참가 페이지에서 응원을 남겨 주세요. 돌아오면 이곳에서 참가곡을 들을 수 있어요.'),cta(),el('small','응원 안내 · 11월 15일까지'));
 dialog.append(art,close,box);document.body.append(dialog);
 dialog.addEventListener('close',()=>{remember();dialog.remove();},{once:true});dialog.showModal();
 setTimeout(()=>{if(dialog.open)dialog.close();},end-Date.now());
})();
