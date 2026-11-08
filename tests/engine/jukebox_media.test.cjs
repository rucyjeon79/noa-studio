const {test}=require('node:test');const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('deploy/noa-app/jukebox/system-media.js','utf8');
function target(fields={}){const listeners=new Map();return Object.assign({addEventListener(n,f){if(!listeners.has(n))listeners.set(n,new Set());listeners.get(n).add(f)},emit(n){for(const f of listeners.get(n)||[])f()},count(n){return listeners.get(n)?.size||0}},fields)}
function fixture({media=true,audioSession=true,unsupported=false}={}){
 const actions={},positions=[],calls=[];
 const state={key:'one',desiredPlaying:false,closed:false};
 const row={key:'one',title:'하루의 끝에',genre:'ballad',audio:'/stream.mp3',thumb:'/cover.jpg'};
 const session={metadata:null,playbackState:'none',setActionHandler(n,f){if(unsupported&&n==='seekforward')throw Error('unsupported');actions[n]=f},setPositionState(s){positions.push(s)}};
 const platform=target({type:'auto',state:'inactive'});
 const audio=target({currentTime:42,duration:180,playbackRate:1,paused:true});
 const api={snapshot:()=>({...state}),record:()=>row,currentKey:()=>state.key,
 play(key){calls.push(['play',key]);state.desiredPlaying=true;state.closed=false},
 pause(){calls.push(['pause']);state.desiredPlaying=false},
 close(){calls.push(['close']);state.desiredPlaying=false;state.closed=true},
 previous(){calls.push(['previous'])},next(){calls.push(['next'])},
 seek(seconds){if(Number.isFinite(seconds))audio.currentTime=Math.max(0,Math.min(audio.duration,seconds));calls.push(['seek',audio.currentTime])}};
 const context=target({navigator:{...(media?{mediaSession:session}:{}),...(audioSession?{audioSession:platform}:{})},MediaMetadata:class{constructor(data){Object.assign(this,data)}},URL,location:new URL('https://noastudio.ai.kr/noa-music.php')});context.window=context;
 vm.createContext(context);vm.runInContext(source,context);
 let interrupts=0,resumes=0;
 const adapter=context.N80JukeBoxMedia.attach(audio,api,{onInterrupt:()=>interrupts++,onResume:()=>resumes++});
 return {context,adapter,audio,session,platform,state,row,calls,actions,positions,interrupts:()=>interrupts,resumes:()=>resumes};
}
test('initial selected MP3 hydrates the lock-screen card without replaying it',()=>{const f=fixture();assert.equal(f.session.metadata.title,'하루의 끝에');assert.equal(f.session.metadata.artwork[0].src,'https://noastudio.ai.kr/cover.jpg');assert.equal(f.session.playbackState,'paused');assert.deepEqual(f.calls,[]);});
test('all OS controls use the single N80 owner, including explicit stop',()=>{const f=fixture();f.actions.play();assert.equal(f.session.playbackState,'playing');f.actions.pause();assert.equal(f.session.playbackState,'paused');f.actions.nexttrack();f.actions.previoustrack();f.actions.stop();assert.deepEqual(f.calls,[['play','one'],['pause'],['next'],['previous'],['close']]);assert.equal(f.session.playbackState,'none');assert.equal(f.session.metadata,null);assert.equal(f.positions.at(-1),undefined);});
test('OS seeking clamps positions and ignores invalid seek input',()=>{const f=fixture();f.actions.seekto({seekTime:999});assert.equal(f.audio.currentTime,180);f.actions.seekbackward({seekOffset:200});assert.equal(f.audio.currentTime,0);f.actions.seekforward({seekOffset:Infinity});assert.equal(f.audio.currentTime,10);f.actions.seekto({seekTime:NaN});assert.equal(f.audio.currentTime,10);});
test('playback type is requested on actual play and interrupts suppress recovery',()=>{const f=fixture();assert.equal(f.platform.type,'auto');f.audio.emit('play');assert.equal(f.platform.type,'playback');f.state.desiredPlaying=true;f.platform.state='interrupted';f.platform.emit('statechange');assert.equal(f.interrupts(),1);assert.equal(f.adapter.interrupted(),true);assert.equal(f.session.playbackState,'paused');f.platform.state='active';f.platform.emit('statechange');assert.equal(f.resumes(),1);assert.equal(f.adapter.interrupted(),false);});
test('inactive audio sessions never force playback after a call or another app',()=>{const f=fixture();f.platform.state='interrupted';f.platform.emit('statechange');f.platform.state='inactive';f.platform.emit('statechange');assert.equal(f.resumes(),0);assert.deepEqual(f.calls,[]);});
test('renaming the current song refreshes metadata without replaying audio',()=>{const f=fixture();f.row.title='수정한 제목';f.context.emit('noa-inline-record-saved');assert.equal(f.session.metadata.title,'수정한 제목');assert.equal(f.audio.currentTime,42);assert.deepEqual(f.calls,[]);});
test('buffering retains a pauseable system card until the listener pauses',()=>{const f=fixture();f.state.desiredPlaying=true;f.audio.paused=true;f.context.emit('n80-jukebox-state');assert.equal(f.session.playbackState,'playing');f.actions.pause();assert.equal(f.session.playbackState,'paused');});
test('duplicate adapters and script execution install one set of listeners',()=>{const f=fixture();vm.runInContext(source,f.context);assert.equal(f.context.N80JukeBoxMedia.attach(f.audio,{}),f.adapter);assert.equal(f.audio.count('play'),1);assert.equal(f.platform.count('statechange'),1);});
test('missing or partly unsupported platform APIs never prevent normal MP3 playback',()=>{for(const options of [{media:false},{audioSession:false},{media:false,audioSession:false},{unsupported:true}]){const f=fixture(options);f.audio.emit('play');f.adapter.sync();assert.deepEqual(f.calls,[]);}});
test('unknown duration clears a stale position instead of publishing invalid data',()=>{const f=fixture();f.audio.duration=NaN;f.audio.emit('loadedmetadata');assert.equal(f.positions.at(-1),undefined);});
