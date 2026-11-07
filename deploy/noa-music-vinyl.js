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
  if(parent.matches('.noa-inline-song')){
   const meter=make('lp-album-meter');meter.setAttribute('aria-hidden','true');
   meter.append(make(''),make(''),make(''));holder.append(meter);
  }
  return holder;
 }
 const dockArt=wrapArt(cover.parentElement,[cover,blank]);
 dockArt.classList.add('lp-dock-art');
 let key=document.querySelector('#songs .song.selected')?.dataset.key||'';
 let started=!audio.paused&&!audio.ended&&audio.readyState>=3;
 let running=started;
 let pending=false;
 const idleDelay=10000;
 let idleTimer,lastInput=-Infinity,ignoreAutoScrollUntil=-Infinity;
 const modalClose=new MutationObserver(()=>{modalClose.disconnect();scheduleFollow();});
 function activeModal(){
  return document.querySelector('dialog:modal')||Array.from(document.querySelectorAll('[aria-modal="true"]:not([hidden])')).find(el=>el.getClientRects().length);
 }
 function musicPageVisible(){
  return !document.body.classList.contains('noa-shell-open')&&!document.documentElement.classList.contains('nl-home-docked')&&!window.frameElement?.hidden;
 }
 function editing(){return Array.from(browse.querySelectorAll('.noa-edit-form')).some(form=>form.getClientRects().length);}
 function scheduleFollow(){
  clearTimeout(idleTimer);
  if(running&&key&&!document.hidden)idleTimer=setTimeout(followTrack,Math.max(0,idleDelay-(performance.now()-lastInput)));
 }
 function autoScroll(target,block){
  ignoreAutoScrollUntil=performance.now()+1500;
  target.scrollIntoView({block,behavior:reducedMotion.matches?'instant':'smooth'});
 }
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 function centerIfNeeded(target){
  const rect=target.getBoundingClientRect();
  const header=document.getElementById('noa-account-bar'),dock=document.querySelector('.noa-transport:not([hidden])');
  const top=Math.max(0,header?.getBoundingClientRect().bottom||0)+8;
  const bottom=Math.min(innerHeight,dock?.getBoundingClientRect().top??innerHeight)-8;
  if(rect.top<top||rect.bottom>bottom)autoScroll(target,'center');
 }
 function followTrack(){
  if(!key||!running||audio.paused||document.hidden)return;
  if(performance.now()-lastInput<idleDelay){scheduleFollow();return;}
  const modal=activeModal();
  if(modal){
   if(modal.id==='dock-queue'){
    const item=modal.querySelector('.noa-queue-track[aria-current="true"]');
    if(item){const r=item.getBoundingClientRect(),panel=modal.getBoundingClientRect();if(r.top<panel.top||r.bottom>panel.bottom)autoScroll(item,'nearest');}
   }
   if(modal.matches('dialog'))modalClose.observe(modal,{attributes:true,attributeFilter:['open']});
   else idleTimer=setTimeout(followTrack,1000);
   return;
  }
  if(!musicPageVisible()||editing())return;
  const playingRow=Array.from(document.querySelectorAll('#music-browse .noa-inline-song[data-inline-key],#songs .song[data-key]'))
   .find(el=>(el.dataset.inlineKey||el.dataset.key)===key&&el.getClientRects().length);
  if(playingRow){
   centerIfNeeded(playingRow.querySelector('.lp-track-art')||playingRow);
   return;
  }
  // Classification may still be loading. A deferred reveal must respect newer input and track changes.
  const requested=key;
  const allow=()=>key===requested&&running&&!audio.paused&&!document.hidden&&musicPageVisible()&&!activeModal()&&!editing()&&performance.now()-lastInput>=idleDelay;
  window.dispatchEvent(new CustomEvent('noa-find-song',{detail:{key,allow,scroll:centerIfNeeded}}));
 }
 function activity(){ignoreAutoScrollUntil=-Infinity;lastInput=performance.now();scheduleFollow();}
 for(const type of ['pointerdown','pointerup','touchstart','touchmove','touchend','wheel','keydown','input','click']){
  window.addEventListener(type,activity,{passive:true,capture:true});
 }
 window.addEventListener('pointermove',e=>{if(e.movementX||e.movementY)activity();},{passive:true,capture:true});
 window.addEventListener('scroll',()=>{if(performance.now()>=ignoreAutoScrollUntil)activity();},{passive:true,capture:true});
 document.addEventListener('close',scheduleFollow,true);
 document.addEventListener('visibilitychange',scheduleFollow);
 window.addEventListener('noa-player-route',scheduleFollow);
 window.addEventListener('pageshow',scheduleFollow);

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
 let actionCounts=JSON.parse(document.getElementById('noa-track-counts')?.textContent||'{}');
 let refreshSequence=0;
 async function refreshActionCounts(){
  const sequence=++refreshSequence;
  try{
   const response=await fetch(location.href,{credentials:'same-origin',cache:'no-store',headers:{'X-Noa-Track-Totals':'1'}});
   if(!response.ok)return;
   const totals=await response.json();
   if(sequence!==refreshSequence||!totals||!('plays' in totals)||!('downloads' in totals))return;
   actionCounts=totals;
   showActionCounts();
  }catch{/* Preserve the last confirmed values until the next refresh. */}
 }
 window.addEventListener('noa-play-counted',refreshActionCounts);
 window.addEventListener('pageshow',event=>{if(event.persisted)refreshActionCounts();});
 window.addEventListener('focus',refreshActionCounts);
 function showActionCounts(){
  for(const row of browse.querySelectorAll('.noa-inline-song-row[data-inline-key]')){
   for(const [action,metric] of [['재생','plays'],['다운로드','downloads']]){
    const label=row.querySelector('.noa-song-actions button[aria-label$=" '+action+'"]>span');
    if(!label)continue;
    const totals=actionCounts[metric];
    const count=totals==null?'—':Number(totals[row.dataset.inlineKey]||0).toLocaleString('ko-KR');
    if(label.textContent!==count)label.textContent=count;
   }

  }
 }
 const originalTitles=JSON.parse(document.getElementById('noa-original-titles')?.textContent||'{}');
 function showOriginalTitles(){
  if(typeof records==='undefined'||!window.NoaBrowse)return;
  const byKey=new Map(records.map(row=>[String(row.key),row]));
  for(const item of document.querySelectorAll('#music-browse .noa-inline-song[data-inline-key],#songs .song[data-key]')){
   const record=byKey.get(item.dataset.inlineKey||item.dataset.key);
   const title=item.querySelector('.noa-inline-title,.info strong');
   if(!title||!record)continue;
   NoaBrowse.markOriginalTitle(title,record,record.video?'':originalTitles[Number(record.ep)]);
  }
 }
 function fitTrackName(viewport){
  const text=viewport.firstElementChild;
  if(!text||!viewport.clientWidth)return;
  const textWidth=text.getBoundingClientRect().width;
  const overflows=textWidth>viewport.clientWidth+0.5;
  viewport.classList.toggle('lp-title-overflow',overflows);
  if(!overflows)return;
  const gap=28;
  text.dataset.repeat=text.textContent;
  viewport.style.setProperty('--title-gap',gap+'px');
  viewport.style.setProperty('--title-duration',(textWidth+gap)/32+'s');
 }
 const titleSizes=new ResizeObserver(entries=>{
  const viewports=new Set(entries.map(({target})=>target.closest('.noa-track-name')));
  for(const viewport of viewports)if(viewport?.isConnected)fitTrackName(viewport);
 });
 function prepareTrackNames(){
  for(const viewport of browse.querySelectorAll('.noa-inline-song-row .noa-track-name')){
   if(viewport.firstElementChild?.classList.contains('lp-title-text'))continue;
   const text=make('lp-title-text',viewport.textContent);
   viewport.replaceChildren(text);
   titleSizes.observe(viewport);
   titleSizes.observe(text);
   fitTrackName(viewport);
  }
 }
 function showCoverCredits(){
  const artists=new Map();
  for(const track of document.querySelectorAll('#songs .song[data-genre="cover-reborn"][data-original-artist]:not([data-original-artist=""])')){
   if(track.dataset.originalArtist.trim())artists.set(track.dataset.key,track.dataset.originalArtist.trim());
  }
  for(const title of browse.querySelectorAll('.noa-inline-song .noa-inline-title[title]')){
   const key=title.closest('.noa-inline-song').dataset.inlineKey;
   const artist=artists.get(key);
   const full=title.title;
   const split=artist && full.endsWith(' - '+artist);
   const text=title.querySelector('.lp-title-text');
   const name=split?full.slice(0,-(artist.length+3)):full;
   let credit=title.querySelector('.lp-cover-credit');
   if((split||credit) && text && text.textContent!==name)text.textContent=name;
   if(split){
    if(!credit){credit=make('lp-cover-credit');title.append(credit);}
    if(credit.textContent!==artist)credit.textContent=artist;
   }else credit?.remove();
  }
 }
 function sync(){
  showActionCounts();
  showOriginalTitles();
  prepareTrackNames();
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
  showCoverCredits();
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
   if((active||item.matches('.noa-inline-song'))&&!holder)holder=wrapArt(parent,[...parent.querySelectorAll(':scope>img,:scope>.cover')]);
   if(holder){holder.classList.toggle('lp-on-record',active&&started);holder.classList.toggle('lp-running',active&&running);}
   const toggle=item.closest('.noa-inline-song-row')?.querySelector('.noa-song-action[aria-label$=" 재생"]');
   if(toggle){
    toggle.classList.add('lp-cover-toggle');
    toggle.setAttribute('aria-pressed',String(active&&!audio.paused&&!audio.ended));
    toggle.title=active&&!audio.paused&&!audio.ended?'일시정지':'재생';
   }
  }
  dockArt.classList.toggle('lp-on-record',started);
  dockArt.classList.toggle('lp-running',running);

 }
 function schedule(){if(!pending){pending=true;requestAnimationFrame(sync);}}
 browse.addEventListener('click',event=>{
  const toggle=event.target.closest('.lp-cover-toggle');
  if(!toggle||toggle.disabled)return;
  const row=toggle.closest('.noa-inline-song-row');
  if(row?.dataset.inlineKey!==key||!audio.currentSrc)return;
  event.preventDefault();event.stopImmediatePropagation();
  if(audio.paused||audio.ended)audio.play().catch(()=>{});else audio.pause();
 },true);
 window.addEventListener('noa-track-selected',event=>{
  const next=event.detail?.record?.key||document.querySelector('#songs .song.selected')?.dataset.key||'';
  if(next!==key){
   key=next;started=false;running=false;scheduleFollow();schedule();
   for(const item of document.querySelectorAll('#dock-queue[open] .noa-queue-track[data-queue-key]')){
    const current=item.dataset.queueKey===key;
    if(item.getAttribute('aria-current')!==String(current)){item.setAttribute('aria-current',String(current));item.querySelector('.noa-queue-state').textContent=current?'현재 곡':'재생';}
   }
  }
 });
 audio.addEventListener('playing',()=>{running=!audio.paused&&!audio.ended;started=started||running;schedule();scheduleFollow();});
 for(const event of ['waiting','pause','seeking','ended','error','emptied','loadstart']){
  audio.addEventListener(event,()=>{running=false;scheduleFollow();schedule();});
 }
 new MutationObserver(changes=>{
  schedule();
  if(changes.some(change=>[...change.removedNodes].some(n=>n.nodeType===1&&(n.matches('.noa-edit-form')||n.querySelector('.noa-edit-form')))))scheduleFollow();
 }).observe(browse,{subtree:true,childList:true});
 const songs=document.getElementById('songs');
 if(songs)new MutationObserver(schedule).observe(songs,{subtree:true,childList:true,attributes:true,attributeFilter:['data-audio','data-audio-sha']});
 sync();scheduleFollow();
})();
