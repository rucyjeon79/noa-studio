/* Shared by N80 JukeBox navigation and reload restoration. No requests on load. */
(()=>{'use strict';if(window.N80JukeBoxRoutes)return;
 function allows(value){
  let url;try{url=new URL(value,location.href);}catch{return false;}
  if(url.origin!==location.origin||url.username||url.password)return false;
  const path=url.pathname;
  // Authentication, downloads, transactions and handlers retain their native navigation.
  if(/(?:login|logout|oauth|callback|download|payment|kcp|checkout|orderform|orderinquiry|special-invite|deploy|update|delete|save|action|check)[-.\/]/i.test(path))return false;
  if(['action','delete','save','download','logout'].some(key=>url.searchParams.has(key)))return false;
  return path==='/'||path==='/index.php'||/^\/noa-[a-z0-9-]+\.php$/.test(path)
   ||/^\/noa-app\/(?:jukebox|database|taxonomy|popularity)\/(?:index\.php)?$/.test(path)
   ||/^\/bbs\/(?:board|write|new|search|content|profile)\.php$/.test(path)
   ||/^\/(?:mobile\/)?shop\/(?:cart|list|item)\.php$/.test(path)
   ||/^\/adm\/(?:member_list|board_list|config_form|theme)\.php$/.test(path);
 }
 window.N80JukeBoxRoutes=Object.freeze({allows});
})();
