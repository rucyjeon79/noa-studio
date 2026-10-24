import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
class Element {
 constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.attrs={};this.textContent='';}
 append(...nodes){this.children.push(...nodes);}
 prepend(...nodes){this.children.unshift(...nodes);}
 replaceChildren(...nodes){this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=v;}
 click(){this.onclick?.();}
}
const all=(node,predicate)=>[...node.children.flatMap(c=>typeof c==='object'?[c,...all(c,predicate)]:[])].filter(predicate);
const text=node=>node.textContent+node.children.map(text).join('');
function fixture(kind='곡',query=''){
 const host=new Element('section'),location={href:'https://noastudio.ai.kr/noa-music.php'+query,search:query};
 const sandbox={window:{addEventListener(){}},document:{createElement:tag=>new Element(tag),querySelectorAll:()=>[]},location,history:{replaceState(_a,_b,url){location.href=String(url);}},URL,URLSearchParams,fetch:()=>Promise.resolve({ok:false})};
 vm.runInNewContext(fs.readFileSync(new URL('../../deploy/noa-browse.js',import.meta.url),'utf8'),sandbox);
 const rows=[{key:'ten',genre:'kpop-original',title:'Ten',ep:10},{key:'two',genre:'kpop-original',title:'Two',ep:2},{key:'eleven',genre:'kpop-original',title:'Eleven',ep:11},{key:'loose',genre:'kpop-original',title:'Loose'},{key:'foreign',genre:'jpop-original',title:'Foreign',ep:1},{key:'story',genre:'your-story',title:'Story'},{key:'cover',genre:'cover-reborn',title:'Cover'}];
 if(kind==='영상')rows.forEach(r=>{r.kind='video';r.video=r.key;});
 let model;model=sandbox.window.NoaBrowse.mount({host,rows,kind,onChange:()=>model.apply(rows)});model.apply(rows);
 const level=n=>all(host,x=>x.dataset.browseLevel===String(n))[0];
 const cards=n=>all(level(n),x=>x.className==='noa-browse-card');
 return{host,rows,model,level,cards};
}
for(const kind of ['곡','영상'])test(kind+': four persistent levels, genre isolation, numeric EP order, loose songs and collapse',()=>{
 const f=fixture(kind);assert.equal(f.cards(1).length,4);assert.equal(f.level(2),undefined);
 f.cards(1)[0].click();assert.equal(f.cards(1).length,4);assert.equal(f.cards(2).length,4);assert.equal(f.level(3),undefined);
 f.cards(2)[0].click();assert.equal(f.cards(1).length,4);assert.equal(f.cards(2).length,4);assert.deepEqual(f.cards(3).map(c=>text(c.children[1].children[0])),['ACT 1','ACT 2']);
 assert.match(text(f.level(3)),/Loose/);assert.doesNotMatch(text(f.level(3)),/Foreign/);assert.equal(f.level(4),undefined);
 f.cards(3)[0].click();assert.deepEqual(all(f.level(4),x=>x.className==='noa-inline-song').map(text),['EP.2 · Two','EP.10 · Ten']);
 f.cards(3)[1].click();assert.match(text(f.level(4)),/Eleven/);assert.doesNotMatch(text(f.level(4)),/Two/);
 f.cards(3)[1].click();assert.equal(f.level(4),undefined);
 f.cards(2)[1].click();assert.equal(f.level(4),undefined);assert.equal(f.cards(3).length,1);f.cards(3)[0].click();assert.match(text(f.level(4)),/Foreign/);
 for(const i of [2,3]){f.cards(1)[i].click();assert.equal(f.cards(2).length,1);assert.equal(f.level(3),undefined);f.cards(2)[0].click();assert.match(text(f.level(3)),i===2?/Story/:/Cover/);}
});
test('deep links expand ACT while custom queue ordering is preserved',()=>{const f=fixture('곡','?genre=kpop-original&act=1');assert(f.level(4));const ordered=[f.rows[0],f.rows[1]];assert.deepEqual(Array.from(f.model.apply(ordered,true).queue,r=>r.key),['ten','two']);});
