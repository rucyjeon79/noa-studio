/* A bare legacy music shortcut is an app entrance; deliberate music links stay put. */
(()=>{'use strict';
 const here=new URL(location.href),intentKey='noa-music-navigation-v3';
 const bareMusic=url=>url.origin===here.origin&&url.pathname==='/noa-music.php'&&!url.search&&!url.hash;
 // Rebuild the persistent music shell after a full reload of one of its app views.
 const shellRoutes=new Set(['/','/index.php','/noa-my.php','/noa-youtube.php','/noa-world.php','/noa-settings.php','/noa-sitemap.php']);
 try{const s=JSON.parse(sessionStorage.getItem('noa-playback-session-v1')||'null');const reload=performance.getEntriesByType('navigation')[0]?.type==='reload';
 if(window.top===window&&reload&&shellRoutes.has(here.pathname)&&s&&s.path===here.pathname+here.search+here.hash&&!s.closed&&typeof s.key==='string'&&Date.now()-s.at>=0&&Date.now()-s.at<86400000){sessionStorage.setItem('noa-playback-return',JSON.stringify({path:s.path,at:Date.now()}));location.replace('/noa-music.php?resume=1');return;}
 }catch{}
 let legacy=bareMusic(here),internal=false,intent=false;
 if(['/bbs/login.php','/noa-login.php'].includes(here.pathname)&&!here.hash){
  const keys=[...here.searchParams.keys()];
  if(keys.length===1&&keys[0]==='url')try{legacy=bareMusic(new URL(here.searchParams.get('url'),here.origin));}catch{}
 }
 try{internal=!!document.referrer&&new URL(document.referrer).origin===here.origin;}catch{}
 try{const raw=sessionStorage.getItem(intentKey);if(raw){const saved=JSON.parse(raw);intent=saved.path==='/noa-music.php'&&Date.now()-saved.at>=0&&Date.now()-saved.at<30000;sessionStorage.removeItem(intentKey);}}catch{}
 // Restored app sessions can retain the old launch flag for days; it is not a launch signal.
 if(legacy&&!internal&&!intent&&performance.getEntriesByType('navigation')[0]?.type!=='reload'){location.replace('/');return;}
 document.addEventListener('click',event=>{
  const anchor=event.target?.closest?.('a[href]');if(!anchor||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target==='_blank')return;
  try{if(bareMusic(new URL(anchor.href,here.href)))sessionStorage.setItem(intentKey,JSON.stringify({path:'/noa-music.php',at:Date.now()}));}catch{}
 },true);
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/noa-sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
})();
