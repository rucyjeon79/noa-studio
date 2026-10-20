import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function openPlayer({selectFirst=true}={}){
 const php=fs.readFileSync(new URL('../deploy/noa-music.php',import.meta.url),'utf8');
 const script=php.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
 const nodes=new Map(),timers=new Map(),events={};let tick=0,options,instance;
 const element=()=>({dataset:{},style:{},classList:{toggle(){}},hidden:false,value:'',textContent:'',options:[],addEventListener(){},setAttribute(){},replaceChildren(){},append(){}});
 const node=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 node('volume').value='70';
 const songs=[1,2].map(i=>({key:'single:kpop-original:0'+i,title:'Track '+i,genre:'kpop-original',video:'abcdefghij'+i,kind:'single',cast:'female',ep:String(i),lyrics:'lyrics'}));
 const buttons=songs.map(s=>Object.assign(element(),{dataset:{key:s.key,title:s.title,genre:s.genre,video:s.video}}));
 const context={console,URLSearchParams,location:{search:'',origin:'https://noastudio.ai.kr'},sessionStorage:{getItem(){return null},setItem(){}},navigator:{},setInterval(){},setTimeout(fn){const id=++tick;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id)},document:{getElementById:node,querySelectorAll:()=>buttons,querySelector:()=>element(),createElement:element,head:{append(){}}},window:{addEventListener(name,fn){events[name]=fn;}}};
 vm.createContext(context);vm.runInContext(script.replace(/<\?=json_encode\(\$songs,[\s\S]*?\?>/,JSON.stringify(songs)),context);
 if(selectFirst)vm.runInContext('select(buttons[0],false)',context);
 const player={state:5,played:0,loads:[],volume:null,playVideo(){this.played++},pauseVideo(){this.state=2},stopVideo(){},setVolume(v){this.volume=v},getPlayerState(){return this.state},loadVideoById(v){this.loads.push(v)},cueVideoById(v){this.loads.push(v)},getCurrentTime(){return 0},getDuration(){return 0}};
 const api={PlayerState:{PLAYING:1,PAUSED:2,ENDED:0,BUFFERING:3},Player:class{constructor(id,o){options=o;instance=player;return player;}}};
 return {node,timers,context,buttons,player,background(){events['noa-background']();},loadAPI(){context.YT=api;context.window.YT=api;context.window.onYouTubeIframeAPIReady();},ready(){options.events.onReady({target:instance});},state(n){player.state=n;options.events.onStateChange({data:n});},expire(){for(const[id,fn]of [...timers]){timers.delete(id);fn();}},selectSecond(){vm.runInContext('select(buttons[1],true)',context);}};
}
test('play requested before iframe readiness survives API loading and uses selected volume',()=>{
 const ui=openPlayer();ui.node('pause-play').onclick();assert.equal(ui.timers.size,1);ui.loadAPI();ui.ready();assert.equal(ui.player.volume,70);assert.equal(ui.player.loads[0].videoId,'abcdefghij1');assert.equal(ui.timers.size,1);ui.state(1);assert.equal(ui.timers.size,0);assert.equal(ui.node('player-status').textContent,'재생 중');
});
test('blocked playback gets an actionable message; pause cancels the wait',()=>{
 const ui=openPlayer();ui.loadAPI();ui.ready();ui.node('pause-play').onclick();assert.equal(ui.player.played,1);ui.expire();assert.match(ui.node('player-status').textContent,/YouTube에서 보기/);ui.node('pause-play').onclick();ui.state(1);ui.node('pause-play').onclick();assert.equal(ui.timers.size,0);assert.equal(ui.player.state,2);
});
test('switching tracks replaces the timer; background cancels queued autoplay',()=>{
 const ui=openPlayer();ui.node('pause-play').onclick();ui.selectSecond();assert.equal(ui.timers.size,1);ui.background();assert.equal(ui.timers.size,0);
 ui.loadAPI();ui.ready();assert.equal(ui.player.loads[0].videoId,'abcdefghij2');assert.equal(ui.timers.size,0);ui.state(2);assert.equal(ui.timers.size,0);
});

test('category landing waits for a real song selection',()=>{const ui=openPlayer({selectFirst:false});ui.node('pause-play').onclick();assert.equal(ui.timers.size,0);ui.selectSecond();assert.equal(ui.timers.size,1);});
