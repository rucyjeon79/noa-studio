(()=>{'use strict';
 const storageKey='noa-media-history-v1',valid=r=>r&&['audio','youtube'].includes(r.type)&&typeof r.key==='string'&&r.key.length>0&&r.key.length<=200;
 function read(){try{const rows=JSON.parse(sessionStorage.getItem(storageKey)||'[]');return Array.isArray(rows)?rows.filter(valid).slice(0,40):[];}catch{return [];}}
 window.addEventListener('noa-media-activity',event=>{const row=event.detail;if(!valid(row))return;try{sessionStorage.setItem(storageKey,JSON.stringify([{type:row.type,key:row.key},...read().filter(r=>r.type!==row.type||r.key!==row.key)].slice(0,40)));}catch{}});
 const sound=document.getElementById('my-recent'),video=document.getElementById('my-recent-youtube');if(!sound||!video)return;
 const history=read();if(!history.length)return;
 (async()=>{try{
  const response=await fetch('/noa-bridge/catalog.php',{credentials:'same-origin'});if(!response.ok)throw Error('catalog');const data=await response.json();if(!Array.isArray(data.items))throw Error('catalog');
  for(const [type,host] of [['audio',sound],['youtube',video]]){
   const list=document.createElement('ol');let count=0;
   for(const row of history.filter(r=>r.type===type)){
    const item=data.items.find(s=>type==='audio'?s.key===row.key&&s.audioVerified&&s.audioUrl:s.youtubeId===row.key);if(!item||count>=20)continue;
    const li=document.createElement('li'),a=document.createElement('a');a.textContent=item.title;a.href=type==='audio'?'/noa-music.php?track='+encodeURIComponent(item.key):'/noa-youtube.php?track='+encodeURIComponent(item.youtubeId);li.append(a);list.append(li);count++;
   }
   if(count)host.replaceChildren(list);
  }
 }catch{for(const host of [sound,video])host.textContent='최근 기록을 확인하지 못했습니다. 잠시 후 다시 열어 주세요.';}})();
})();
