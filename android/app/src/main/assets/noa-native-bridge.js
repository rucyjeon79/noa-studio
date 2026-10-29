/* Keep the PWA DOM, category order and controls. Replace only its audio backend. */
(()=>{'use strict';
 if(window!==window.top||!window.NoaAndroid||window.NoaNativeBridge)return;
 const send=value=>{try{window.NoaAndroid.postMessage(JSON.stringify(value));}catch{}};
 const originalPlay=HTMLMediaElement.prototype.play;
 let audio=null,applying=false,pendingKey='',snapshot={key:'',position:0,duration:0,paused:true,playing:false,ended:false,volume:.7,closed:true};
 const key=()=>{try{return typeof selected!=='undefined'?selected?.dataset.key||'':'';}catch{return '';}};
 const event=name=>audio?.dispatchEvent(new Event(name));
 function request(type){
  if(applying)return;
  const current=key();if(!current)return;
  let keys=[current],repeatMode=false,shuffleMode=false;
  try{if(typeof queue==='function')keys=queue().map(row=>row.dataset.key);repeatMode=typeof repeat!=='undefined'&&repeat;shuffleMode=typeof shuffle!=='undefined'&&shuffle;}catch{}
  pendingKey=current;
  send({type,key:current,queue:keys.slice(0,500),repeat:!!repeatMode,shuffle:!!shuffleMode,volume:snapshot.volume});
 }
 function mount(){
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
  if(this.id==='sound-player'){mount();if(this===audio)return audio.play();}
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
  queueMicrotask(()=>{if(control.id==='dock-close'){send({type:'close'});return;}send({type:'modes',repeat:document.getElementById('repeat')?.getAttribute('aria-pressed')==='true',shuffle:document.getElementById('shuffle')?.getAttribute('aria-pressed')==='true'});});
 });
 window.addEventListener('noa-media-activity',e=>{if(e.detail?.type==='youtube')send({type:'video'});});
 window.addEventListener('noa-app-update',()=>send({type:'update'}));
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
