import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../../android/app/src/main/assets/noa-native-bridge.js',import.meta.url),'utf8');
const base='https://noastudio.ai.kr/noa-app/jukebox/stream.php?key=';
function app(keys=['single:kpop-original:01']){
 const messages=[];
 class Media {constructor(url){this.tagName='AUDIO';this.src=this.currentSrc=url;this.muted=false;this.webStarts=0;}play(){this.webStarts++;return Promise.resolve('web-preview');}}
 const window={NoaAndroid:{postMessage(raw){messages.push(JSON.parse(raw));}},__noaNativeAudio:{keys,urls:[]},addEventListener(){}};
 const context={window,NoaAndroid:window.NoaAndroid,HTMLMediaElement:Media,URL,location:{href:'https://noastudio.ai.kr/noa-music.php'},localStorage:{getItem(){return null;}},MutationObserver:class{observe(){}},setInterval(){},document:{body:{className:'',classList:{contains(){return false;}}},head:{append(){}},createElement(){return {};},querySelector(){return null;},addEventListener(){}}};
 vm.runInNewContext(script,context);messages.length=0;return {messages,Media,window};
}
test('catalogued public MP3 starts only the native audio engine',async()=>{
 const {messages,Media}=app();const audio=new Media(base+'single%3Akpop-original%3A01&type=audio');await audio.play();assert.equal(audio.webStarts,0);assert.equal(messages.length,1);assert.equal(messages[0].type,'play');assert.equal(messages[0].key,'single:kpop-original:01');
});
test('uncatalogued administrator preview keeps the original web playback path',async()=>{
 const {messages,Media}=app();const audio=new Media(base+'single%3Aprivate%3A01&type=audio');assert.equal(await audio.play(),'web-preview');assert.equal(audio.webStarts,1);assert.equal(messages.some(x=>x.type==='play'),false);assert.equal(messages[0].type,'video');
});
test('refreshed catalogue becomes native-playable without installing a second bridge',async()=>{
 const {messages,Media,window}=app([]);window.__noaNativeAudio={keys:['single:kpop-original:02'],urls:[]};const audio=new Media(base+'single%3Akpop-original%3A02&type=audio');await audio.play();assert.equal(audio.webStarts,0);assert.equal(messages[0].key,'single:kpop-original:02');
});

test('detached web media cannot steal focus or start a second audio engine',async()=>{
 const {messages,Media,window}=app();window.__noaNativeHidden=true;for(const key of ['single:kpop-original:01','single:private:01']){const audio=new Media(base+encodeURIComponent(key)+'&type=audio');await audio.play();assert.equal(audio.webStarts,0);}assert.equal(messages.length,0);
});
