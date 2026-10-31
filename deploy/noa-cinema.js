(()=>{
 'use strict';
 const byId=id=>document.getElementById(id);
 const node=(tag,cls,text='')=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
 const groupCopy={original:'노아의 오리지널 음악 영상',ep:'노아의 이야기를 EP 순서로',story:'별무리의 사연으로 만든 노래',cover:'익숙한 명곡을 노아의 목소리로'};
 let films=[],focusTrack,apiPromise,player,sequence=0,now=null,badge,next,external,feature,homeSlot;
 function api(){
  if(window.YT?.Player)return Promise.resolve(window.YT);
  if(!apiPromise)apiPromise=new Promise((resolve,reject)=>{
   const previous=window.onYouTubeIframeAPIReady;
   window.onYouTubeIframeAPIReady=()=>{try{previous?.();}finally{resolve(window.YT);}};
   const tag=document.createElement('script');tag.src='https://www.youtube.com/iframe_api';tag.onerror=()=>{apiPromise=null;tag.remove();reject(Error('youtube_api_unavailable'));};document.head.append(tag);
  });
  return apiPromise;
 }
 function state(value){
  if(!badge)return;
  badge.dataset.playing=String(value===1);
  badge.textContent=({1:'상영 중',2:'일시정지',3:'불러오는 중',0:'상영 종료'})[value]||'상영 대기';
 }
 function reset(){sequence++;now=null;state(-1);if(next)next.hidden=true;if(external)external.hidden=true;}
 const act=r=>Number(r.act)||Math.ceil(Number(r.ep)/10);
 function episode(r){return Number(r.ep)>0?'ACT.'+act(r)+' · EP.'+String(r.ep).padStart(2,'0'):'';}
 function start(id){
  reset();
  const version=sequence;
  const old=byId('yt-frame'),frame=old.cloneNode(false);
  frame.removeAttribute('src');frame.hidden=false;old.replaceWith(frame);
  if(player){try{player.destroy();}catch{}player=null;}
  now=films.find(r=>r.video===id)||null;
  if(external)external.href='https://www.youtube.com/watch?v='+id;
  const url=new URL('https://www.youtube.com/embed/'+id);
  url.search=new URLSearchParams({autoplay:'1',playsinline:'1',rel:'0',enablejsapi:'1',origin:location.origin});
  frame.src=url.href;
  if(next&&now&&Number(now.ep)>0){
   const following=films.filter(r=>r.kind!=='playlist'&&r.genre===now.genre&&act(r)===act(now)&&Number(r.ep)>Number(now.ep)).sort((a,b)=>Number(a.ep)-Number(b.ep))[0];
   if(following){
    next.hidden=false;next.textContent='다음 편  ·  '+episode(following)+'  '+following.title;
    next.onclick=()=>{const slot=byId('yt-player').closest('.cinema-slot');if(slot)launch(slot,following);else focusTrack(following.key,{play:true});};
   }
  }
  api().then(YT=>{
   if(sequence!==version||!frame.isConnected)return;
   player=new YT.Player(frame,{events:{
    onReady:event=>{if(sequence===version)state(event.target.getPlayerState());},
    onStateChange:event=>{if(sequence===version)state(event.data);},
    onError:()=>{if(sequence===version&&badge){state(-1);badge.textContent='재생할 수 없음';external.hidden=false;}}
   }});
  }).catch(()=>{if(sequence===version&&badge){badge.textContent='YouTube 플레이어';external.hidden=false;}});
 }
 function launch(slot,film){
  const screen=byId('yt-player');
  if(screen.parentNode!==slot)slot.append(screen);
  document.dispatchEvent(new CustomEvent('noa-cinema-request',{detail:{id:film.video}}));
  window.NoaBrowse.renderPath(byId('video-classification'),film,{base:'/noa-youtube.php'});
 }
 function poster(film,label,hero=false){
  const slot=node('div','cinema-slot');
  const play=node('button','cinema-poster');play.type='button';
  play.setAttribute('aria-label',film.title+' 상영하기');
  const img=node('img','cinema-still');img.alt='';img.loading=hero?'eager':'lazy';img.decoding='async';img.src='/noa-bridge/youtube-thumbnail.php?id='+encodeURIComponent(film.video);
  img.onerror=()=>{img.hidden=true;};
  const text=node('span','cinema-overlay');
  text.append(node('span','cinema-tag',label),node('strong','cinema-title',film.title),node('span','cinema-play','▶  상영하기'));
  play.append(img,text);play.onclick=()=>launch(slot,film);slot.append(play);return slot;
 }
 function mount(host,rows,focus){
  if(feature)return;
  const sources=new Set([...document.querySelectorAll('#yt-videos [data-video]')].map(b=>b.dataset.video));
  const ids=new Set();
  films=rows.filter(r=>{if(r.comingSoon||!sources.has(r.video)||ids.has(r.video))return false;ids.add(r.video);return true;});
  if(!films.length)return;
  focusTrack=focus;const screen=byId('yt-player');
  const bar=node('div','cinema-screen-status');badge=node('span','cinema-badge');badge.setAttribute('role','status');external=node('a','cinema-external','YouTube에서 보기 ↗');external.target='_blank';external.rel='noopener noreferrer';external.hidden=true;bar.append(badge,external);screen.prepend(bar);state(-1);
  next=node('button','cinema-next');next.type='button';next.hidden=true;screen.append(next);
  document.body.classList.add('noa-screen-room');
  feature=node('section','cinema-feature');feature.setAttribute('aria-label','NOA 상영관 · 오늘의 상영작');
  const day=Math.floor((Date.now()+9*3600000)/86400000);
  const film=films[day%films.length];
  feature.append(node('p','cinema-kicker','NOA SCREENING ROOM'),node('h2','cinema-heading','오늘의 상영작'));
  homeSlot=poster(film,episode(film)||'OFFICIAL SELECTION',true);feature.append(homeSlot);
  screen.before(feature);
  function decorate(){
   const grid=host.querySelector('[data-browse-level="1"] .noa-browse-grid');
   if(!grid||grid.dataset.cinema==='1')return;
   const buttons=[...grid.children];if(!buttons.length)return;
   grid.dataset.cinema='1';
   buttons.forEach((button,index)=>{
    const group=window.NoaBrowse.groups[index];if(!group||!button.classList.contains('noa-browse-card'))return;
    const record=films.find(r=>group[2].includes(r.genre));if(!record)return;
    const card=node('article','cinema-programme');button.before(card);
    const slot=poster(record,episode(record)||'PROGRAMME 0'+(index+1));
    card.append(slot,button);button.querySelector(':scope>img')?.remove();button.classList.add('cinema-directory');
    button.setAttribute('aria-label',group[1]+' 목록 열기');
    const caption=node('p','cinema-caption',groupCopy[group[0]]);card.append(caption);
    if(group[0]==='story'){
     fetch('/noa-youtube.php?detail='+encodeURIComponent(record.video),{credentials:'same-origin'}).then(r=>r.json()).then(d=>{
      if(d.ok&&d.videoId===record.video&&typeof d.description==='string'){
       const line=d.description.split(/\r?\n/).map(x=>x.trim()).find(x=>x.length>8&&!/(https?:|^#|^@)/.test(x));
       if(line)caption.textContent=line.length>72?line.slice(0,70)+'…':line;
      }
     }).catch(()=>{});
    }
   });
  }
  new MutationObserver(()=>{if(!screen.isConnected){reset();screen.hidden=true;homeSlot.append(screen);}decorate();}).observe(host,{childList:true,subtree:true});
  decorate();
 }
 window.NoaCinema={mount,start,reset};
})();
