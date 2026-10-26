/* A bare legacy music shortcut is an app entrance; deliberate music links stay put. */
(()=>{'use strict';
 const here=new URL(location.href),intentKey='noa-music-navigation-v3';
 const bareMusic=url=>url.origin===here.origin&&url.pathname==='/noa-music.php'&&!url.search&&!url.hash;
 let legacy=bareMusic(here),internal=false,intent=false;
 if(['/bbs/login.php','/noa-login.php'].includes(here.pathname)&&!here.hash){
  const keys=[...here.searchParams.keys()];
  if(keys.length===1&&keys[0]==='url')try{legacy=bareMusic(new URL(here.searchParams.get('url'),here.origin));}catch{}
 }
 try{internal=!!document.referrer&&new URL(document.referrer).origin===here.origin;}catch{}
 try{const raw=sessionStorage.getItem(intentKey);if(raw){const saved=JSON.parse(raw);intent=saved.path==='/noa-music.php'&&Date.now()-saved.at>=0&&Date.now()-saved.at<30000;sessionStorage.removeItem(intentKey);}}catch{}
 // Restored app sessions can retain the old launch flag for days; it is not a launch signal.
 if(legacy&&!internal&&!intent){location.replace('/');return;}
 document.addEventListener('click',event=>{
  const anchor=event.target?.closest?.('a[href]');if(!anchor||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target==='_blank')return;
  try{if(bareMusic(new URL(anchor.href,here.href)))sessionStorage.setItem(intentKey,JSON.stringify({path:'/noa-music.php',at:Date.now()}));}catch{}
 },true);
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/noa-sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
})();
