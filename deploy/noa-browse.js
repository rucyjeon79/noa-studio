/* One hierarchy for existing song/video records; administrator order edits are delegated. */
(()=>{'use strict';
const groups=[['original','오리지널송',['kpop-original','jpop-original','pop-original','thai-original']],['ep','EP 컬렉션',['joseon-ballad','echoes-of-joseon','groovy-airy-pop','narrative-piano-indie','dreamy-deep-house','fantasy-ambient-edm','edm-kpop-club','latin-afrobeats-edm','panpop']],['story','당신의 이야기, 우리의 음악',['your-story']],['cover','AInoa의 유명곡 커버',['cover-reborn']]];
const names={'kpop-original':'K-POP Original','jpop-original':'J-POP Original','pop-original':'POP Original','thai-original':'Thai Original','joseon-ballad':'Joseon Ballad','echoes-of-joseon':'Echoes of Joseon','groovy-airy-pop':'Groovy Airy Pop','narrative-piano-indie':'Narrative Piano Indie','dreamy-deep-house':'Dreamy Deep House','fantasy-ambient-edm':'Fantasy Ambient EDM','edm-kpop-club':'EDM K-POP Club','latin-afrobeats-edm':'Latin Afrobeats EDM',panpop:'PANPOP','your-story':'당신의 이야기, 우리의 음악 🎧','cover-reborn':'🎤 AInoa의 유명곡 커버'};
const genrePosters={"kpop-original":"kpop-original-g2","jpop-original":"jpop-original-g2","pop-original":"pop-original-g2","thai-original":"thai-original-g2","joseon-ballad":"joseon-g2","panpop":"panpop-g2","echoes-of-joseon":"rain-g2","latin-afrobeats-edm":"latin-g2","edm-kpop-club":"hall-g2","dreamy-deep-house":"dream-g2","fantasy-ambient-edm":"fantasy-g2","groovy-airy-pop":"bridge-g2","narrative-piano-indie":"room-g2","your-story":"your-story-g2","cover-reborn":"cover-reborn-g2"};
const genreArt=g=>genrePosters[g]?"/noa-assets/splash/"+genrePosters[g]+"-a.jpg":"/noa-assets/papa-logo.png";
const groupFor=g=>groups.find(x=>x[2].includes(g))?.[0]||null;
const actFor=r=>Number(r.act)>0?Number(r.act):Number(r.ep)>0?Math.ceil(Number(r.ep)/10):null;
const epOrder=(a,b)=>{const ea=Number(a.ep),eb=Number(b.ep);return (ea>0?ea:Number.MAX_SAFE_INTEGER)-(eb>0?eb:Number.MAX_SAFE_INTEGER);};
let manualOrder={story:[],cover:[]};
const orderFor=(a,b)=>{const ga=groupFor(a.genre),gb=groupFor(b.genre);if(ga===gb&&(ga==='story'||ga==='cover')){if(Number(a.ep)>0||Number(b.ep)>0)return epOrder(a,b);const keys=manualOrder[ga]||[],ia=keys.indexOf(String(a.orderKey||a.key).replace(/^catalog:/,'')),ib=keys.indexOf(String(b.orderKey||b.key).replace(/^catalog:/,''));return (ia<0?Number.MAX_SAFE_INTEGER:ia)-(ib<0?Number.MAX_SAFE_INTEGER:ib);}return epOrder(a,b);};

const slicePage=(rows,page,size=24)=>rows.slice(Math.max(0,page)*size,(Math.max(0,page)+1)*size);
function mount({host,rows,onChange,search=null,genre=null,type=null,kind='곡'}){
 if(kind!=='영상')rows=rows.filter(r=>r.kind!=='video'&&!r.video);
 const e=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const params=new URLSearchParams(location.search);let selectedGenre=genre?.value||params.get('genre')||'',selectedGroup=groupFor(selectedGenre)||(groups.some(g=>g[0]===params.get('group'))?params.get('group'):''),selectedAct=Number(params.get('act'))||0,page=0;
 let expandedAct=null;let stage=selectedGenre?'acts':selectedGroup?'genres':'groups';if(params.get('view')==='all'||params.has('world')||params.get('type')||params.get('track')||params.get('playlist'))stage='songs';if(params.get('type')==='playlist')stage='collections';if(selectedAct&&selectedGenre&&!params.get('track'))stage='acts';expandedAct=selectedAct||null;let initialLevel=stage==='acts'?(expandedAct?4:3):stage==='genres'?2:0;
 const crumbs=e('nav'),grid=e('div'),pager=e('nav'),note=e('p'),all=e('button',kind==='영상'?'전체 영상':'전체 음원');crumbs.className='noa-browse-crumbs';crumbs.setAttribute('aria-label','라이브러리 경로');grid.className='noa-browse-levels';pager.className='noa-browse-pager';pager.setAttribute('aria-label','음악 목록 페이지');note.className='noa-muted';all.className='noa-browse-all';all.type='button';all.onclick=()=>navigate('songs','','',0);host.replaceChildren(crumbs,grid,note,pager);
 function translate(text){return window.NoaUI?.translate(text)||text;}
 function sync(){if(genre)genre.value=selectedGenre;if(type)type.value='';}
 function showLevel(level){
  if(typeof window.requestAnimationFrame!=='function')return;
  window.requestAnimationFrame(()=>{
   const target=host.querySelector('[data-browse-level="'+level+'"]');
   const visibleTarget=level===4?target?.closest('.noa-inline-act'):target;
   visibleTarget?.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
  });
 }
 function navigate(next,group='',g='',act=0){expandedAct=act||null;stage=next;selectedGroup=group;selectedGenre=g;selectedAct=act;page=0;if(search)search.value='';sync();const u=new URL(location.href);for(const key of ['group','genre','act','view','page','track','type','playlist'])u.searchParams.delete(key);if(group)u.searchParams.set('group',group);if(g)u.searchParams.set('genre',g);if(act)u.searchParams.set('act',String(act));if(next==='songs'&&!group&&!g)u.searchParams.set('view','all');history.replaceState(null,'',u);onChange();if(next==='genres')showLevel(2);else if(next==='acts')showLevel(3);else if(next==='groups')showLevel(1);}
 function button(text,action){const b=e('button',text);b.type='button';b.onclick=action;return b;}
 function idsForGenreTitle(title){return Object.values(names).includes(title);}
 function card(title,subtitle,items,action){const b=button('',action);b.className='noa-browse-card';const r=items.find(r=>r.video||r.thumb),g=items.find(r=>names[r.genre]);const matchedGenre=Object.keys(names).find(id=>names[id]===title)||g?.genre;const img=e('img');img.alt='';img.loading='lazy';img.src=matchedGenre&&idsForGenreTitle(title)?genreArt(matchedGenre):(r?(r.video?('/noa-bridge/youtube-thumbnail.php?id='+encodeURIComponent(r.video)):r.thumb):genreArt(matchedGenre||''));if(!r)img.className='noa-genre-art';img.onerror=()=>{img.onerror=null;img.src='/noa-assets/papa-logo.png';};b.append(img);const copy=e('span');copy.append(e('strong',translate(title)),e('small',subtitle));b.append(copy);return b;}
 function matches(r){if(search?.value.trim())return true;if(stage!=='songs'&&stage!=='acts')return false;if(stage==='acts'&&expandedAct===null)return false;if(selectedGroup&&groupFor(r.genre)!==selectedGroup)return false;if(selectedGenre&&r.genre!==selectedGenre)return false;if((stage==='acts'?expandedAct:selectedAct)===-1&&actFor(r))return false;if((stage==='acts'?expandedAct:selectedAct)>0&&actFor(r)!==(stage==='acts'?expandedAct:selectedAct))return false;return true;}
 // Keep a single real player. Expand it beside the selected row, without moving the audio engine.
 let playbackKey='',playbackPanel=null,treeRevision='',orderEditor=null;
 function refreshOrderEditor(){orderEditor?.refresh();}
 function placePlayback(anchor,record){
  if(kind!=='영상'||!anchor)return;
  if(!playbackPanel){
   playbackPanel=e('section');playbackPanel.className='noa-inline-playback';playbackPanel.setAttribute('aria-label',kind==='영상'?'선택한 영상 재생':'선택한 곡 재생');
   const style=e('style');style.textContent='.noa-inline-playback{grid-column:1/-1;min-width:0;padding:12px 0 20px;overflow-wrap:anywhere}.noa-inline-playback>.noa-inline-art{display:block;width:100%;max-height:420px;aspect-ratio:16/9;object-fit:contain;background:var(--noa-bg)}.noa-inline-playback>.noa-inline-art[hidden]{display:none}.noa-inline-playback #yt-player,.noa-inline-playback section.detail{margin:0;padding:12px 0;border:0;border-radius:0;background:transparent}.noa-inline-playback #yt-frame{display:block;width:100%;aspect-ratio:16/9;height:auto}.noa-inline-song[aria-expanded="true"]{color:var(--noa-success,#34C785)}';host.append(style);
  }
  for(const row of host.querySelectorAll('.noa-inline-song[aria-expanded="true"]'))row.setAttribute('aria-expanded','false');
  if(anchor.classList.contains('noa-inline-song'))anchor.setAttribute('aria-expanded','true');
  playbackKey=String(record.key);playbackPanel.dataset.playbackKey=playbackKey;playbackPanel.style.order=anchor.style.order||'';
  // Insert before starting playback: moving an already playing iframe would reload it.
  if(anchor.nextElementSibling!==playbackPanel)anchor.after(playbackPanel);
  const nodes=[document.getElementById('yt-player')];
  for(const node of nodes)if(node&&node.parentElement!==playbackPanel)playbackPanel.append(node);
 }
 function showPlayback(){
  if(!playbackPanel)return;
  window.requestAnimationFrame?.(()=>{if(playbackPanel?.isConnected){const anchor=playbackPanel.previousElementSibling;anchor?.scrollIntoView({block:'start',behavior:'instant'});}});
 }
 function restoreInlinePlayback(){
  if(!playbackPanel)return;
  const row=[...host.querySelectorAll('.noa-inline-song')].find(n=>n.dataset.inlineKey===playbackKey);
  if(row){const record=rows.find(r=>String(r.key)===playbackKey);if(record)placePlayback(row,record);}
 }
 function anchorFor(record){
  return [...host.querySelectorAll('.noa-inline-song')].find(n=>n.dataset.inlineKey===String(record.key))||(stage==='songs'?[...document.querySelectorAll('[data-browse-key],.song[data-key]')].find(n=>(n.dataset.browseKey||n.dataset.key)===String(record.key)):null);
 }
 // Queue/next-track selection uses the same expansion while the fixed transport stays available.
 if(kind!=='영상')window.addEventListener('noa-track-selected',event=>{const record=event.detail?.record;if(record)for(const row of host.querySelectorAll('.noa-inline-song'))row.setAttribute('aria-pressed',String(row.dataset.inlineKey===String(record.key)));});
 function placeVisibleSelection(event){
  if(kind!=='영상')return;const action=event.target.closest('[data-video]');if(!action)return;
  const source=action.closest('[data-browse-key],.song[data-key]')||action;
  if(source.closest('[hidden]'))return;
  const key=source.dataset.browseKey||source.dataset.key||action.dataset.video,record=rows.find(r=>String(r.key)===key);
  if(record){placePlayback(source,record);showPlayback();}
 }
 // Also cover search results and the full catalog; capture mounts before the iframe starts.
 document.addEventListener?.('click',placeVisibleSelection,true);
 document.addEventListener?.('click',placeVisibleSelection);
 // Mirror only server-authorized controls; original handlers keep upload/download ownership.
 const rawSongs=new Map([...document.querySelectorAll('.song[data-key]')].map(node=>[node.dataset.key,node]));
 function addTrack(key){window.dispatchEvent(new CustomEvent('noa-playlist-add',{detail:{key}}));}
 // Reuse the native player and JUKEBOX icon shapes with the shared icon-over-label layout.
 function labelMusicAction(action,label){
  const paths={'재생':'m8 5 11 7-11 7V5Z','담기':'M12 5v14M5 12h14','다운로드':'M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4','교체':'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6','업로드':'M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6'};
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');for(const [name,value] of Object.entries({'aria-hidden':'true',focusable:'false',viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.5','stroke-linecap':'round','stroke-linejoin':'round'}))svg.setAttribute(name,value);
  const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[label]);svg.append(path);action.replaceChildren(svg,e('span',label));
 }
 function syncMusicActions(){
  if(kind==='영상'||!host.querySelectorAll)return;
  for(const [key,raw] of rawSongs){const actions=raw.querySelector('.jukebox-actions');if(actions&&!actions.querySelector('.noa-track-add')){const add=button('담기',()=>addTrack(key));add.className='noa-track-add noa-action';labelMusicAction(add,'담기');add.setAttribute('aria-label',(raw.dataset.title||key)+' 담기');actions.append(add);}}
  for(const wrapper of host.querySelectorAll('.noa-inline-song-row')){
   const raw=rawSongs.get(wrapper.dataset.inlineKey),tools=wrapper.querySelector('.noa-song-actions');if(!raw||!tools)continue;
   const definitions=[['.sound-play','재생'],['.noa-track-add','담기'],['.jukebox-download','다운로드'],['.jukebox-replace','교체'],['.sound-upload','업로드']];
   const signature=definitions.map(([selector])=>{const n=raw.querySelector(selector);return n?[selector,n.disabled,n.getAttribute('href'),n.getAttribute('aria-disabled')]:null;});const revision=JSON.stringify(signature);if(tools.dataset.revision===revision)continue;tools.dataset.revision=revision;tools.replaceChildren();
   for(const [selector,label] of definitions){const source=raw.querySelector(selector);if(!source&&label!=='재생')continue;const action=button(label,()=>raw.querySelector(selector)?.click());action.className='noa-song-action noa-action';labelMusicAction(action,label);action.disabled=!source||!!source.disabled||source.getAttribute('aria-disabled')==='true';action.setAttribute('aria-label',(raw.dataset.title||wrapper.dataset.inlineKey)+' '+label);tools.append(action);}
   tools.dataset.adminControls=String(tools.children.length>2);
  }
 }
 if(kind!=='영상'&&document.head){
  const style=e('style');style.textContent='html[data-noa-precision] .noa-inline-song-row{display:flex;align-items:center;gap:8px;min-width:0;border-bottom:1px solid var(--noa-line)}html[data-noa-precision] .noa-inline-song-row>.noa-inline-song{flex:1;min-width:0;width:auto;border-bottom:0}.noa-song-actions{display:flex;align-items:center;gap:4px;flex:none}.noa-page .noa-song-action,.noa-page .noa-track-add{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;min-width:44px;min-height:52px;padding:4px;font-size:12px;line-height:1.3;white-space:nowrap;border:1px solid var(--noa-line);border-radius:var(--noa-control-radius,8px);background:var(--noa-raised);color:var(--noa-text);cursor:pointer}.noa-page .noa-song-action>svg,.noa-page .noa-track-add>svg{width:20px;height:20px;flex:none}.noa-song-action:disabled{opacity:.5;cursor:default}@media(max-width:600px){.noa-song-actions[data-admin-controls="true"]{display:grid;grid-template-columns:repeat(2,minmax(52px,auto))}}';document.head.append(style);
  syncMusicActions();const source=document.getElementById('songs');if(source&&window.MutationObserver){let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;queueMicrotask(()=>{pending=false;syncMusicActions();});}).observe(source,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled','aria-disabled','href','data-audio','data-jukebox-status']});}
 }
 function renderInlineSongs(container,items){const list=e('div');list.className='noa-inline-songs';for(const record of items.slice().sort(orderFor)){const row=button((Number(record.ep)>0?'EP.'+Number(record.ep)+' · ':'')+(record.title||record.key),()=>{expandedAct=actFor(record)||-1;const target=[...document.querySelectorAll('[data-browse-key],.song[data-key]')].find(n=>(n.dataset.browseKey||n.dataset.key)===String(record.key));const action=target?.matches('button')?target:target?.querySelector('.sound-play')||target?.querySelector('button');if(action){placePlayback(row,record);action.click();restoreInlinePlayback();showPlayback();}else{navigate('songs',selectedGroup,selectedGenre,actFor(record)||-1);}});row.className='noa-inline-song';row.dataset.inlineKey=String(record.key);row.setAttribute('aria-expanded','false');const cover=record.thumb||(record.video?'/noa-bridge/youtube-thumbnail.php?id='+encodeURIComponent(record.video):'');if(cover){const image=e('img');image.className='noa-inline-cover';image.alt='';image.loading='lazy';image.src=cover;image.onerror=()=>{image.onerror=null;image.src='/noa-assets/papa-logo.png';};row.prepend(image);}row.setAttribute('aria-label',(record.title||record.key)+' '+(kind==='영상'?'영상 재생':'음원 선택'));if(kind==='영상'){const wrapper=e('div');wrapper.className='noa-inline-video-row';wrapper.dataset.inlineKey=String(record.key);wrapper.append(row);list.append(wrapper);}else{const wrapper=e('div');wrapper.className='noa-inline-song-row';wrapper.dataset.inlineKey=String(record.key);const tools=e('div');tools.className='noa-song-actions';tools.setAttribute('aria-label',(record.title||record.key)+' 조작');wrapper.append(row,tools);list.append(wrapper);}}container.append(list);}
 function renderTree(){
  const revision=JSON.stringify([stage,selectedGroup,selectedGenre,selectedAct,expandedAct,manualOrder]);if(revision===treeRevision)return;treeRevision=revision;
  if(playbackPanel&&grid.contains(playbackPanel))host.append(playbackPanel);
  crumbs.replaceChildren(button(translate(kind==='영상'?'YouTube':'음원'),()=>navigate('groups')));
  if(selectedGroup){const g=groups.find(g=>g[0]===selectedGroup);crumbs.append(e('span','/'),button(translate(g[1]),()=>navigate('genres',g[0])));}
  if(selectedGenre)crumbs.append(e('span','/'),button(names[selectedGenre]||selectedGenre,()=>navigate('acts',selectedGroup,selectedGenre)));
  if(selectedAct)crumbs.append(e('span','/'),e('strong',selectedAct===-1?'ACT 미소속 곡':'ACT '+selectedAct));
  crumbs.append(all);grid.replaceChildren();
  function level(number,title){const section=e('section');section.dataset.browseLevel=String(number);section.setAttribute('aria-label',title);const heading=e('h2',title),body=e('div');body.className='noa-browse-grid';section.append(heading,body);grid.append(section);return body;}
  function selected(card,active){card.setAttribute('aria-pressed',String(active));return card;}
  if(stage==='collections'){
   const body=level(3,'ACT 플레이리스트');
   for(const collection of rows.filter(r=>r.kind==='playlist'&&Number(r.act)>0)){const act=Number(collection.act),members=rows.filter(r=>r.genre===collection.genre&&actFor(r)===act&&r.kind!=='playlist');body.append(card((names[collection.genre]||collection.genre)+' · ACT '+act,members.length+'개 '+kind,members.length?members:[collection],()=>navigate('acts',groupFor(collection.genre),collection.genre,act)));}
  }else if(stage!=='songs'){
   const top=level(1,'카테고리');
   for(const[id,title,ids]of groups){const items=rows.filter(r=>ids.includes(r.genre));top.append(selected(card(title,items.filter(r=>r.kind!=='playlist').length+'개 '+kind,items,()=>navigate('genres',id)),selectedGroup===id));}
   if(selectedGroup){
    const genres=level(2,'장르'),group=groups.find(g=>g[0]===selectedGroup);
    for(const g of group?.[2]||[]){const items=rows.filter(r=>r.genre===g);genres.append(selected(card(names[g],items.filter(r=>r.kind!=='playlist').length+'개 '+kind,items,()=>navigate('acts',selectedGroup,g)),selectedGenre===g));}
   }
   if(selectedGenre){
    const body=level(3,'ACT 플레이리스트'),items=rows.filter(r=>r.genre===selectedGenre&&r.kind!=='playlist'),acts=[...new Set(items.map(actFor).filter(Boolean))].sort((a,b)=>a-b);
    for(const act of acts){
     const members=items.filter(r=>actFor(r)===act).sort(epOrder),a=(act-1)*10+1,b=act*10,section=e('div');section.className='noa-inline-act';
     const toggle=card('ACT '+act,'EP.'+a+'–'+b+' · '+members.length+'개 '+kind,members,()=>{expandedAct=expandedAct===act?null:act;onChange();if(expandedAct!==null)showLevel(4);});toggle.setAttribute('aria-expanded',String(expandedAct===act));section.append(toggle);
     if(expandedAct===act){const detail=e('div');detail.dataset.browseLevel='4';detail.setAttribute('aria-label','ACT '+act+' '+kind+' 목록');renderInlineSongs(detail,members);section.append(detail);}body.append(section);
    }
    const loose=items.filter(r=>!actFor(r));
    if(loose.length){const section=e('div');section.className='noa-inline-act';section.append(e('strong','ACT 미소속 곡 · '+loose.length+'개'));renderInlineSongs(section,loose);body.append(section);}
    if(!items.length)body.append(e('p','등록된 콘텐츠가 없습니다.'));
   }
  }
  grid.hidden=stage==='songs';restoreInlinePlayback();syncMusicActions();refreshOrderEditor();
 }
 function apply(candidates,force=false){if(force)stage='songs';renderTree();const filtered=(force?candidates:candidates.filter(matches)).slice();if(!force)filtered.sort(orderFor);const pages=Math.max(1,Math.ceil(filtered.length/24));page=Math.min(page,pages-1);pager.replaceChildren();if(filtered.length>24&&stage==='songs'){const prev=button('‹',()=>{page--;onChange();}),next=button('›',()=>{page++;onChange();});for(const[b,label]of[[prev,'이전 음악 페이지'],[next,'다음 음악 페이지']]){b.className='noa-icon-button';b.setAttribute('aria-label',label);}prev.disabled=page<=0;next.disabled=page>=pages-1;pager.append(prev,e('span',(page+1)+' / '+pages),next);}const counts=kind==='영상'?filtered.length+'개 영상':filtered.filter(r=>r.kind!=='playlist').length+'곡'+(filtered.some(r=>r.kind==='playlist')?' · ACT·목록 '+filtered.filter(r=>r.kind==='playlist').length+'개':'');note.textContent=stage==='songs'&&!filtered.length?'음악을 준비하고 있습니다.':stage==='songs'?counts+(filtered.length>24?' · 24개씩 표시':''):'장르와 ACT를 선택해 음악을 탐색하세요.';host.dataset.browseReady='true';if(initialLevel){const level=initialLevel;initialLevel=0;if(stage!=='songs')showLevel(level);}return{visible:slicePage(filtered,page),queue:filtered,stage};}
 if(search)search.addEventListener('input',()=>{page=0;if(search.value.trim()){stage='songs';selectedGroup='';selectedGenre='';selectedAct=0;sync();}onChange();});
 if(genre)genre.addEventListener('change',()=>{page=0;selectedGenre=genre.value;selectedGroup=groupFor(selectedGenre)||'';selectedAct=0;stage=selectedGenre?'acts':'groups';onChange();});
 if(type)type.addEventListener('change',()=>{page=0;stage=type.value==='playlist'?'collections':'songs';onChange();});
 window.addEventListener('noa-theme',()=>{if(orderEditor?.isEditing?.())return;treeRevision='';onChange();});
 fetch('/noa-category-order.php',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{if(data){manualOrder={story:data.story||[],cover:data.cover||[]};onChange();if(data.admin===true&&data.csrf){const start=()=>{orderEditor=window.NoaBrowseOrder.mount({host,rows,kind,access:data,getOrder:()=>manualOrder,getGroup:()=>selectedGroup,onSaved:confirmed=>{manualOrder={story:confirmed.story||[],cover:confirmed.cover||[]};treeRevision=kind==='영상'?JSON.stringify([stage,selectedGroup,selectedGenre,selectedAct,expandedAct,manualOrder]):'';onChange();}});refreshOrderEditor();};if(window.NoaBrowseOrder)start();else{const script=e('script');script.src='/noa-browse-order.js?v=20261025-inline-order-4';script.onload=start;script.onerror=()=>{note.textContent='순서 편집을 불러오지 못했습니다. 새로고침해 주세요.';};document.head.append(script);}}}}).catch(()=>{});
 return {apply,matches,reveal(r){stage='songs';selectedGenre=r.genre;selectedGroup=groupFor(r.genre)||'';selectedAct=actFor(r)||0;page=0;sync();},reset(){page=0;},getStage:()=>stage};
}
window.NoaBrowse={groups,names,genreArt,groupFor,actFor,slicePage,mount};
})();


