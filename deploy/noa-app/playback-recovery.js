/* N80 JukeBox recovery: preserve buffered audio before replacing a failed stream. */
(function(root){
'use strict';if(root.NoaPlaybackRecovery)return;
const controllers=new WeakMap();
function attach(audio,{wanted,key,status,now=()=>Date.now(),later=setTimeout,cancel=clearTimeout,
 available=()=>root.navigator?.onLine!==false,canRecover=()=>true,onBlocked=()=>{}}){
 if(controllers.has(audio))return controllers.get(audio);
 let timer=null,version=0,attempts=0,blocked=false,reloading=false,metadata=null,softPending=false,needsRestore=false;
 let position=audio.currentTime||0,lastProgress=now(),stableSince=now(),identity=key(),phase='idle';
 function clear(){if(timer!==null){cancel(timer);timer=null;}}
 function detachMetadata(){if(metadata){audio.removeEventListener('loadedmetadata',metadata);metadata=null;}}
 function invalidate(){clear();detachMetadata();version++;reloading=false;softPending=false;}
 function reset(){invalidate();needsRestore=false;attempts=0;blocked=false;identity=key();position=audio.currentTime||0;lastProgress=stableSince=now();phase='idle';}
 function eligible(){return key()===identity&&wanted()&&!blocked&&canRecover()&&!audio.ended&&!!audio.getAttribute('src')&&(!audio.error||audio.error.code===2);}
 function stop(){invalidate();blocked=true;phase='stopped';}
 function suspend(){invalidate();phase=available()?'suspended':'offline';}
 function denied(){stop();phase='blocked';onBlocked();status('듣던 위치를 복원했어요. 재생 버튼을 누르면 이어집니다.');}
 function schedule(delay=12000,soft=false){
  if(key()!==identity)reset();
  if(!eligible()||timer!==null)return;
  if(!available()){phase='offline';return;}
  timer=later(()=>{
   timer=null;
   if(!eligible())return;
   if(!available()){phase='offline';return;}
   if(now()-lastProgress<delay){schedule(delay,soft);return;}
   if(soft&&audio.paused&&!audio.error&&!needsRestore)resumeBuffered();else retry();
  },delay);
 }
 function resumeBuffered(){
  if(!eligible()||softPending)return;
  const token=++version,track=key();softPending=true;phase='resuming';
  let request;try{request=audio.play();}catch(error){request=Promise.reject(error);}
  Promise.resolve(request).then(()=>{
   if(token!==version||track!==key()||!eligible())return;
   // Keep the existing source and its buffer. A real stall may still need reload.
   lastProgress=now();schedule();
  },error=>{
   if(token!==version||track!==key()||!eligible())return;
   if(error?.name==='NotAllowedError')denied();else schedule();
  }).finally(()=>{if(token===version)softPending=false;});
 }
 function retry(){
  if(!eligible())return;
  attempts=Math.min(attempts+1,9);invalidate();const token=version,track=key();
  const resume=Number.isFinite(audio.currentTime)&&audio.currentTime>0?audio.currentTime:position;
  position=resume;needsRestore=true;reloading=true;phase='reconnecting';stableSince=lastProgress=now();
  status('음원 연결을 다시 시도하고 있어요. 듣던 위치에서 이어집니다.');
  metadata=()=>{
   detachMetadata();if(token!==version||track!==key()||!eligible()){reloading=false;return;}
   try{if(resume>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(resume,Math.max(0,audio.duration-.05));}
   catch{reloading=false;schedule();return;}
   needsRestore=false;
   let request;try{request=audio.play();}catch(error){request=Promise.reject(error);}
   Promise.resolve(request).catch(error=>{
    if(token!==version||track!==key()||!eligible())return;
    if(error?.name==='NotAllowedError')denied();else schedule();
   }).finally(()=>{if(token===version)reloading=false;});
  };
  audio.addEventListener('loadedmetadata',metadata);
  try{audio.load();}catch{reloading=false;detachMetadata();}
  schedule(12000+attempts*2000);
 }
 audio.addEventListener('play',()=>{if(!reloading&&!softPending){if(blocked)reset();lastProgress=now();}});
 audio.addEventListener('pause',()=>{if(reloading)return;if(wanted())schedule(2000,true);else stop();});
 audio.addEventListener('ended',stop);
 audio.addEventListener('seeked',()=>{if(!reloading){position=audio.currentTime||0;lastProgress=now();clear();}});
 audio.addEventListener('timeupdate',()=>{
  if(key()!==identity)reset();
  if(audio.currentTime>position+.05){position=audio.currentTime;lastProgress=now();clear();phase='playing';if(now()-stableSince>=30000)attempts=0;}
 });
 for(const name of ['waiting','stalled'])audio.addEventListener(name,()=>{phase='buffering';schedule();});
 audio.addEventListener('error',()=>{if(audio.error?.code===2)schedule(2000);else stop();});
 const controller={reset,stop,suspend,
  online:()=>{if(eligible())schedule(1000,audio.paused&&!audio.error);},
  resume:()=>{if(eligible()&&(audio.paused||audio.readyState<3))schedule(1000,audio.paused&&!audio.error);},
  snapshot:()=>({phase,attempts,position,needsRestore,pending:timer!==null})};
 controllers.set(audio,controller);return controller;
}
root.NoaPlaybackRecovery={attach};
})(typeof window==='object'?window:globalThis);
