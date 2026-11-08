const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm');const fs=require('node:fs');const env={setTimeout,clearTimeout};vm.runInNewContext(fs.readFileSync('deploy/noa-app/playback-recovery.js','utf8'),env);const {attach}=env.NoaPlaybackRecovery;
function fixture(options={}){
 let ms=0,want=true,key='one',next=1;const timers=new Map(),listeners=new Map(),messages=[];
 const audio={currentTime:42,duration:180,paused:false,ended:false,error:null,loads:0,plays:0,
  getAttribute:()=>'/stream.php?key='+key,
  addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f);},
  removeEventListener(n,f){listeners.get(n)?.delete(f);},
  emit(n){for(const f of [...listeners.get(n)||[]])f();},
  load(){this.loads++;this.currentTime=0;this.error=null;this.paused=true;this.emit('pause');},
  play(){this.plays++;this.paused=false;this.emit('play');return Promise.resolve();}};
 const c=attach(audio,{wanted:()=>want,key:()=>key,status:x=>messages.push(x),now:()=>ms,later:(f,d)=>{const id=next++;timers.set(id,{f,at:ms+d});return id;},cancel:id=>timers.delete(id),...options});
 const tick=d=>{ms+=d;for(const [id,t]of [...timers])if(t.at<=ms){timers.delete(id);t.f();}};
 return {audio,c,tick,messages,timers,setWant:v=>want=v,setKey:v=>key=v};
}
test('network failure reloads same track and restores exact stopped position',async()=>{const f=fixture();f.audio.error={code:2};f.audio.emit('error');f.tick(2000);assert.equal(f.audio.loads,1);f.audio.emit('loadedmetadata');await Promise.resolve();assert.equal(f.audio.currentTime,42);assert.equal(f.audio.plays,1);});
test('brief buffering that makes progress never restarts the audio',()=>{const f=fixture();f.audio.emit('waiting');f.tick(3000);f.audio.currentTime=43;f.audio.emit('timeupdate');f.tick(20000);assert.equal(f.audio.loads,0);});
test('pause cancels pending recovery and must never auto resume',()=>{const f=fixture();f.audio.emit('stalled');f.setWant(false);f.audio.paused=true;f.audio.emit('pause');f.tick(30000);f.c.online();f.tick(30000);assert.equal(f.audio.loads,0);});
test('changing track cancels stale metadata restore',()=>{const f=fixture();f.audio.emit('stalled');f.tick(12000);f.setKey('two');f.c.reset();f.audio.currentTime=0;f.audio.emit('loadedmetadata');assert.equal(f.audio.plays,0);assert.equal(f.audio.currentTime,0);});
test('transient failures keep retrying with capped delay until the listener stops',()=>{const f=fixture();f.audio.emit('stalled');for(let i=0;i<15;i++)f.tick(30000);assert.equal(f.audio.loads,15);assert.equal(f.timers.size,1);f.setWant(false);f.tick(30000);assert.equal(f.audio.loads,15);});
test('unexpected pause resumes the same buffered audio without reloading',async()=>{const f=fixture();f.audio.paused=true;f.audio.emit('pause');f.tick(2000);await Promise.resolve();assert.equal(f.audio.loads,0);assert.equal(f.audio.plays,1);assert.equal(f.audio.currentTime,42);});
test('format and access-like source errors are not retried',()=>{for(const code of [1,3,4]){const f=fixture();f.audio.error={code};f.audio.emit('error');f.tick(30000);assert.equal(f.audio.loads,0);}});
test('browser autoplay denial offers manual continuation without retry loop',async()=>{const f=fixture();f.audio.play=()=>Promise.reject({name:'NotAllowedError'});f.audio.emit('stalled');f.tick(12000);f.audio.emit('loadedmetadata');await new Promise(r=>setImmediate(r));f.tick(30000);assert.equal(f.audio.loads,1);assert.match(f.messages.at(-1),/재생 버튼/);});

