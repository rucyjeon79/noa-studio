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
 let idleTimer;
 let lastBrowse=-Infinity;
 let followedKey='';
 function followTrack(){
  if(!key||!running||audio.paused||document.hidden||document.querySelector('dialog[open],[aria-modal="true"]:not([hidden])')||document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
  const playingCover=()=>Array.from(document.querySelectorAll('#music-browse .lp-running,#songs .lp-running')).find(el=>el.getClientRects().length);
  function center(){
   const el=playingCover();
   if(!el)return false;
   const rect=el.getBoundingClientRect();
   if(rect.top<80||rect.bottom>innerHeight-160)el.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   return true;
  }
  if(!center()){
   window.dispatchEvent(new CustomEvent('noa-find-song',{detail:{key}}));
   requestAnimationFrame(()=>{sync();center();});
  }
 }
 function activity(){
  lastBrowse=performance.now();
  clearTimeout(idleTimer);
  if(running)idleTimer=setTimeout(followTrack,10000);
 }
 for(const type of ['pointerdown','pointermove','touchmove','wheel','scroll','keydown','input']){
  window.addEventListener(type,activity,{passive:true,capture:true});
 }
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)activity();});

 const songAwards=new Map([
  ['story:your-story:4e75f1a6f5919a67c7b9cbb7','예선 1위'],
  ['story:your-story:ee00443af14f2754a18a6b1c','본선 1위'],
  ['story:your-story:86c38c573de24a6ac5b793a5','결선 1위'],
  ['story:your-story:35fa27149612463491996053','예선 참가곡'],
  ['catalog:a785dbc3e646c64b54cd1536048100e5ee66f55ec9be69d39e6b5251c91f4bba','본선 참가곡'],
  ['story:your-story:6d2ff36af19c40d596c51002','결선 참가곡']
 ]);
 // Mirror the browse tree's canonical membership, including tracks in closed groups.
 const showMasterCounts=!!document.querySelector('meta[name="noa-jukebox-csrf"]');
 function syncPressings(buttons){
  if(typeof records==='undefined'||typeof collections==='undefined'||!window.NoaBrowse)return;
  const catalog=new Map([...collections,...records].map(row=>[row.key,row]));
  const tracks=NoaBrowse.canonicalBrowseRows([...catalog.values()].filter(row=>row.kind!=='video'&&!row.video)).filter(row=>row.kind!=='playlist');
  const ready=new Set();
  for(const row of document.querySelectorAll('#songs .song[data-key]')){
   // Count the published master, just as the track's PREMIUM badge does.
   // A replacement upload has its own status while the old master remains playable.
   const {key,audio,audioSha}=row.dataset;
   if(audio&&audioSha){ready.add(key);ready.add(row.dataset.jukeboxKey||key);}
  }
  // The progress renderer can confirm a master before the raw song attributes refresh.
  for(const badge of document.querySelectorAll('#songs .song .noa-premium-badge,#music-browse .noa-inline-song-row .noa-premium-badge')){
   const row=badge.closest('.noa-inline-song-row,.song');
   ready.add(row.dataset.inlineKey||row.dataset.key);
  }
  const identity=row=>String(row.browseIdentity||row.canonicalRecordKey||row.orderKey||row.musicKey||row.key).replace(/^catalog:/,'');
  const mastered=new Set([...catalog.values()].filter(row=>ready.has(String(row.key))).map(identity));
  for(const row of tracks)if(mastered.has(identity(row)))ready.add(String(row.key));
  function mark(card,keys){
   if(!card||!keys.length)return;
   const count=keys.filter(key=>ready.has(String(key))).length;
   const complete=count===keys.length;
   if(complete&&card.dataset.lpComplete==='false')card.classList.add('lp-new-pressing');
   if(!complete)card.classList.remove('lp-new-pressing');
   card.dataset.lpComplete=String(complete);
   if(!showMasterCounts)return;
   const caption=card.querySelector(':scope>span:last-child small');
   if(!caption)return;
   let tally=caption.querySelector('.lp-tally');
   if(!tally){
    const prefix=caption.textContent.replace(/\d+개 곡$/, '').trim();
    tally=make('lp-tally');
    caption.replaceChildren(document.createTextNode(prefix),tally);
   }
   const label=count+'/'+keys.length+'곡 완료';
   if(tally.textContent!==label)tally.textContent=label;
  }
  buttons.forEach((card,index)=>{
   const genres=NoaBrowse.groups[index]?.[2]||[];
   mark(card,tracks.filter(row=>genres.includes(row.genre)).map(row=>row.key));
  });
  const selectedGroup=Array.from(buttons).findIndex(card=>card.getAttribute('aria-pressed')==='true');
  const genres=NoaBrowse.groups[selectedGroup]?.[2]||[];
  const genreCards=browse.querySelectorAll('[data-browse-level="2"]>.noa-browse-grid>.noa-browse-card');
  genreCards.forEach((card,index)=>{
   mark(card,tracks.filter(row=>row.genre===genres[index]).map(row=>row.key));
  });
  for(const section of browse.querySelectorAll('.noa-inline-act')){
   const keys=[...section.querySelectorAll('.noa-inline-song[data-inline-key]')].map(row=>row.dataset.inlineKey);
   mark(section.querySelector(':scope>.noa-browse-card'),keys);
  }
 }
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
  syncPressings(buttons);
  for(const item of document.querySelectorAll('#music-browse .noa-inline-song[data-inline-key],#songs .song[data-key]')){
   const active=(item.dataset.inlineKey||item.dataset.key)===key && !!key;
   const award=songAwards.get(item.dataset.inlineKey||item.dataset.key);
   if(award){
    const title=item.querySelector('.noa-inline-title,.info strong');
    if(title&&!title.querySelector('.noa-amt-award')){
     const badge=make('noa-amt-award',award);
     badge.dataset.winner=String(award.endsWith('1위'));
     title.append(badge);
    }
   }
   const parent=item.matches('.song')?item.querySelector('.song-select'):item;
   if(!parent)continue;
   let holder=parent.querySelector(':scope>.lp-track-art');
   if(active&&!holder)holder=wrapArt(parent,[...parent.querySelectorAll(':scope>img,:scope>.cover')]);
   if(holder){holder.classList.toggle('lp-on-record',active&&started);holder.classList.toggle('lp-running',active&&running);}
  }
  dockArt.classList.toggle('lp-on-record',started);
  dockArt.classList.toggle('lp-running',running);
  if(running&&key&&followedKey!==key){
   followedKey=key;
   clearTimeout(idleTimer);
   idleTimer=setTimeout(followTrack,Math.max(0,10000-(performance.now()-lastBrowse)));
  }
 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
 window.addEventListener('noa-track-selected',event=>{
  const next=event.detail?.record?.key||document.querySelector('#songs .song.selected')?.dataset.key||'';
  if(next!==key){followedKey='';key=next;started=false;running=false;schedule();}
 });
 audio.addEventListener('playing',()=>{running=!audio.paused&&!audio.ended;started=started||running;schedule();});
 for(const event of ['waiting','pause','seeking','ended','error','emptied','loadstart']){
  audio.addEventListener(event,()=>{running=false;schedule();});
 }
 new MutationObserver(schedule).observe(browse,{subtree:true,childList:true});
 const songs=document.getElementById('songs');
 if(songs)new MutationObserver(schedule).observe(songs,{subtree:true,childList:true,attributes:true,attributeFilter:['data-audio','data-audio-sha']});
 sync();
})();
