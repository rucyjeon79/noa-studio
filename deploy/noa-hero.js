/* Play the genre introduction once. Recover a blocked attempt with a visible control. */
(()=>{'use strict';
 const video=document.getElementById('noa-hero-video'),poster=document.getElementById('noa-hero-poster'),status=document.getElementById('noa-hero-status'),button=document.getElementById('noa-hero-play'),label=document.getElementById('noa-hero-genre'),description=document.getElementById('noa-hero-description');
 if(!video||!poster)return;
 const art=video.closest('.noa-hero-art'),browse=window.NoaBrowse,names=browse?.names||{'kpop-original':'K-POP Original'},genres=Object.keys(names),descriptions={
  'kpop-original':'한국어로 전하는 노아의 오리지널 음악 이야기.','jpop-original':'일본어의 울림으로 만나는 노아의 오리지널 음악.','pop-original':'영어로 이어지는 노아의 오리지널 팝 이야기.','thai-original':'태국어로 새롭게 만나는 노아의 오리지널 음악.',
  'joseon-ballad':'전통의 정서와 발라드가 만나는 음악 이야기.','echoes-of-joseon':'조선의 여운을 오늘의 소리로 이어가는 음악.','groovy-airy-pop':'가벼운 보컬과 그루브로 흐르는 팝 사운드.','narrative-piano-indie':'피아노 선율 위로 차분하게 펼쳐지는 이야기.','dreamy-deep-house':'몽환적인 분위기와 깊은 리듬으로 흐르는 음악.','fantasy-ambient-edm':'환상적인 공간과 전자음이 그리는 음악 풍경.','edm-kpop-club':'K-POP의 선율과 전자 리듬이 만나는 음악.','latin-afrobeats-edm':'라틴과 아프로비트의 리듬으로 전하는 음악.','panpop':'다양한 색과 리듬으로 확장되는 팝 이야기.','your-story':'당신의 사연을 담아 함께 만들어가는 음악.','cover-reborn':'익숙한 명곡을 노아의 목소리로 새롭게 만나세요.'};
 let finished=false,blocked=false,fallbackUsed=false,pending=false,generation=0;
 const displayName=value=>String(value).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim();
 const state=value=>{if(art)art.dataset.mediaState=value;};

 let recommendations;
 function recommend(genre){
  const picks=document.getElementById('noa-hero-picks');if(!picks)return;
  const heading=picks.parentElement.querySelector('h2');if(heading)heading.textContent=displayName(names[genre]||genre)+' 추천 음악';
  const render=rows=>{if(art?.dataset.genre!==genre)return;const items=rows.length?rows:[{title:displayName(names[genre]||genre)+' 음악 만나기',href:'/noa-youtube.php?genre='+encodeURIComponent(genre),thumbnail:browse?.genreArt?.(genre),comingSoon:true}];
   picks.replaceChildren(...items.slice(0,4).map(row=>{const a=document.createElement('a');a.className='noa-hero-pick';a.href=row.href;a.dataset.genre=genre;const img=document.createElement('img');img.src=row.thumbnail;img.alt='';img.loading='lazy';const span=document.createElement('span'),title=document.createElement('strong'),note=document.createElement('small');title.textContent=String(row.title).replace(/^[\s▪︎•]+/u,'').split('「')[0].trim();a.setAttribute('aria-label',row.title);note.textContent=row.comingSoon?'공개 준비 중':'추천 음악';span.append(note,title);a.append(img,span);return a;}));window.dispatchEvent(new Event('noa-hero-picks'));};
  render([]);recommendations??=(window.NoaHomeSnapshot??=fetch('/noa-bridge/home.php',{credentials:'same-origin',cache:'no-store'}).then(async r=>{if(!r.ok)throw Error();const data=await r.json();if(!data.ok)throw Error();return data;})).catch(()=>({}));recommendations.then(data=>render(data.genreFeatured?.[genre]||[]));
 }
 function choose(genre,variant='a'){
  generation++;const base=(browse?.genreArt?.(genre)||'/noa-assets/splash/kpop-original-g2-a.jpg').replace(/-a\.jpg$/,'-'+variant);
  poster.src=base+'.jpg';video.poster=poster.src;poster.closest?.('picture')?.querySelectorAll('source').forEach(s=>s.srcset=poster.src);
  if(art)art.dataset.genre=genre;if(label)label.textContent=displayName(names[genre]||'K-POP Original');if(description)description.textContent=descriptions[genre]||'노아의 음악과 이야기를 만나는 장르 소개 영상입니다.';
  video.src=base+'.mp4';recommend(genre);
 }
 function fallback(message){video.hidden=true;state('poster');if(status)status.textContent=message;if(button)button.hidden=false;}
 async function play(){if(finished||pending)return;pending=true;const attempt=generation;state('loading');try{await video.play();if(attempt===generation)blocked=false;}catch{if(attempt!==generation)return;blocked=true;fallback('영상 재생을 눌러 장르 소개 영상을 만나보세요.');}finally{if(attempt===generation)pending=false;}}
 video.muted=true;video.playsInline=true;video.loop=false;video.autoplay=false;video.removeAttribute('loop');video.removeAttribute('autoplay');
 video.addEventListener('playing',()=>{video.hidden=false;state('playing');if(status)status.textContent='';if(button)button.hidden=true;});
 video.addEventListener('ended',()=>{finished=true;video.pause();video.hidden=false;state('ended');if(button)button.hidden=true;});
 video.addEventListener('error',()=>{if(!fallbackUsed){fallbackUsed=true;pending=false;choose('kpop-original');play();}else fallback('영상을 불러오지 못했습니다. 영상 재생을 눌러 다시 시도해 주세요.');});
 button?.addEventListener('click',()=>{if(video.error)video.load();play();});
 window.addEventListener('pagehide',()=>video.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();else if(!finished&&!blocked&&video.paused)play();});
 // A persisted deck visits every existing genre/variant before starting another cycle.
 const deckKey='noa-hero-deck-v1',all=genres.flatMap(g=>['a','b','c'].map(v=>g+':'+v));let deck=[];
 try{deck=JSON.parse(localStorage.getItem(deckKey)||'[]');if(!Array.isArray(deck)||deck.some(x=>!all.includes(x))||new Set(deck).size!==deck.length)deck=[];}catch{}
 if(!deck.length)deck=[...all];const index=Math.floor(Math.random()*deck.length),selected=deck.splice(index,1)[0];try{localStorage.setItem(deckKey,JSON.stringify(deck));}catch{}
 const [genre,variant]=selected.split(':');choose(genre,variant);state('poster');play();
})();
