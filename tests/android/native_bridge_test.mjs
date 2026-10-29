import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../../android/app/src/main/assets/noa-native-bridge.js',import.meta.url),'utf8');
function app(){
 const messages=[],events=[];
 class Media{constructor(id){this.id=id;this.muted=false;this.webStarts=0;}play(){this.webStarts++;return Promise.resolve('web');}dispatchEvent(e){events.push(e.type);}}
 const audio=new Media('sound-player'),dock={hidden:true},controls={};
 const rows=['single:jpop:02','single:jpop:01'].map(key=>({dataset:{key}}));
 const window={NoaAndroid:{postMessage(raw){messages.push(JSON.parse(raw));}},addEventListener(){}};window.top=window;
 const context={window,HTMLMediaElement:Media,Event:class{constructor(type){this.type=type;}},selected:rows[0],buttons:rows,queue:()=>rows,repeat:false,shuffle:false,queueMicrotask:fn=>fn(),document:{readyState:'complete',getElementById:id=>id==='sound-player'?audio:controls[id]||null,querySelector:()=>dock,addEventListener(){}}};
 context.select=(row)=>{context.selected=row;audio.pause();audio.load();};vm.runInNewContext(script,context);messages.length=0;
 const state=more=>window.NoaNativeBridge.state({key:rows[0].dataset.key,queue:rows.map(r=>r.dataset.key),position:12,duration:180,paused:false,playing:true,ended:false,volume:.7,closed:false,repeat:false,shuffle:false,error:false,...more});
 return {messages,events,audio,rows,window,context,Media,state,dock};
}
test('PWA queue order reaches native unchanged, without starting browser audio',async()=>{const a=app();await a.audio.play();assert.equal(a.audio.webStarts,0);assert.deepEqual(a.messages[0].queue,['single:jpop:02','single:jpop:01']);assert.equal(a.messages[0].key,'single:jpop:02');});
test('native state drives the original player controls without command echo',()=>{const a=app();a.state();assert.equal(a.audio.currentTime,12);assert.equal(a.audio.duration,180);assert.equal(a.audio.paused,false);assert.equal(a.dock.hidden,false);assert.ok(a.events.includes('playing'));assert.equal(a.messages.length,0);});
test('pause, seek and volume use native commands',()=>{const a=app();a.audio.pause();a.audio.currentTime=42;a.audio.volume=.4;assert.deepEqual(a.messages.map(x=>x.type),['pause','seek','volume']);assert.equal(a.messages[1].seconds,42);});
test('native next-track selection reuses PWA selection and never pauses the engine',()=>{const a=app();a.state({key:a.rows[1].dataset.key});assert.equal(a.context.selected,a.rows[1]);assert.equal(a.messages.length,0);});
test('video and preview audio keep their browser implementation and claim audio focus',async()=>{const a=app(),preview=new a.Media('preview');assert.equal(await preview.play(),'web');assert.equal(preview.webStarts,1);assert.equal(a.messages[0].type,'video');});
test('stale previous-track updates cannot undo a user selection',async()=>{const a=app();await a.audio.play();a.state({key:a.rows[1].dataset.key});assert.equal(a.context.selected,a.rows[0]);});
test('adapter contains no replacement navigation, hidden PWA controls or fabricated sorting',()=>{assert.doesNotMatch(script,/createElement\(['"]style|display\s*:\s*none|\.sort\(/);});

test('restored native queue reaches a fresh PWA document in the same order',()=>{const a=app();a.context.selected=null;a.context.activeQueue=null;let filtered=false;a.context.filter=()=>{filtered=true;};a.state();assert.deepEqual(Array.from(a.context.activeQueue),a.rows.map(r=>r.dataset.key));assert.ok(filtered);assert.equal(a.messages.length,0);});
