/* One muted inline automatic attempt. No replay control, loop, orientation or visibility restart. */
(()=>{'use strict';
 const video=document.getElementById('noa-hero-video'),poster=document.getElementById('noa-hero-poster'),status=document.getElementById('noa-hero-status');
 if(!video||!poster)return;
 const art=video.closest('.noa-hero-art'),reduced=matchMedia('(prefers-reduced-motion: reduce)'),genres=Object.keys(window.NoaBrowse?.names||{});
 if(!genres.length)return;
 const genre=genres[Math.floor(Math.random()*genres.length)],variant=['a','b','c'][Math.floor(Math.random()*3)],base=window.NoaBrowse.genreArt(genre).replace(/-a\.jpg$/,'-'+variant);
 poster.src=base+'.jpg';video.poster=poster.src;poster.closest?.('picture')?.querySelectorAll('source').forEach(source=>source.srcset=poster.src);
 video.muted=true;video.playsInline=true;video.loop=false;video.autoplay=false;video.removeAttribute('loop');video.removeAttribute('autoplay');
 let attempted=false,finished=false;
 function state(value){if(art)art.dataset.mediaState=value;}
 function fallback(message=''){video.hidden=true;state('poster');if(status)status.textContent=message;}
 async function start(){
  if(attempted||finished||reduced.matches)return;
  attempted=true;state('loading');video.src=base+'.mp4';
  try{await video.play();}catch{fallback();}
 }
 video.addEventListener('playing',()=>{video.hidden=false;state('playing');if(status)status.textContent='';});
 video.addEventListener('ended',()=>{finished=true;video.pause();video.hidden=false;state('ended');});
 video.addEventListener('error',()=>fallback('영상을 불러오지 못해 이미지를 표시합니다.'));
 reduced.addEventListener('change',()=>{if(reduced.matches){video.pause();if(!finished)fallback();}});
 window.addEventListener('pagehide',()=>video.pause());document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
 state('poster');start();
})();
