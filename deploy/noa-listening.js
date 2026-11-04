(()=>{'use strict';
const host=document.querySelector('[data-noa-listening]');if(!host||!window.NoaListeningModel)return;
const model=window.NoaListeningModel;const home=host.dataset.noaListening==='home';let state,records=[],musicWindow=null,frame=null,mode='now',mood='auto',scope='all',genre='kpop-original',loadSequence=0;
let videoReady=false,videoLoadFailed=false,videoDialog=null,videoRequest=0;
function usesVideo(){return state?.member&&!state.canPlay;}
function catalogReady(){return usesVideo()?videoReady:!!musicWindow;}
const labels={auto:'지금 추천',calm:'휴식',focus:'집중',comfort:'위로',energy:'활동',drive:'운전',walk:'산책'};
const iconPaths={calm:'M20 4C10 3 4 7 5 14c1 4 6 5 10 2 4-3 5-7 5-12z M4 21l11-12',focus:'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',comfort:'M12 20 4 12C-1 5 7 1 12 7c5-6 13-2 8 5z',energy:'m14 2-9 12h6l-1 8 9-13h-6z',drive:'M3 16v-5l2-6h14l2 6v5H3z M3 10h18 M6 16v3 M18 16v3 M6 13h2 M16 13h2',walk:'M15 5a2 2 0 1 1-4 0 2 2 0 0 1 4 0 M6 13l3-4 4-1 3 5 4 1 M12 9l-2 7-5 5 M11 14l4 3 2 5',play:'m8 5 11 7-11 7V5Z',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z',close:'m6 6 12 12M6 18 18 6',save:'m5 12 4 4L19 6',trash:'M3 6h18 M8 6V4h8v2 M5 6l1 15h12l1-15 M10 10v7 M14 10v7',music:'M9 18V5l12-2v13 M9 8l12-2 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6',star:'m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9Z'};
const icon=(name)=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg'),path=document.createElementNS(svg.namespaceURI,'path');svg.classList.add('nl-icon');svg.setAttribute('aria-hidden','true');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.5');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');path.setAttribute('d',iconPaths[name]||iconPaths.star);svg.append(path);return svg;};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,name,fn)=>{const b=el('button','nl-button');b.type='button';b.append(icon(name),document.createTextNode(text));b.onclick=fn;return b;};
host.innerHTML='<div class="nl-heading"><div><p class="nl-kicker">YOUR MUSIC, YOUR MOMENT</p><h2>지금, 나에게 맞는 음악</h2></div></div><p class="nl-status" role="status" aria-live="polite">추천 음악을 준비하고 있어요.</p>';
const heading=host.querySelector('.nl-heading'),status=host.querySelector('.nl-status');
const settings=button('추천 설정','settings',()=>openSettings());heading.append(settings);
function lane(key,title,note){
 const section=el('section','nl-lane');section.dataset.listeningLane=key;
 const h=el('h3','',title);h.id='nl-lane-'+key;section.setAttribute('aria-labelledby',h.id);
 section.append(h,el('p','nl-lane-note',note));host.insertBefore(section,status);return section;
}
const wholeLane=lane('whole','오늘의 공감 추천','오늘의 리듬에 어울리는 곡을 장르 구분 없이 최대 100곡 추천해요.');
const mixButton=button('공감 추천 듣기','play',playWholeCatalog);mixButton.disabled=true;mixButton.dataset.allGenreMix='';mixButton.dataset.mood='auto';mixButton.classList.add('nl-play-action');if(home)mixButton.classList.add('nl-primary');
const wholePreview=el('div','nl-preview');wholeLane.append(mixButton,wholePreview);
const genrePanel=lane('suggested','오늘 나에게 어울리는 장르','추천 장르를 고르면 해당 장르의 곡을 최대 10곡 들어요.');
const genreHint=el('p','nl-note'),genreCards=el('div','nl-genre-cards');genrePanel.append(genreHint,genreCards);
const manual=lane('manual','지금 내 기분','지금 끌리는 분위기를 고르면 최대 100곡을 바로 들어요. 장르도 고르면 그 안에서 추천해요.');
const controls=el('div','nl-controls'),genreLabel=el('label','nl-genre-label','장르'),genres=el('select','nl-genres');
genres.setAttribute('aria-label','듣고 싶은 장르');genreLabel.append(genres);controls.append(genreLabel);
let manualGenre='',manualMood='';
const moods=el('div','nl-moods');moods.setAttribute('role','group');moods.setAttribute('aria-label','음악 분위기');
for(const [key,label] of Object.entries(labels).filter(([key])=>key!=='auto')){
 const b=button(label,key,()=>{
  manualMood=key;const selection=renderManual();
  if(!manualGenre&&state?.member&&selection.rows.length)startManual(selection.rows);
 });b.dataset.mood=key;moods.append(b);
}
const manualPlay=button('곡 듣기','play',()=>startManual(manualRows()));manualPlay.dataset.manualPlay='';manualPlay.classList.add('nl-play-action');manualPlay.disabled=true;
const manualPreview=el('div','nl-preview');manual.append(controls,moods,manualPlay,manualPreview);
function isGlobalMix(){return scope==='all'&&mode==='now'&&mood==='auto'&&state?.theme?.personal===true;}
function playWholeCatalog(){
 if(!state||mixButton.disabled)return;
 if(!state.theme?.personal){openSettings(true);return;}
 scope='all';mode='now';mood='auto';play(listeningPlan().whole.rows,true);
}
let cachedMoodRows,cachedMoodPeriod,moodMixes=new Map();
function manualSelection(){
 if(!manualMood||!catalogReady())return {rows:[]};
 if(!manualGenre){
  const period=state.theme.localDate+'|'+state.theme.period;
  if(cachedMoodRows!==records||cachedMoodPeriod!==period){moodMixes.clear();cachedMoodRows=records;cachedMoodPeriod=period;}
  if(!moodMixes.has(manualMood))moodMixes.set(manualMood,model.wholeMoodMix(records,manualMood,state.theme));
  return moodMixes.get(manualMood);
 }
 return model.manualGenre(records,manualGenre,(musicWindow||window).NoaBrowse?.orderFor,manualMood);
}
function manualRows(){return manualSelection().rows;}
function startManual(rows){
 if(!manualMood||!rows.length)return;
 if(manualGenre)genre=manualGenre;
 mood=manualMood;scope=manualGenre?'genre':'catalogMood';mode='now';play(rows,false);
}
function trackCopy(row,button,showEpisode=false){
 const genre=musicWindow?.NoaBrowse?.genreName?.(row.genre,state.genres)??(Object.hasOwn(state.genres,row.genre)?state.genres[row.genre]:'미분류');
 const copy=el('span','nl-track-copy'),meta=el('small','nl-track-genre',genre);
 if(showEpisode&&row.ep)meta.append(document.createTextNode(' · EP.'+String(row.ep).padStart(2,'0')));
 copy.append(el('strong','nl-track-title',row.title),meta);
 button.setAttribute('aria-description',meta.textContent);
 return copy;
}
function preview(target,rows,onPlay,note=''){
 target.replaceChildren();if(!rows.length){if(note)target.append(el('small','nl-note',note));return;}
 const shown=rows.slice(0,10),list=el('div','nl-preview-tracks');
 target.append(el('h4','','곡 미리보기 · '+shown.length+'곡'),list);
 for(const [index,row] of shown.entries()){
  const b=el('button','nl-preview-track');b.type='button';b.setAttribute('aria-label',row.title+'부터 듣기');
  b.append(el('small','',String(index+1).padStart(2,'0')),trackCopy(row,b),icon('play'));
  b.onclick=()=>onPlay([row,...rows.filter(r=>r.key!==row.key)]);list.append(b);
 }
 if(note)target.append(el('small','nl-note',note));
}
function renderManual(){
 genres.value=manualGenre;
 for(const b of moods.children)b.setAttribute('aria-pressed',String(b.dataset.mood===manualMood));
 const selected=manualSelection();manualPlay.disabled=!manualMood||!selected.rows.length;
 manualPlay.lastChild.textContent=selected.rows.length?labels[manualMood]+' '+selected.rows.length+'곡 듣기':'곡 듣기';
 let note='';
 if(manualMood&&catalogReady()){
  if(!selected.rows.length)note='재생 가능한 곡이 없어요.';
  else if(manualGenre&&selected.fallback)note='해당 분위기의 곡이 부족해 선택한 장르의 곡을 보여드려요.';
  else if(!manualGenre&&selected.matched<selected.rows.length)note='제목·가사에서 분위기가 맞는 곡을 먼저 고르고, 나머지는 장르별 어울림을 참고해 채웠어요.';
 }
 preview(manualPreview,selected.rows,startManual,note);
 return selected;
}
let plan=null;
function listeningPlan(){
 const orderFor=musicWindow?.NoaBrowse?.orderFor;
 if(plan?.records===records&&plan.state===state&&plan.orderFor===orderFor)return plan;
 const choices=model.genreSuggestions(records,state.theme,state.genres,state.profile?.genre,orderFor);
 const reserved=new Set(choices.map(choice=>model.recordingId(choice.selection.rows[0])));
 for(const g of Object.keys(state.genres)){
  const first=model.manualGenre(records,g,orderFor).rows[0];
  if(first)reserved.add(model.recordingId(first));
 }
 plan={records,state,orderFor,choices,whole:model.wholeCatalogMix(records,state.theme,reserved)};
 return plan;
}
function startChoice(choice,rows){
 mode='now';mood='auto';scope='recommendedGenre';genre=choice;play(rows,false);
}
let renderedPlan;
function renderGenreChoices(){
 const personal=state?.theme?.personal,ready=catalogReady();
 const plan=personal&&ready?listeningPlan():null,rows=plan?.whole.rows||[];
 mixButton.disabled=!!personal&&(!ready||!rows.length);
 mixButton.setAttribute('aria-pressed',String(isGlobalMix()));
 mixButton.lastChild.textContent=personal?(ready?'추천 '+rows.length+'곡 듣기':'추천곡 준비 중'):(state.member?'공감 추천 설정':'로그인하고 추천받기');
 for(const pick of genreCards.querySelectorAll('[data-genre-choice]'))pick.setAttribute('aria-pressed',String(isRecommendedGenreMix()&&genre===pick.dataset.genreChoice));
 if(plan&&renderedPlan===plan)return;
 renderedPlan=plan;
 preview(wholePreview,rows,queue=>{scope='all';mode='now';mood='auto';play(queue,true);});
 genreCards.replaceChildren();
 genreHint.textContent=!personal?'추천 설정을 마치면 오늘 어울리는 장르를 볼 수 있어요.':plan&&!plan.choices.length?'재생 가능한 추천 장르가 없어요.':'';
 for(const {genre:g,selection} of plan?.choices||[]){
  const item=el('article','nl-genre-option'),title=el('h4','',state.genres[g]);
  const go=button(selection.rows.length+'곡 듣기','play',()=>startChoice(g,selection.rows));go.classList.add('nl-play-action');go.dataset.genreChoice=g;
  go.setAttribute('aria-label',state.genres[g]+' 추천 '+selection.rows.length+'곡 듣기');go.setAttribute('aria-pressed',String(isRecommendedGenreMix()&&genre===g));
  const tracks=el('div','nl-preview');preview(tracks,selection.rows,queue=>startChoice(g,queue));
  item.append(title,go,tracks);genreCards.append(item);
 }
}
const listen=button('공감 추천 듣기','play',playWholeCatalog);listen.classList.add('nl-primary');listen.disabled=true;
if(!home){
 const discovery=host.closest('.nl-music-discovery');
 if(discovery){const toggle=discovery.querySelector('summary');toggle.replaceChildren(el('span','nl-discovery-title',toggle.textContent.trim()));
  const row=el('div','nl-listen-row');discovery.before(row);row.append(discovery,listen);}
}
const browse=lane('browse','곡 둘러보기','선택한 장르에서 인기곡과 최신 음원, 앨범을 찾아보세요.');
const tabs=el('div','nl-tabs');tabs.setAttribute('role','group');tabs.setAttribute('aria-label','선곡 방식');for(const [key,label]of Object.entries({now:'빠른 선곡',popular:'인기곡',latest:'최신 음원',albums:'추천 앨범',library:'내 보관함'})){const b=el('button','',label);b.type='button';b.dataset.mode=key;b.onclick=()=>{mode=key;if(key!=='now')scope='genre';render();};tabs.append(b);}browse.append(tabs);
const results=el('div','nl-results');browse.append(results);
const more=el('a','nl-catalog','카테고리별 음원 찾기 →');more.href=home?'/noa-music.php#music-browse':'#music-browse';if(!home)more.onclick=()=>{const panel=host.closest('.nl-music-discovery');if(panel)panel.open=false;window.NoaMusic?.showCategories();};browse.append(more);
const info=el('details','nl-basis');info.append(el('summary','','추천 기준'));const infoText=el('p');info.append(infoText);host.append(info);
function isRecommendedGenreMix(){return scope==='recommendedGenre'&&mode==='now'&&mood==='auto'&&state?.theme?.personal===true;}
function songButton(row,onPlay){const b=el('button','nl-track');b.type='button';const art=el('img');art.alt='';art.loading='lazy';if(row.thumb)art.src=row.thumb;else art.hidden=true;b.append(art,trackCopy(row,b,true),icon('play'));b.setAttribute('aria-label',row.title+' 재생');b.onclick=onPlay;return b;}
const fortuneIntro='생년월일을 입력하면 나에게 맞는 음악과 오늘의 운세를 볼 수 있어요. 원하면 매일 오전 8시(한국 시간)에 운세 알림도 받을 수 있어요.';
const fortuneSetupUrl='/?setup=fortune#noa-daily-fortune';
const fortuneCard=home?document.getElementById('noa-daily-fortune'):null;let lastFortune='',anchorHandled=false;
function renderFortune(){
 if(!fortuneCard)return;const f=state?.fortune,p=state?.profile,signature=JSON.stringify([f,!!p?.fortuneAlerts]);
 if(signature===lastFortune)return;lastFortune=signature;fortuneCard.replaceChildren();fortuneCard.hidden=false;
 if(!f){
  const title=el('h2','','오늘의 운세');title.id='nl-fortune-heading';
  const actions=el('div','nl-fortune-actions');
  actions.append(button('생년월일 설정하기','settings',()=>openSettings(true)));
  fortuneCard.append(title,el('p','',fortuneIntro),actions);
  return;
 }
 const h=el('h2','','오늘의 운세');h.id='nl-fortune-heading';const date=el('time','nl-fortune-date',f.date.replace(/-/g,'. ')+' · 한국 기준');date.dateTime=f.date;
 const head=el('div','nl-fortune-head');head.append(h,date);const action=button(p.fortuneAlerts?'오전 8시 알림 설정':'오전 8시 알림 받기','settings',()=>openSettings(true));
 const foot=el('div','nl-fortune-actions');foot.append(action);if(p.fortuneAlerts){const a=el('a','','이 기기 알림 연결');a.href='/noa-notifications.php#nnt-phone-title';foot.append(a);}
 fortuneCard.append(head,el('h3','',f.headline),el('p','',f.body),el('p','nl-fortune-tip','오늘의 제안 · '+f.tip),el('small','','태어난 날과 오늘의 일간을 바탕으로 가볍게 즐기는 운세예요.'),foot);
 if(!anchorHandled&&!new URLSearchParams(location.search).has('setup')&&location.hash==='#noa-daily-fortune'){anchorHandled=true;requestAnimationFrame(()=>fortuneCard.scrollIntoView());}
}
function render(){if(!state)return;
 renderFortune();renderGenreChoices();renderManual();listen.disabled=mixButton.disabled;
 for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.mode===mode));
 browse.hidden=!state.member;results.replaceChildren();
 infoText.textContent='곡의 제목과 가사, 분위기를 살펴 추천해요. 개인 추천을 켜면 입력한 출생 정보와 시간대도 선곡에 참고해요.';
 if(!state.member){status.textContent='로그인하면 음원을 들을 수 있어요.';return;}
 if(!catalogReady()){
  status.textContent=usesVideo()?(videoLoadFailed?'공개 유튜브 영상을 불러오지 못했어요.':'공개 유튜브 영상을 찾고 있어요.'):'음원 목록을 연결하고 있어요.';
  if(usesVideo()&&videoLoadFailed)status.append(button('다시 불러오기','music',connect));
  return;
 }
 const browseGenre=manualGenre||genre,options={genre:browseGenre,mood:manualMood||'auto',mode,theme:state.theme,popular:state.popular,library:state.library};
 if(mode==='albums'){
  for(const album of model.albums(records,browseGenre,options))results.append(button('ACT '+album.act+' · '+album.rows.length+'곡 듣기','play',()=>{scope='genre';genre=browseGenre;play(album.rows,false);}));
  for(const item of results.children)item.classList.add('nl-album');
 }else{
  const selection=model.select(records,options);
  for(const row of selection.rows.slice(0,10)){
   results.append(songButton(row,()=>{scope='genre';genre=browseGenre;mood=options.mood;play([row,...selection.rows.filter(r=>r.key!==row.key)],false);}));
  }
 }
 status.textContent=usesVideo()?(records.length?'추천곡은 공개 유튜브 영상으로 재생돼요.':'현재 재생할 수 있는 공개 유튜브 영상이 없어요.') : '';
}
const originalHome=new URL(location.href);
let homeDock=false,hasStarted=false;
function fitHomeDock(){
 if(!homeDock||!frame||!musicWindow)return;
 const doc=musicWindow.document,dock=doc.querySelector('.noa-two-line');
 if(!dock||dock.hidden){frame.hidden=true;document.documentElement.style.removeProperty('--nl-home-dock-space');return;}
 frame.hidden=false;
 document.documentElement.style.setProperty('--nl-home-dock-space',dock.getBoundingClientRect().height+'px');
 const modal=doc.querySelector('dialog:modal');
 if(modal){frame.style.clipPath='none';return;}
 // Only the real player and its open control menu receive touches over the homepage.
 const rects=[dock,doc.getElementById('noa-dock-popover')].filter(el=>el&&!el.hidden).map(el=>el.getBoundingClientRect());
 const paths=rects.map(r=>'M '+r.left+' '+r.top+' H '+r.right+' V '+r.bottom+' H '+r.left+' Z');
 const shape='path("'+paths.join(' ')+'")';
 if(CSS.supports('clip-path',shape))frame.style.clipPath=shape;
 else frame.style.clipPath='inset('+Math.min(...rects.map(r=>r.top))+'px 0 '+Math.max(0,musicWindow.innerHeight-Math.max(...rects.map(r=>r.bottom)))+'px 0)';
}
if(home&&window===window.top){
 window.NoaListeningHost={
  href:()=>location.href,
  visit(href,push){
   const url=new URL(href,location.href);if(!frame||url.origin!==location.origin)return false;
   hasStarted=true;homeDock=url.pathname===originalHome.pathname&&url.search===originalHome.search;
   if(push&&url.href!==location.href)history.pushState({noaListeningHost:true},'',url);
   frame.hidden=false;document.documentElement.classList.toggle('nl-host-open',!homeDock);
   musicWindow.document.documentElement.classList.toggle('nl-home-docked',homeDock);
   if(homeDock)fitHomeDock();else{frame.style.removeProperty('clip-path');document.documentElement.style.removeProperty('--nl-home-dock-space');}
   return homeDock;
  }
 };
 window.addEventListener('popstate',()=>{if(hasStarted)musicWindow?.NoaPlayerShell?.open(location.href,false);});
 window.addEventListener('resize',fitHomeDock);
 document.addEventListener('click',event=>{
  if(!homeDock||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const a=event.target.closest?.('a[href]');if(!a||a.hasAttribute('download')||(a.target&&a.target!=='_self')||a.getAttribute('href').startsWith('#'))return;
  if(!musicWindow?.document.querySelector('.noa-two-line:not([hidden])'))return;
  if(musicWindow.NoaPlayerShell?.open(a.href))event.preventDefault();
 });
}
function showShell(){
 if(frame&&musicWindow?.NoaPlayerShell)musicWindow.NoaPlayerShell.open('/noa-music.php?from=home');
}
document.querySelector('[data-noa-listen-now]')?.addEventListener('click',event=>{event.preventDefault();if(!state){host.scrollIntoView({block:'center'});return;}if(state.theme?.personal&&!mixButton.disabled){playWholeCatalog();return;}if(!state.canPlay||musicWindow){scope='genre';mode='now';mood='auto';play(model.select(records,{genre,mood,mode,theme:state.theme}).rows,false);}else host.scrollIntoView({block:'start'});});
function playPublicVideos(rows){
 const ids=[...new Set(rows.map(row=>row.publicVideoId).filter(id=>/^[A-Za-z0-9_-]{11}$/.test(id)))];
 if(!ids.length){status.textContent='이 선택으로 들을 수 있는 공개 유튜브 영상이 없어요.';return;}
 videoDialog?.close();
 const dialog=el('dialog','nl-dialog nl-video-dialog');videoDialog=dialog;
 const label='공개 유튜브 · '+ids.length+'곡';dialog.setAttribute('aria-label',label);
 const head=el('div','nl-dialog-head');head.append(el('h2','',label),button('닫기','close',()=>dialog.close()));
 const embed=el('iframe');embed.title='추천곡 유튜브 플레이어';embed.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';embed.allowFullscreen=true;embed.referrerPolicy='strict-origin-when-cross-origin';
 const url=new URL('https://www.youtube.com/embed/'+ids[0]);url.searchParams.set('autoplay','1');url.searchParams.set('playsinline','1');
 if(ids.length>1)url.searchParams.set('playlist',ids.slice(1).join(','));
 embed.src=url.href;
 const original=el('a','','첫 곡을 YouTube에서 열기');original.href='https://www.youtube.com/watch?v='+ids[0];original.target='_blank';original.rel='noopener noreferrer';
 dialog.append(head,embed,original);document.body.append(dialog);
 dialog.addEventListener('close',()=>{dialog.remove();if(videoDialog===dialog)videoDialog=null;},{once:true});
 window.dispatchEvent(new CustomEvent('noa-media-activity',{detail:{type:'youtube',key:ids[0]}}));
 dialog.showModal();status.textContent=label;
}
function play(rows,acrossGenres=isGlobalMix()){if(!state?.member){location.href='/bbs/login.php?url='+encodeURIComponent('/noa-music.php#noa-listening');return;}if(usesVideo()){playPublicVideos(rows);return;}if(!rows.length||!musicWindow?.NoaMusic)return;showShell();try{const keys=rows.map(r=>r.key);const music=musicWindow.NoaMusic;const ok=scope==='catalogMood'?music.playMoodMix(keys,mood):acrossGenres?music.playRecommendedMix(keys):isRecommendedGenreMix()?music.playRecommendedGenre(keys,genre):music.playQueue(keys,genre,{mood,mode});status.textContent=ok?music.listeningSelection().label+' · 재생을 시작합니다.':'재생 가능한 음원을 다시 확인해 주세요.';}catch{status.textContent='재생 연결이 끊겼습니다. 새로고침 후 다시 시도해 주세요.';}}
function attachPlayer(win){
 musicWindow=win;
 win.removeEventListener('noa-listening-selection',syncSelection);
 win.addEventListener('noa-listening-selection',syncSelection);
 records=win.NoaMusic.catalog();
 syncSelection();
}
function syncSelection(){
 const source=musicWindow?.NoaMusic?.listeningSelection();
 if(source&&state&&(!source.genre||state.genres[source.genre])){
  scope=source.scope;genre=source.genre||genre;mode=source.mode;mood=source.mood;
  if(scope==='catalogMood'){manualGenre='';manualMood=mood;}
 }
 render();
}
async function connect(){
 const request=++videoRequest;
 if(usesVideo()){
  if(frame){frame.remove();frame=null;homeDock=false;hasStarted=false;document.documentElement.classList.remove('nl-host-open');document.documentElement.style.removeProperty('--nl-home-dock-space');}
  musicWindow=null;videoLoadFailed=false;
  try{
   const response=await fetch('/noa-bridge/listening-videos.php',{credentials:'same-origin',cache:'no-store'});
   if(!response.ok)throw Error();const data=await response.json();if(!Array.isArray(data.videos))throw Error();
   if(request!==videoRequest||!usesVideo())return;
   records=data.videos;videoReady=true;
  }catch{if(request!==videoRequest||!usesVideo())return;records=[];videoReady=false;videoLoadFailed=true;}
  render();return;
 }
 if(videoReady||videoLoadFailed){videoDialog?.close();records=[];videoReady=false;videoLoadFailed=false;}
 if(!state.member)return;

 if(window.NoaMusic){attachPlayer(window);return;}
 try{if(window.parent!==window&&window.parent.NoaMusic){attachPlayer(window.parent);return;}}catch{}
 if(!home||!state.member)return;
 if(!frame){frame=el('iframe','nl-play-shell');frame.title='NOA STUDIO 음악 재생';frame.hidden=true;frame.allow='autoplay';frame.src='/noa-music.php?listenHost=1';frame.addEventListener('load',()=>{try{if(!frame.contentWindow.NoaMusic)throw Error();attachPlayer(frame.contentWindow);
 const doc=musicWindow.document,dock=doc.querySelector('.noa-two-line'),popup=doc.getElementById('noa-dock-popover'),queue=doc.getElementById('dock-queue');
 const sizes=new ResizeObserver(fitHomeDock),visibility=new MutationObserver(fitHomeDock);
 for(const el of [dock,popup,queue].filter(Boolean)){sizes.observe(el);visibility.observe(el,{attributes:true,attributeFilter:['hidden','open','style']});}
 render();}catch{status.textContent='음원 연결을 불러오지 못했어요. 전체 음원에서 다시 열어 주세요.';listen.disabled=true;}});document.body.append(frame);}
}
genres.onchange=()=>{manualGenre=genres.value;try{sessionStorage.setItem('noa-listening-genre',manualGenre);}catch{}render();};
async function load(){const sequence=++loadSequence;try{const response=await fetch('/noa-bridge/listening.php',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(sequence!==loadSequence)return;const initial=!state;state=data;const oldGenre=genre;genres.replaceChildren();const placeholder=el('option','','전체 장르');placeholder.value='';genres.append(placeholder);for(const [key,label]of Object.entries(state.genres)){const o=el('option','',label);o.value=key;genres.append(o);}let saved='';try{saved=sessionStorage.getItem('noa-listening-genre')||'';}catch{}const query=new URLSearchParams(location.search).get('genre');if(initial&&query&&state.genres[query])scope='genre';genre=[initial&&query,!initial&&oldGenre,saved,state.profile?.genre,'kpop-original'].find(g=>state.genres[g])||'kpop-original';render();connect();
 if(home&&!anchorHandled){
  const requested=new URLSearchParams(location.search).get('setup')==='fortune';
  let pending=0;try{pending=Number(sessionStorage.getItem('noa-fortune-setup-until'));}catch{}
  if(state.member&&(requested||pending>Date.now())){
   anchorHandled=true;try{sessionStorage.removeItem('noa-fortune-setup-until');}catch{}
   if(requested){const clean=new URL(location.href);clean.searchParams.delete('setup');history.replaceState(history.state,'',clean);}
   openSettings(true);
  }else if(requested){anchorHandled=true;signInForFortune();}
 }
 }catch{status.textContent='추천을 불러오지 못했어요. 전체 음원은 계속 이용할 수 있습니다.';listen.disabled=true;settings.disabled=true;}}
function signInForFortune(){
 try{sessionStorage.setItem('noa-fortune-setup-until',String(Date.now()+15*60*1000));}catch{}
 location.replace('/bbs/login.php?url='+encodeURIComponent(fortuneSetupUrl));
}
function openSettings(fortuneSetup=false){const trigger=document.activeElement;if(!state?.member){
 if(fortuneSetup)signInForFortune();else location.href='/bbs/login.php?url='+encodeURIComponent('/noa-music.php#noa-listening');return;
}
 const dialog=el('dialog','nl-dialog');dialog.setAttribute('aria-label','개인 추천 설정');const form=el('form');const header=el('div','nl-dialog-head');header.append(el('h2','','개인 추천 설정'),button('닫기','close',()=>dialog.close()));form.append(header,el('p','nl-note',fortuneIntro));
 const p=state.profile||{};
 function field(label,name,type,value,options){const wrap=el('label','nl-field',label);let input;if(options){input=el('select');for(const [v,t]of Object.entries(options)){const o=el('option','',t);o.value=v;input.append(o);}}else{input=el('input');input.type=type;}input.name=name;input.value=value??'';wrap.append(input);return {wrap,input};}
 const gf=field('기본 장르','genre','',p.genre||genre,state.genres);form.append(gf.wrap);
 const zones={'Asia/Seoul':'한국 · 서울','Asia/Tokyo':'일본 · 도쿄','Asia/Shanghai':'중국 · 상하이','Asia/Bangkok':'태국 · 방콕','America/Los_Angeles':'미국 · 로스앤젤레스','America/New_York':'미국 · 뉴욕','Europe/London':'영국 · 런던','Australia/Sydney':'호주 · 시드니'};let detected='Asia/Seoul';try{detected=Intl.DateTimeFormat().resolvedOptions().timeZone;}catch{}for(const z of [detected,p.timezone,p.birthTimezone].filter(Boolean))if(!zones[z])zones[z]=z;
 const tz=field('현재 생활 시간대','timezone','',p.timezone||detected,zones);form.append(tz.wrap);
 const agree=el('label','nl-consent'),consent=el('input');consent.type='checkbox';consent.checked=!!p.consent;agree.append(consent,document.createTextNode('생년월일과 출생시간을 저장해 음악 추천과 오늘의 운세에 사용하는 데 동의합니다.'));form.append(agree);
 const birth=el('fieldset','nl-birth');birth.append(el('legend','','출생 정보'));const calendar=field('생일 기준','calendar','',p.calendar||'solar',{solar:'양력',lunar:'한국 음력'});const date=field('생년월일','birthDate','text',p.birthDate);date.input.inputMode='numeric';date.input.placeholder='예: 19900615';date.input.autocomplete='off';const dateHint=el('small','nl-note','숫자 8자리로 입력해 주세요. 예: 19900615 또는 1990-06-15');dateHint.id='nl-birth-date-hint';date.input.setAttribute('aria-describedby',dateHint.id);date.wrap.append(dateHint);date.input.oninput=()=>date.input.setCustomValidity('');date.input.onblur=()=>{const normalized=model.normalizeBirthDate(date.input.value);if(normalized)date.input.value=normalized;};const leap=field('윤달','leap','',p.leap?'yes':'no',{no:'평달',yes:'윤달'});const time=field('태어난 시간 · 모르면 비워두세요','birthTime','time',p.birthTime);const bz=field('출생지 시간대','birthTimezone','',p.birthTimezone||'Asia/Seoul',zones);
 birth.append(calendar.wrap,date.wrap,leap.wrap,time.wrap,bz.wrap,el('p','nl-note','한국 음력은 1900~2050년을 지원합니다. 출생지 표준시를 사용하며, 시간을 모르면 시주는 제외합니다.'));const alertLabel=el('label','nl-fortune-opt'),alerts=el('input');alerts.type='checkbox';alerts.name='fortuneAlerts';alerts.checked=p.fortuneAlerts===true;alertLabel.append(alerts,document.createTextNode('매일 오전 8시(한국 시간)에 오늘의 운세 한 줄 받기'));birth.append(alertLabel,el('small','nl-note','알림함에 도착하며, 휴대폰에서도 받으려면 저장 후 홈의 ‘이 기기 알림 연결’에서 알림을 켜 주세요.'));form.append(birth);
 const toggle=()=>{date.input.setCustomValidity('');birth.disabled=!consent.checked;birth.hidden=!consent.checked;date.input.required=consent.checked;leap.input.disabled=calendar.input.value!=='lunar';if(calendar.input.value==='solar')leap.input.value='no';};consent.onchange=toggle;calendar.input.onchange=toggle;toggle();
 form.append(el('p','nl-note',state.theme.notice));const message=el('p','nl-status');message.setAttribute('role','status');form.append(message);const actions=el('div','nl-dialog-actions'),save=button('저장','save',()=>{}),remove=button('추천 설정 삭제','trash',()=>submit('DELETE'));save.type='submit';actions.append(remove,save);form.append(actions);
 async function submit(method){if(method==='POST'){date.input.setCustomValidity('');if(consent.checked){const normalized=model.normalizeBirthDate(date.input.value);if(normalized)date.input.value=normalized;else date.input.setCustomValidity('생년월일을 숫자 8자리로 입력해 주세요. 예: 19900615');}if(!form.reportValidity())return;}save.disabled=remove.disabled=true;message.textContent='저장하고 있어요.';try{const profile={genre:gf.input.value,timezone:tz.input.value,consent:consent.checked,fortuneAlerts:consent.checked&&alerts.checked,birthDate:date.input.value,calendar:calendar.input.value,leap:leap.input.value==='yes',birthTime:time.input.value,birthTimezone:bz.input.value};const r=await fetch('/noa-bridge/listening.php',{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-CSRF':state.csrf},body:JSON.stringify({revision:state.revision,profile})});const data=await r.json();if(!r.ok)throw Error(data.error);++loadSequence;state=data;genre=data.profile?.genre||genre;try{sessionStorage.setItem('noa-listening-genre',genre);}catch{}render();dialog.close();status.textContent=method==='DELETE'?'저장된 생년정보와 개인 추천 설정을 삭제했습니다.':'개인 추천 설정을 저장했습니다.';}catch(e){message.textContent=({invalid_birth:'생년월일과 출생시간을 확인해 주세요.',invalid_lunar_date:'음력 날짜와 윤달 여부를 확인해 주세요.',future_birth:'미래 생일은 입력할 수 없습니다.',revision_conflict:'다른 창에서 설정이 바뀌었습니다. 창을 닫고 다시 열어 주세요.'})[e.message]||'설정을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';if(e.message==='revision_conflict')load();}finally{save.disabled=remove.disabled=false;}}
 form.onsubmit=e=>{e.preventDefault();submit('POST');};dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>{dialog.remove();(trigger?.isConnected?trigger:settings).focus();},{once:true});dialog.showModal();
}
setInterval(()=>{if(!document.hidden&&!document.querySelector('.nl-dialog')&&state?.theme?.validUntil*1000<Date.now())load();},60000);
load();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state?.theme?.validUntil*1000<Date.now())load();});
})();