test('offline stalls make no requests and recover once after reconnect',()=>{let online=false;const f=fixture({available:()=>online});f.audio.error={code:2};f.audio.emit('error');f.tick(60000);assert.equal(f.audio.loads,0);assert.equal(f.timers.size,0);online=true;f.c.online();f.c.online();f.tick(1000);assert.equal(f.audio.loads,1);});
test('going offline cancels an already scheduled reload',()=>{let online=true;const f=fixture({available:()=>online});f.audio.emit('stalled');online=false;f.c.suspend();f.tick(60000);assert.equal(f.audio.loads,0);assert.equal(f.timers.size,0);});
test('system interruptions prevent recovery until explicitly released',()=>{let interrupted=false;const f=fixture({canRecover:()=>!interrupted});f.audio.paused=true;f.audio.emit('pause');interrupted=true;f.c.suspend();f.c.online();f.tick(60000);assert.equal(f.audio.plays,0);interrupted=false;f.c.resume();f.tick(1000);assert.equal(f.audio.plays,1);assert.equal(f.audio.loads,0);});
test('pause during an interruption prevents later resume',()=>{const f=fixture();f.audio.paused=true;f.c.suspend();f.setWant(false);f.c.stop();f.c.resume();f.tick(60000);assert.equal(f.audio.plays,0);});
test('page suspension can resume but does not change user intent',()=>{const f=fixture();f.audio.paused=true;f.c.suspend();f.c.resume();f.tick(1000);assert.equal(f.audio.plays,1);});
test('an in-flight recovery cannot overwrite a later manual pause',async()=>{let reject;const f=fixture();f.audio.play=()=>new Promise((_,r)=>{reject=r});f.audio.paused=true;f.audio.emit('pause');f.tick(2000);f.setWant(false);f.c.stop();reject({name:'NotAllowedError'});await new Promise(r=>setImmediate(r));assert.equal(f.messages.length,0);assert.equal(f.timers.size,0);});
test('same-track replay ignores a stale rejected play request',async()=>{let reject,blocked=0;const f=fixture({onBlocked:()=>blocked++});f.audio.play=()=>new Promise((_,r)=>{reject=r});f.audio.paused=true;f.audio.emit('pause');f.tick(2000);f.c.reset();reject({name:'NotAllowedError'});await new Promise(r=>setImmediate(r));assert.equal(blocked,0);});
test('a changed track invalidates a scheduled recovery even without a reset event',()=>{const f=fixture();f.audio.emit('stalled');f.setKey('two');f.tick(12000);assert.equal(f.audio.loads,0);});
test('duplicate attachments reuse the single recovery controller',()=>{const f=fixture();assert.equal(attach(f.audio,{}),f.c);f.audio.emit('stalled');assert.equal(f.timers.size,1);});
test('denied buffered resume revokes intent without reloading or looping',async()=>{let blocked=0;const f=fixture({onBlocked:()=>blocked++});f.audio.play=()=>Promise.reject({name:'NotAllowedError'});f.audio.paused=true;f.audio.emit('pause');f.tick(2000);await new Promise(r=>setImmediate(r));f.tick(60000);assert.equal(f.audio.loads,0);assert.equal(blocked,1);assert.equal(f.c.snapshot().phase,'blocked');assert.equal(f.timers.size,0);});

test('reconnect after an interrupted reload still restores the saved position',()=>{let online=true;const f=fixture({available:()=>online});f.audio.error={code:2};f.audio.emit('error');f.tick(2000);assert.equal(f.audio.currentTime,0);online=false;f.c.suspend();online=true;f.c.online();f.tick(1000);assert.equal(f.audio.loads,2);assert.equal(f.audio.plays,0);f.audio.emit('loadedmetadata');assert.equal(f.audio.currentTime,42);assert.equal(f.audio.plays,1);});
test('backward seeks reset progress tracking without unnecessary stream reloads',()=>{const f=fixture();f.audio.currentTime=10;f.audio.emit('seeked');f.audio.emit('waiting');f.tick(3000);f.audio.currentTime=11;f.audio.emit('timeupdate');f.tick(20000);assert.equal(f.audio.loads,0);});
