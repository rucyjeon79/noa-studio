/* Retry transient media failures only while the listener still wants this track. */
(function(root){
'use strict';
function attach(audio,{wanted,key,status,now=()=>Date.now(),later=setTimeout,cancel=clearTimeout}){
 let timer=null,version=0,attempts=0,blocked=false,reloading=false,metadata=null;
 let position=audio.currentTime||0,lastProgress=now(),stableSince=now(),identity=key();
 function clear(){if(timer!==null){cancel(timer);timer=null;}}
 function detachMetadata(){if(metadata){audio.removeEventListener('loadedmetadata',metadata);metadata=null;}}
 function reset(){clear();detachMetadata();version++;attempts=0;blocked=false;reloading=false;identity=key();position=audio.currentTime||0;lastProgress=stableSince=now();}
 function eligible(){return wanted()&&!blocked&&!audio.ended&&!!audio.getAttribute('src')&&(!audio.error||audio.error.code===2);}
 function stop(){clear();detachMetadata();version++;reloading=false;blocked=true;}
 function schedule(delay=12000){
  if(key()!==identity)reset();
  if(!eligible()||timer!==null)return;
  timer=later(()=>{timer=null;if(!eligible())return;if(now()-lastProgress<delay){schedule(delay);return;}retry();},delay);
 }
 function retry(){
  if(!eligible())return;
  if(attempts>=3){stop();status('연결이 불안정해 재생을 멈췄어요. 재생 버튼을 누르면 듣던 위치에서 다시 시도합니다.');return;}
  attempts++;clear();detachMetadata();const token=++version,track=key();
  const resume=Number.isFinite(audio.currentTime)&&audio.currentTime>0?audio.currentTime:position;
  position=resume;reloading=true;stableSince=lastProgress=now();
  status('음원 연결을 다시 시도하고 있어요. 듣던 위치에서 이어집니다.');
  metadata=()=>{
   detachMetadata();if(token!==version||track!==key()||!eligible()){reloading=false;return;}
   try{if(resume>0&&Number.isFinite(audio.duration))audio.currentTime=Math.min(resume,Math.max(0,audio.duration-.05));}
   catch{reloading=false;schedule();return;}
   const request=audio.play();
   Promise.resolve(request).catch(error=>{
    if(token!==version||track!==key())return;
    if(error?.name==='NotAllowedError'){stop();status('듣던 위치를 복원했어요. 재생 버튼을 누르면 이어집니다.');}
    else schedule();
   }).finally(()=>{if(token===version)reloading=false;});
  };
  audio.addEventListener('loadedmetadata',metadata);
  audio.load();schedule(12000+attempts*2000);
 }
 audio.addEventListener('play',()=>{if(!reloading){if(blocked)reset();blocked=false;lastProgress=now();}});
 audio.addEventListener('pause',()=>{if(!reloading&&!audio.error)stop();});
 audio.addEventListener('ended',stop);
 audio.addEventListener('timeupdate',()=>{
  if(key()!==identity)reset();
  if(audio.currentTime>position+.05){position=audio.currentTime;lastProgress=now();clear();if(now()-stableSince>=30000)attempts=0;}
 });
 for(const name of ['waiting','stalled'])audio.addEventListener(name,()=>schedule());
 audio.addEventListener('error',()=>{if(audio.error?.code===2)schedule(2000);else stop();});
 // This deliberately does not restart ordinary pauses or play on visibility changes.
 return {reset,stop,online:()=>{if(eligible())schedule(1000);}};
}
root.NoaPlaybackRecovery={attach};
})(typeof window==='object'?window:globalThis);
