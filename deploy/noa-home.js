(()=>{'use strict';
const metric=value=>{if(typeof value!=='number'&&(typeof value!=='string'||!/^\d+$/.test(value)))return null;const n=Number(value);return Number.isSafeInteger(n)&&n>=0?n:null;};
const number=value=>{const n=metric(value);return n===null?'미확인':n.toLocaleString(document.documentElement.lang||'ko');};
function metadata(row,playlist,integrated){
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
 note.className='noa-card-meta';const context=document.createElement('span');context.className='noa-card-context';context.textContent=[window.NoaBrowse.names[row.genre]||'',row.language&&row.language!=='und'?({ko:'한국어',ja:'日本語',en:'English',th:'ไทย'}[row.language]||row.language):'',row.version||''].filter(Boolean).join(' · ');note.textContent=metadata(row,playlist,integrated);if(context.textContent)note.append(context);a.append(art,title,note);window.NoaCardLayout?.prepare(a,row);if(row.recommendationLabel){const reason=document.createElement('span');reason.className='noa-discovery-reason';reason.textContent=row.recommendationLabel;a.append(reason);}return a;
}
function fill(id,rows,playlist=false,integrated=false){const host=document.getElementById(id);host.replaceChildren();if(!rows.length){const empty=document.createElement('p');empty.className='noa-empty';empty.textContent=playlist?'조건에 맞는 공개 연속듣기 목록이 없습니다.':'음악을 준비하고 있습니다.';host.append(empty);return;}for(const row of rows)host.append(card(row,playlist,integrated));}
(async()=>{try{
 const response=await fetch('/noa-bridge/home.php',{credentials:'same-origin',cache:'no-store'});if(!response.ok)throw Error();const data=await response.json();if(!data.ok)throw Error();
 const integrated=data.popularity?.jukeboxCollectionStatus==='enabled';
 for(const [id,key]of [['noa-ep','ep'],['noa-stories','stories'],['noa-covers','covers']])fill(id,data[key],false,integrated);fill('noa-acts',data.playlists,true,integrated);
 const discovery=data.discovery,featured=document.getElementById('noa-featured');
 if(discovery){
  const tabs=document.createElement('div');tabs.className='noa-discovery-tabs';tabs.setAttribute('role','group');tabs.setAttribute('aria-label','추천 음악 기준');
  const description=featured.parentElement.querySelector('p.noa-muted');
  const select=kind=>{for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.dataset.kind===kind));fill('noa-featured',discovery[kind]||[],false,integrated);const selectedIds=new Set((discovery[kind]||[]).map(row=>row.videoId));for(const [id,key]of [['noa-ep','ep'],['noa-stories','stories'],['noa-covers','covers']])fill(id,(data[key]||[]).filter(row=>!selectedIds.has(row.videoId)),false,integrated);if(description)description.textContent=kind==='rising'?(discovery.comparisonHours?'약 '+discovery.comparisonHours+'시간 동안 조회수가 늘어난 음악이에요.':'상승세를 비교할 기록을 모으고 있어요.'):kind==='new'?'실제 공개일이 최근인 영상부터 만나보세요.':kind==='popular'?'조회수와 유효 재생, 좋아요·댓글이 반영된 인기 음악이에요.':'인기 음악, 조회수 상승, 최근 공개 영상을 골고루 만나보세요.';if(!(discovery[kind]||[]).length)featured.querySelector('p').textContent=kind==='rising'?'확인된 상승 영상이 생기면 여기에 소개할게요.':'조건에 맞는 공개 영상을 준비하고 있어요.';};
  for(const [kind,label]of [['mixed','골고루'],['popular','인기'],['rising','상승세'],['new','새 영상']]){const b=document.createElement('button');b.type='button';b.dataset.kind=kind;b.textContent=label;b.onclick=()=>select(kind);tabs.append(b);}featured.before(tabs);select('mixed');
 }else fill('noa-featured',data.featured||[],false,integrated);

 document.getElementById('noa-playlist-basis').textContent='플레이리스트를 골라 음악을 이어 들어보세요.';
 const date=new Date(data.popularity?.aggregatedAt||data.collectedAt);document.getElementById('noa-ranking-status').textContent=(data.popularity?'인기 음악':'YouTube 조회수 기준')+(Number.isFinite(date.getTime())?' · '+date.toLocaleDateString('ko-KR',{timeZone:'Asia/Seoul'}):'');
 const host=document.getElementById('noa-genres');for(const [id,title,genres]of window.NoaBrowse.groups){const a=document.createElement('a');a.className='noa-genre';a.href='/noa-music.php?group='+encodeURIComponent(id);const name=document.createElement('strong');name.textContent=window.NoaUI?.translate(title)||title;const small=document.createElement('small');small.textContent=genres.length===1?'음악 둘러보기':genres.map(g=>window.NoaBrowse.names[g]).join(' · ');a.append(name,small);host.append(a);}
 document.body.dataset.noaHomeReady='true';
 }catch{for(const id of ['noa-featured','noa-ep','noa-stories','noa-covers','noa-acts']){const host=document.getElementById(id);host.replaceChildren();const p=document.createElement('p');p.className='noa-empty';p.textContent='공개 영상 순위를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.';host.append(p);}document.getElementById('noa-ranking-status').textContent='잠시 후 다시 이용해 주세요.';document.body.dataset.noaHomeReady='error';}
})();})();

