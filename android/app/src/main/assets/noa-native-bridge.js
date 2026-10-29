/* Keep the PWA DOM, category order and controls. Replace only its audio backend. */
(()=>{'use strict';
 if(window!==window.top||!window.NoaAndroid||window.NoaNativeBridge)return;
 const send=value=>{try{window.NoaAndroid.postMessage(JSON.stringify(value));}catch{}};
 function uploadState(){
  let active=!!document.body?.classList.contains('noa-upload-active');
  try{const state=JSON.parse(localStorage.getItem('noa-jukebox-transferring-v1')||'null');active=active||Object.values(state?.owners||{}).some(at=>Date.now()-at>=0&&Date.now()-at<15000);}catch{}
  send({type:'upload',active});
 }
 window.addEventListener('storage',uploadState);window.setInterval?.(uploadState,3000);
 const originalPlay=HTMLMediaElement.prototype.play;
 let domReady=document.readyState!=='loading';
 let audio=null,applying=false,pendingKey='',snapshot={key:'',position:0,duration:0,paused:true,playing:false,ended:false,volume:.7,closed:true};
 const collectionLoop=()=>{try{return typeof collectionQueue!=='undefined'&&!!collectionQueue&&(typeof activeQueue==='undefined'||!activeQueue);}catch{return false;}};
 const key=()=>{try{return typeof selected!=='undefined'?selected?.dataset.key||'':'';}catch{return '';}};
 const event=name=>audio?.dispatchEvent(new Event(name));
 function request(type){
  if(applying)return;
  const current=key();if(!current)return;
  let keys=[current],repeatMode=false,shuffleMode=false;
  try{if(typeof queue==='function')keys=queue().map(row=>row.dataset.key);repeatMode=typeof repeat!=='undefined'&&repeat;shuffleMode=typeof shuffle!=='undefined'&&shuffle;}catch{}
  pendingKey=current;
  keys=keys.slice(0,500);if(!keys.includes(current))keys=[current];
  const tracks=keys.map(id=>{const record=typeof lookup!=='undefined'?lookup.get(id):null;if(!record?.audio)return null;try{return {key:id,title:String(record.title||'').slice(0,256),audioUrl:new URL(record.audio,location.href).href,coverImageUrl:record.thumb?new URL(record.thumb,location.href).href:''};}catch{return null;}}).filter(Boolean);
  send({type,key:current,queue:keys,tracks,repeat:!!repeatMode,collectionLoop:collectionLoop(),shuffle:!!shuffleMode,volume:snapshot.volume});
 }
 function mount(){
  if(!domReady)return;
  const found=document.getElementById('sound-player');if(!found||found===audio)return;
  audio=found;
  // Instance-only facade: previews, video and unrelated audio retain browser behavior.
  Object.defineProperties(audio,{
   currentTime:{configurable:true,get:()=>snapshot.position,set:value=>{if(!applying&&Number.isFinite(Number(value))){snapshot.position=Math.max(0,Number(value));send({type:'seek',seconds:snapshot.position});}}},
   duration:{configurable:true,get:()=>snapshot.duration},
   paused:{configurable:true,get:()=>snapshot.paused},
   ended:{configurable:true,get:()=>snapshot.ended},
   volume:{configurable:true,get:()=>snapshot.volume,set:value=>{if(!applying&&Number.isFinite(Number(value))){snapshot.volume=Math.max(0,Math.min(1,Number(value)));send({type:'volume',value:snapshot.volume});event('volumechange');}}}
  });
  audio.play=()=>{if(!applying){request('play');snapshot.paused=false;event('play');event('waiting');}return Promise.resolve();};
  audio.pause=()=>{if(!applying){send({type:'pause'});snapshot.paused=true;event('pause');}};
  audio.load=()=>{if(!applying){snapshot.position=0;snapshot.duration=0;snapshot.paused=true;request('prepare');}};
  send({type:'ready'});
 }
 HTMLMediaElement.prototype.play=function(){
  if(this.id==='sound-player'){mount();if(this===audio)return audio.play();return Promise.resolve();}
  if(!this.muted)send({type:'video'});
  return originalPlay.call(this);
 };
 window.NoaNativeBridge={
  state(next){
   mount();if(!audio)return;
   if(pendingKey&&next.key!==pendingKey&&!next.error)return;
   if(next.key===pendingKey)pendingKey='';
   const previous=snapshot;applying=true;
   try{
    if(next.key&&!key()&&Array.isArray(next.queue)&&typeof activeQueue!=='undefined'){
     const restored=next.queue.filter(id=>typeof buttons!=='undefined'&&buttons.some(row=>row.dataset.key===id));
     if(next.collectionLoop&&typeof collectionQueue!=='undefined'){collectionQueue=restored;activeQueue=null;}else activeQueue=restored;
     if(typeof filter==='function')filter();
    }
    if(next.key&&next.key!==key()){
     // Use the PWA's own selection/rendering path, including its classification UI.
     const row=typeof buttons!=='undefined'?buttons.find(row=>row.dataset.key===next.key):null;
     if(row&&typeof select==='function')select(row,false);
    }
    snapshot={...next};
    if(typeof repeat!=='undefined')repeat=!!next.repeat;
    if(typeof shuffle!=='undefined')shuffle=!!next.shuffle;
    for(const id of ['repeat','shuffle','sequential'])document.getElementById(id)?.setAttribute('aria-pressed',String(id==='repeat'?next.repeat:id==='shuffle'?next.shuffle:!next.repeat&&!next.shuffle));
    const dock=document.querySelector('.noa-transport');if(dock&&next.key===key())dock.hidden=!!next.closed;
    if(next.duration>0&&(previous.key!==next.key||previous.duration!==next.duration))event('loadedmetadata');
    if(next.error&&!previous.error)event('error');
    else if(next.playing&&(!previous.playing||previous.key!==next.key))event('playing');
    else if(next.paused&&!previous.paused)event('pause');
    event('timeupdate');
   }finally{applying=false;}
  },
  error(message){pendingKey='';snapshot.paused=true;event('error');const status=document.getElementById('player-status');if(status)status.textContent=message;},
  ready:()=>!!audio
 };
 document.addEventListener('click',e=>{
  const control=e.target.closest?.('#repeat,#shuffle,#sequential,#dock-close');if(!control)return;
  queueMicrotask(()=>{if(control.id==='dock-close'){send({type:'close'});return;}send({type:'modes',collectionLoop:collectionLoop(),repeat:document.getElementById('repeat')?.getAttribute('aria-pressed')==='true',shuffle:document.getElementById('shuffle')?.getAttribute('aria-pressed')==='true'});});
 });
 window.addEventListener('noa-media-activity',e=>{if(e.detail?.type==='youtube')send({type:'video'});});
 window.addEventListener('noa-app-update',()=>send({type:'update'}));
 const boot=()=>{domReady=true;mount();uploadState();if(document.body&&typeof MutationObserver!=='undefined')new MutationObserver(uploadState).observe(document.body,{attributes:true,attributeFilter:['class']});};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
