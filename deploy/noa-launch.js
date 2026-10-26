/* Keep existing installed-app identity; migrate only its obsolete bare launch URL. */
(()=>{'use strict';
 const installed=window.matchMedia?.('(display-mode: standalone)').matches||navigator.standalone===true;
 if(installed){
  let first=false;
  try{first=!sessionStorage.getItem('noa-home-launch-v2');sessionStorage.setItem('noa-home-launch-v2','1');}catch{}
  const music=location.pathname==='/noa-music.php'&&!location.search&&!location.hash;
  const login=['/bbs/login.php','/noa-login.php'].includes(location.pathname)&&!location.hash&&new URLSearchParams(location.search).get('url')==='/noa-music.php';
  if(first&&!document.referrer&&(music||login)){location.replace('/');return;}
 }
 if('serviceWorker'in navigator)navigator.serviceWorker.register('/noa-sw.js',{scope:'/',updateViaCache:'none'}).catch(()=>{});
})();
