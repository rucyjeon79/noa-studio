(()=>{
 'use strict';
 const audio=document.getElementById('sound-player');
 const browse=document.getElementById('music-browse');
 const cover=document.getElementById('dock-cover');
 const blank=document.getElementById('dock-cover-empty');
 if(!audio||!browse||!cover||!blank)return;
 document.body.classList.add('noa-record-room');
 const editions=[
  ['ORIGINALS','starlight-studio'],['EP SERIES','world-journey'],
  ['YOUR STORIES','fans-stars'],['COVER SESSIONS','act-1']
 ];
 const make=(cls,text='')=>{const el=document.createElement('span');el.className=cls;el.textContent=text;return el;};
 function wrapArt(parent,pieces){
  const holder=make('lp-track-art');
  if(pieces.length)pieces[0].before(holder);else parent.prepend(holder);
  const disc=make('lp-spindle');disc.setAttribute('aria-hidden','true');
  const jacket=make('lp-track-jacket');
  if(pieces.length)jacket.append(...pieces);
  else{jacket.textContent='♪';jacket.setAttribute('aria-hidden','true');}
  holder.append(disc,jacket);
  return holder;
 }
 const dockArt=wrapArt(cover.parentElement,[cover,blank]);
 dockArt.classList.add('lp-dock-art');
 let key=document.querySelector('#songs .song.selected')?.dataset.key||'';
 let started=!audio.paused&&!audio.ended&&audio.readyState>=3;
 let running=started;
 let pending=false;
 function sync(){
  pending=false;
  const buttons=browse.querySelectorAll('[data-browse-level="1"] .noa-browse-grid>.noa-browse-card');
  buttons.forEach((btn,i)=>{
   if(!editions[i]||btn.classList.contains('lp-edition'))return;
   const image=btn.querySelector(':scope>img');if(!image)return;
   const [edition,photo]=editions[i];
   btn.classList.add('lp-edition');
   btn.dataset.lpNumber=String(i+1).padStart(2,'0');
   const sleeve=make('lp-edition-art');
   const face=make('lp-edition-face');
   const disc=make('lp-spindle');disc.setAttribute('aria-hidden','true');
   const imprint=make('lp-imprint',edition);imprint.setAttribute('aria-hidden','true');
   image.before(sleeve);image.src='/noa-assets/editorial-'+photo+'.webp';face.append(image,imprint);sleeve.append(disc,face);
  });
  for(const item of document.querySelectorAll('#music-browse .noa-inline-song[data-inline-key],#songs .song[data-key]')){
   const active=(item.dataset.inlineKey||item.dataset.key)===key && !!key;
   const parent=item.matches('.song')?item.querySelector('.song-select'):item;
   if(!parent)continue;
   let holder=parent.querySelector(':scope>.lp-track-art');
   if(active&&!holder)holder=wrapArt(parent,[...parent.querySelectorAll(':scope>img,:scope>.cover')]);
   if(holder){holder.classList.toggle('lp-on-record',active&&started);holder.classList.toggle('lp-running',active&&running);}
  }
  dockArt.classList.toggle('lp-on-record',started);
  dockArt.classList.toggle('lp-running',running);
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
 window.addEventListener('noa-track-selected',event=>{
  const next=event.detail?.record?.key||document.querySelector('#songs .song.selected')?.dataset.key||'';
  if(next!==key){key=next;started=false;running=false;schedule();}
 });
 audio.addEventListener('playing',()=>{running=!audio.paused&&!audio.ended;started=started||running;schedule();});
 for(const event of ['waiting','pause','seeking','ended','error','emptied','loadstart']){
  audio.addEventListener(event,()=>{running=false;schedule();});
 }
 new MutationObserver(schedule).observe(browse,{subtree:true,childList:true});
 sync();
})();
