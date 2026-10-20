import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../deploy/noa-history.js',import.meta.url),'utf8');
function open({stored='[]',items=[],my=false}={}){
 const events={},storage=new Map([['noa-media-history-v1',stored]]);
 const node=()=>({children:[],append(child){this.children.push(child)},replaceChildren(child){this.children=[child]}}),sound=node(),video=node();
 const context={sessionStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},window:{addEventListener:(name,fn)=>events[name]=fn},document:{getElementById:id=>my?(id==='my-recent'?sound:video):null,createElement:node},fetch:async()=>({ok:true,json:async()=>({items})})};
 vm.runInNewContext(source,context);return {storage,sound,video,record:detail=>events['noa-media-activity']({detail})};
}
test('history tolerates damaged storage, bounds records and deduplicates only matching media identities',()=>{
 const p=open({stored:'invalid'});p.record({type:'audio',key:'same'});p.record({type:'youtube',key:'same'});p.record({type:'audio',key:'same'});p.record({type:'unknown',key:'x'});
 assert.deepEqual(JSON.parse(p.storage.get('noa-media-history-v1')),[{type:'audio',key:'same'},{type:'youtube',key:'same'}]);for(let n=0;n<80;n++)p.record({type:'youtube',key:String(n)});assert.equal(JSON.parse(p.storage.get('noa-media-history-v1')).length,40);
});
test('MY resolves current accessible catalog, separates routes and excludes inaccessible or unverified audio',async()=>{
 const p=open({my:true,stored:JSON.stringify([{type:'youtube',key:'publicvideo'},{type:'youtube',key:'privatevideo'},{type:'audio',key:'share'},{type:'audio',key:'actual'}]),items:[{title:'<b>Title</b>',youtubeId:'publicvideo'},{title:'Share',key:'share',sunoUrl:'https://suno.com/song/x'},{title:'Actual',key:'actual',audioVerified:true,audioUrl:'/data/noa-audio/actual.wav'}]});await new Promise(r=>setImmediate(r));
 const links=host=>host.children[0].children.map(li=>li.children[0]);assert.equal(links(p.video).length,1);assert.equal(links(p.video)[0].href,'/noa-youtube.php?track=publicvideo');assert.equal(links(p.video)[0].textContent,'<b>Title</b>');assert.equal(links(p.sound).length,1);assert.equal(links(p.sound)[0].href,'/noa-music.php?track=actual');
});
