import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function openSound(){
 const php=fs.readFileSync(new URL('../deploy/noa-music.php',import.meta.url),'utf8');
 const script=php.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
 const nodes=new Map(),events={},audioEvents={};
 const element=()=>({dataset:{},style:{},classList:{toggle(){}},hidden:false,value:'',textContent:'',options:[],addEventListener(){},setAttribute(k,v){this[k]=v},removeAttribute(k){delete this[k]},replaceChildren(){},append(){},querySelector(){return element()}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id)};
 const audio=Object.assign(node('sound-player'),{paused:true,played:0,currentTime:0,duration:100,play(){this.paused=false;this.played++;return Promise.resolve()},pause(){this.paused=true},load(){},addEventListener(n,f){audioEvents[n]=f}});node('volume').value='70';
 const songs=[{key:'one',title:'Share only',genre:'kpop-original',video:'',suno:'https://suno.com/song/one',audio:'',kind:'single',ep:'1',lyrics:'Original lyrics'},...['two','three'].map((key,i)=>({key,title:key,genre:'kpop-original',video:'',suno:'https://suno.com/song/'+key,audio:'https://noastudio.ai.kr/data/noa-audio/'+key+'.wav',kind:'single',ep:String(i+2),lyrics:'lyrics'}))];
 const buttons=songs.map(s=>Object.assign(element(),{dataset:{key:s.key,audio:s.audio}}));
 const storage=new Map();const context={console,URLSearchParams,location:{search:'',origin:'https://noastudio.ai.kr'},sessionStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},navigator:{},document:{getElementById:node,querySelectorAll:()=>buttons,querySelector:()=>element(),createElement:element,head:{append(){}}},window:{addEventListener:(n,f)=>events[n]=f}};
 vm.createContext(context);vm.runInContext(script.replace(/<\?=json_encode\(\$songs,[\s\S]*?\?>/,JSON.stringify(songs)),context);
 return {php,context,node,audio,buttons,audioEvents,events,storage,run:code=>vm.runInContext(code,context)};
}
test('share-only record shows original lyrics and Suno link without any audio or YouTube playback',()=>{
 const p=openSound();p.run('select(buttons[0],true)');assert.equal(p.audio.played,0);assert.equal(p.audio.src,undefined);assert.equal(p.node('lyrics').textContent,'Original lyrics');assert.equal(p.node('watch').href,'https://suno.com/song/one');assert.match(p.node('player-status').textContent,/실제 음원 파일 연결/);assert.doesNotMatch(p.php,/iframe_api|new YT[.]Player|youtube-player/);
});
test('native audio queue excludes share-only references; next/previous keep ordered files',()=>{
 const p=openSound();p.run('select(buttons[1],true)');assert.equal(p.audio.played,1);assert.match(p.audio.src,/two.wav$/);assert.equal(p.audio.volume,.7);p.run('move(1)');assert.match(p.audio.src,/three.wav$/);p.run('move(-1)');assert.match(p.audio.src,/two.wav$/);assert.equal(p.run('queue().length'),2);
});
test('seek, pause and background operate only on native audio',()=>{
 const p=openSound();p.run('select(buttons[1],true)');p.node('seek').oninput({target:{value:'250'}});assert.equal(p.audio.currentTime,25);p.node('pause-play').onclick();assert.equal(p.audio.paused,true);p.node('pause-play').onclick();assert.equal(p.audio.paused,false);p.events['noa-background']();assert.equal(p.audio.paused,true);
});
test('position persistence and playback failure remain honest',()=>{
 const p=openSound();p.run('select(buttons[1],false)');p.audio.currentTime=42;p.audioEvents.timeupdate();assert.equal(JSON.parse(p.storage.get('noa-playback-position')).seconds,42);p.audioEvents.error();assert.match(p.node('player-status').textContent,/파일 형식과 접근 권한/);assert.equal(p.node('seek-clock').textContent,'0:42 / 1:40');
});
