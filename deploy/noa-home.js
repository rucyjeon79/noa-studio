(()=>{'use strict';
const metric=value=>{if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))return null;const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;};
const formatNumber=(value,exact=false)=>{const n=metric(value);if(n===null)return '미확인';if(exact||n<1000)return n.toLocaleString(document.documentElement.lang||'ko');const scale=n>=1000000?1000000:1000;return String(Math.floor(n/(scale/10))/10)+(scale===1000000?'M':'K');};
function metadata(row,playlist,integrated,exact=false){
 const number=value=>formatNumber(value,exact);
 if(row.recommendationKind==='new'){const date=new Date(row.publishedAt);return Number.isFinite(date.getTime())?date.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'})+' 공개':'최근 공개';}
 if(row.recommendationKind==='rising')return '최근 조회수 +'+number(row.viewGain);
 if(row.recommendationKind==='popular')return metric(row.jukeboxPlays)!==null?'인기 '+number(row.score)+'점':'조회 '+number(row.views);
 const plays=metric(row.jukeboxPlays);
 if(integrated||(plays!==null&&plays>0))return '인기 점수 '+number(row.score)+' · YouTube '+number(row.youtubeViews??row.views)+' · 음원 '+number(row.jukeboxPlays);
 return (playlist&&row.playlistId?'수록 영상 조회 ':'조회 ')+number(playlist?(row.youtubeViews??row.views??row.score):(row.youtubeViews??row.views));
}
function card(row,playlist=false,integrated=false){
 const a=document.createElement('a');a.className='noa-music-card';a.href=row.href;a.dataset.video=row.videoId;if(playlist&&row.playlistId)a.dataset.playlist=row.playlistId;else a.dataset.views=String(row.views);
 const art=document.createElement('div');art.className='noa-art';const image=document.createElement('img');image.loading='lazy';image.src=row.thumbnail;image.alt='';art.append(image);
 image.onerror=()=>{image.hidden=true;art.dataset.unavailable='true';};
 const title=document.createElement('strong');title.textContent=row.title;const note=document.createElement('small');
 note.className='noa-card-meta';const context=document.createElement('span');context.className='noa-card-context';context.textContent=[window.NoaBrowse.names[row.genre]||'',row.language&&row.language!=='und'?({ko:'한국어',ja:'日本語',en:'English',th:'ไทย'}[row.language]||row.language):'',row.version&&!/^(?:unspecified|unknown|default|und)$/i.test(row.version)?row.version:''].filter(Boolean).join(' · ');note.textContent=metadata(row,playlist,integrated);note.title=metadata(row,playlist,integrated,true);if(context.textContent)note.append(context);a.append(art,title,note);window.NoaCardLayout?.prepare(a,row);if(row.recommendationLabel){const reason=document.createElement('span');reason.className='noa-discovery-reason';reason.textContent=row.recommendationLabel;a.append(reason);}return a;
}
const homeLists=new Map();
function homePageSize(width,height=800,cardHeight=240,chrome=160,columnGap=width<=600?12:16,rowGap=columnGap){
 const gap=columnGap,min=width<=600?136:168;
 const columns=Math.min(4,Math.max(1,Math.floor((width+gap)/(min+gap))));
 return columns*Math.max(1,Math.floor((height-chrome+rowGap)/(cardHeight+rowGap)));
}
function rawListSize(state){
 const box=getComputedStyle(state.host),width=state.host.clientWidth-parseFloat(box.paddingLeft)-parseFloat(box.paddingRight);
 if(state.width!==width){state.width=width;state.cardHeight=0;}
 const gap=parseFloat(box.columnGap)||0,rowGap=parseFloat(box.rowGap)||0;
 const section=state.host.closest('section');
 // Measure the actual heading span, including collapsed margins and tabs.
 let chrome=state.host.getBoundingClientRect().top-section.getBoundingClientRect().top+80;
 for(const selector of ['#noa-account-bar','.noa-mobile-nav','.noa-transport','.noa-topbar']){const node=document.querySelector(selector);if(node&&!node.hidden){const style=getComputedStyle(node);if(style.display!=='none'&&['fixed','sticky'].includes(style.position))chrome+=node.getBoundingClientRect().height;}}
 const columns=homePageSize(width,1,1,0,gap,rowGap);
 return homePageSize(width,window.visualViewport?.height||window.innerHeight,state.cardHeight||((width-gap*(columns-1))/columns*.5625+120),chrome,gap,rowGap);
}
function listSize(state){if(window.matchMedia('(max-width:760px) and (orientation:portrait)').matches)return 4;return Math.min(rawListSize(state),...[...homeLists.values()].filter(item=>item.rows?.length).map(rawListSize));}
function fitList(state){
 const heights=[...state.host.children].filter(node=>node.matches('.noa-music-card,.noa-engagement-card')).map(node=>node.getBoundingClientRect().height);
 state.cardHeight=Math.max(state.cardHeight||0,...heights);
 refit();
}
function renderList(state){
 const {host,rows,playlist,integrated,pager}=state;
 const size=listSize(state);if(state.size&&state.size!==size)state.page=Math.floor(state.page*state.size/size);state.size=size;
 const pages=Math.max(1,Math.ceil(rows.length/size));state.page=Math.min(state.page,pages-1);
 host.replaceChildren();
 if(!rows.length){const empty=document.createElement('p');empty.className='noa-empty';empty.textContent=playlist?'조건에 맞는 공개 연속듣기 목록이 없습니다.':'음악을 준비하고 있습니다.';host.append(empty);}
 for(const row of rows.slice(state.page*size,(state.page+1)*size))host.append(card(row,playlist,integrated));
 pager.replaceChildren();pager.hidden=pages<=1;
 if(pages>1){for(const [label,delta]of [['이전',-1],['다음',1]]){const button=document.createElement('button');button.type='button';button.className='noa-button';button.textContent=label;button.disabled=delta<0?state.page===0:state.page===pages-1;button.onclick=()=>{state.page+=delta;renderList(state);};pager.append(button);if(delta<0){const status=document.createElement('span');status.textContent=(state.page+1)+' / '+pages;status.setAttribute('aria-live','polite');pager.append(status);}}}
 window.NoaCardLayout?.refresh();requestAnimationFrame(()=>fitList(state));
}
let refitFrame=0;
const refit=()=>{if(refitFrame)return;refitFrame=requestAnimationFrame(()=>{refitFrame=0;const sizes=[...homeLists.values()].map(state=>[state,listSize(state)]);for(const [state,size]of sizes)if(size!==state.size)renderList(state);});};
const homeResize=new ResizeObserver(entries=>{for(const entry of entries){const state=homeLists.get(entry.target.id);if(state)fitList(state);}});
window.addEventListener('resize',refit,{passive:true});window.visualViewport?.addEventListener('resize',refit,{passive:true});
document.fonts?.ready.then(refit);

function fill(id,rows,playlist=false,integrated=false){
 const host=document.getElementById(id);let state=homeLists.get(id);
 if(!state){const pager=document.createElement('nav');pager.className='noa-home-pages';pager.setAttribute('aria-label',host.closest('section').querySelector('h2').textContent+' 페이지');host.after(pager);state={host,pager,page:0};homeLists.set(id,state);homeResize.observe(host);}
 Object.assign(state,{rows,playlist,integrated,page:0});renderList(state);
}
(async()=>{try{
 const data=await (window.NoaHomeSnapshot??=fetch('/noa-bridge/home.php',{credentials:'same-origin',cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!data.ok)throw Error();return data;}));
 const integrated=data.popularity?.jukeboxCollectionStatus==='enabled';
 fill('noa-acts',data.playlists,true,integrated);
 const discovery=data.discovery,featured=document.getElementById('noa-featured');
 if(discovery){
  const tabs=document.createElement('div');tabs.className='noa-discovery-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','추천 음악 기준');
  const description=featured.parentElement.querySelector('p.noa-muted');
  const select=kind=>{for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.kind===kind));fill('noa-featured',discovery[kind]||[],false,integrated);const selectedIds=new Set((discovery[kind]||[]).map(row=>row.videoId));for(const [id,key]of [['noa-ep','ep'],['noa-stories','stories'],['noa-covers','covers']])fill(id,(data[key]||[]).filter(row=>!selectedIds.has(row.videoId)),false,integrated);if(description)description.textContent=kind==='rising'?(discovery.comparisonHours?'약 '+discovery.comparisonHours+'시간 동안 조회수가 늘어난 음악이에요.':'상승세를 비교할 기록을 모으고 있어요.'):kind==='new'?'실제 공개일이 최근인 영상부터 만나보세요.':kind==='popular'?'조회수와 유효 재생, 좋아요·댓글이 반영된 인기 음악이에요.':'인기 음악, 조회수 상승, 최근 공개 영상을 골고루 만나보세요.';if(!(discovery[kind]||[]).length)featured.querySelector('p').textContent=kind==='rising'?'확인된 상승 영상이 생기면 여기에 소개할게요.':'조건에 맞는 공개 영상을 준비하고 있어요.';};
  for(const [kind,label]of [['mixed','골고루'],['popular','인기'],['rising','상승세'],['new','새 영상']]){const b=document.createElement('button');b.type='button';b.dataset.kind=kind;b.textContent=label;b.onclick=()=>select(kind);tabs.append(b);}featured.before(tabs);select('mixed');
 }else{fill('noa-featured',data.featured||[],false,integrated);for(const [id,key]of [['noa-ep','ep'],['noa-stories','stories'],['noa-covers','covers']])fill(id,data[key],false,integrated);}

 document.getElementById('noa-playlist-basis').textContent='플레이리스트를 골라 음악을 이어 들어보세요.';
 const date=new Date(data.popularity?.aggregatedAt||data.collectedAt);document.getElementById('noa-ranking-status').textContent=(data.popularity?'인기 음악':'YouTube 조회수 기준')+(Number.isFinite(date.getTime())?' · '+date.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'');
 const host=document.getElementById('noa-genres');for(const [id,title,genres]of window.NoaBrowse.groups){const a=document.createElement('a');a.className='noa-genre';a.href='/noa-music.php?group='+encodeURIComponent(id);const name=document.createElement('strong');name.textContent=window.NoaUI?.translate(title)||title;const small=document.createElement('small');small.textContent=({original:genres.length+'개 장르의 오리지널 음악',ep:genres.length+'개 장르 · ACT·EP별 감상',story:'별무리의 사연으로 만든 음악',cover:'노아의 목소리로 다시 듣는 명곡'})[id]||'음악 둘러보기';const image=document.createElement('img');image.src=window.NoaBrowse.genreArt(genres[0]);image.alt='';image.loading='lazy';image.decoding='async';image.width=480;image.height=270;image.className='noa-collection-image';image.onerror=()=>{image.hidden=true;};a.append(image,name,small);host.append(a);}
 document.body.dataset.noaHomeReady='true';
 }catch{for(const id of ['noa-featured','noa-ep','noa-stories','noa-covers','noa-acts']){const host=document.getElementById(id);host.replaceChildren();const p=document.createElement('p');p.className='noa-empty';p.textContent='공개 영상 순위를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.';host.append(p);}document.getElementById('noa-ranking-status').textContent='잠시 후 다시 이용해 주세요.';document.body.dataset.noaHomeReady='error';}
})();})();

