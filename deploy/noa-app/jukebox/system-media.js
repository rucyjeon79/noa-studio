/* Platform adapter, activated only by the N80 JukeBox playback owner. */
(()=>{
'use strict';if(window.N80JukeBoxMedia)return;
const attached=new WeakMap();
function attach(audio,api,{onInterrupt=()=>{},onResume=()=>{}}={}){
 if(attached.has(audio))return attached.get(audio);
 const session=navigator.mediaSession,audioSession=navigator.audioSession;
 let metaKey='',lastPosition=0,interrupted=audioSession?.state==='interrupted';
 function playbackType(){try{if(audioSession&&!interrupted)audioSession.type='playback';}catch{}}
 function position(){
  if(!session?.setPositionState)return;
  try{
   if(!Number.isFinite(audio.duration)||audio.duration<=0||api.snapshot().closed){session.setPositionState();return;}
   session.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate||1,position:Math.min(audio.duration,Math.max(0,audio.currentTime||0))});
  }catch{}
 }
 function sync(){
  if(!session)return;
  const state=api.snapshot(),row=api.record(state.key);
  try{
   if(state.closed||!row?.audio){session.metadata=null;session.playbackState='none';metaKey='';position();return;}
   const title=window.NoaBrowse?.displayTitle?.(row)||row.title||'NOA STUDIO';
   const artist=window.NoaBrowse?.genreName?.(row.genre)||'미분류';
   const next=JSON.stringify([state.key,title,artist,row.thumb]);
   if(next!==metaKey&&window.MediaMetadata){
    const artwork=row.thumb?[{src:new URL(row.thumb,location.href).href}]:[];
    session.metadata=new MediaMetadata({title,artist,album:'NOA STUDIO',artwork});metaKey=next;
   }
   session.playbackState=state.desiredPlaying&&!interrupted?'playing':'paused';
   position();
  }catch{}
 }
 const actions={
  play:()=>api.play(api.currentKey()),pause:()=>api.pause(),stop:()=>api.close(),
  previoustrack:()=>api.previous(),nexttrack:()=>api.next(),
  seekto:details=>api.seek(details.seekTime),
  seekbackward:details=>api.seek(audio.currentTime-(Number.isFinite(details.seekOffset)&&details.seekOffset>0?details.seekOffset:10)),
  seekforward:details=>api.seek(audio.currentTime+(Number.isFinite(details.seekOffset)&&details.seekOffset>0?details.seekOffset:10))
 };
 for(const [name,handler]of Object.entries(actions))try{session?.setActionHandler(name,details=>{handler(details||{});sync();});}catch{}
 audio.addEventListener('play',playbackType);
 for(const name of ['playing','pause','ended','loadedmetadata','durationchange','seeked','ratechange'])audio.addEventListener(name,sync);
 audio.addEventListener('timeupdate',()=>{const now=Date.now();if(now-lastPosition>=1000){lastPosition=now;position();}});
 for(const name of ['n80-jukebox-state','noa-inline-record-saved'])window.addEventListener(name,sync);
 audioSession?.addEventListener?.('statechange',()=>{
  const wasInterrupted=interrupted;interrupted=audioSession.state==='interrupted';
  if(interrupted)onInterrupt();else if(wasInterrupted&&audioSession.state==='active')onResume();
  sync();
 });
 // Selecting a track can precede this adapter. Hydrate the card from the owner.
 if(!audio.paused)playbackType();sync();
 const controller={sync,interrupted:()=>interrupted,capabilities:()=>({mediaSession:!!session,audioSession:!!audioSession})};
 attached.set(audio,controller);return controller;
}
window.N80JukeBoxMedia=Object.freeze({attach});
})();
