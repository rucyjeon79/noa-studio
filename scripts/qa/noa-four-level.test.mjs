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
 querySelectorAll(selector){
  if(selector==='.noa-inline-act[data-act-number]')return all(this,n=>n.className==='noa-inline-act'&&n.dataset.actNumber);
  if(selector===':scope>.noa-browse-card,:scope>.noa-collection-tools>.noa-list-toggle')return [...this.children.filter(n=>n.className==='noa-browse-card'),...this.children.filter(n=>n.className==='noa-collection-tools').flatMap(n=>n.children.filter(c=>c.className.includes('noa-list-toggle')))];
  return [];
 }
 querySelector(selector){if(selector===':scope>[data-browse-level="4"]')return this.children.find(n=>n.dataset.browseLevel==='4')||null;return this.querySelectorAll(selector)[0]||null;}
 click(){this.onclick?.();}
}
const all=(node,predicate)=>[...node.children.flatMap(c=>typeof c==='object'?[c,...all(c,predicate)]:[])].filter(predicate);
const text=node=>node.textContent+node.children.map(text).join('');
function fixture(kind='곡',query='',providedRows=null){
 const host=new Element('section'),location={href:'https://noastudio.ai.kr/noa-music.php'+query,search:query};
 const sandbox={window:{addEventListener(){}},document:{createElement:tag=>new Element(tag),querySelectorAll:()=>[]},location,history:{replaceState(_a,_b,url){location.href=String(url);}},URL,URLSearchParams,fetch:()=>Promise.resolve({ok:false})};
 vm.runInNewContext(fs.readFileSync(new URL('../../deploy/noa-browse.js',import.meta.url),'utf8'),sandbox);
 const rows=providedRows||[{key:'ten',genre:'kpop-original',title:'Ten',ep:10},{key:'two',genre:'kpop-original',title:'Two',ep:2},{key:'eleven',genre:'kpop-original',title:'Eleven',ep:11},{key:'loose',genre:'kpop-original',title:'Loose'},{key:'foreign',genre:'jpop-original',title:'Foreign',ep:1},{key:'story',genre:'your-story',title:'Story'},{key:'cover',genre:'cover-reborn',title:'Cover'}];
 if(kind==='영상')rows.forEach(r=>{r.kind='video';r.video=r.key;});
 let model;model=sandbox.window.NoaBrowse.mount({host,rows,kind,onChange:()=>model.apply(rows)});model.apply(rows);
 const level=n=>all(host,x=>x.dataset.browseLevel===String(n)&&!x.hidden)[0];
 const cards=n=>all(level(n),x=>x.className==='noa-browse-card');
 return{host,rows,model,level,cards,api:sandbox.window.NoaBrowse};
}
for(const kind of ['곡','영상'])test(kind+': four persistent levels, genre isolation, numeric EP order, loose songs and collapse',()=>{
 const f=fixture(kind);assert.equal(f.cards(1).length,4);assert.equal(f.level(2),undefined);
 f.cards(1)[0].click();assert.equal(f.cards(1).length,4);assert.equal(f.cards(2).length,4);assert.equal(f.level(3),undefined);
 f.cards(2)[0].click();assert.equal(f.cards(1).length,4);assert.equal(f.cards(2).length,4);assert.deepEqual(f.cards(3).map(c=>text(c.children[1].children[0])),['ACT 1','ACT 2']);
 assert.match(text(f.level(3)),/Loose/);assert.doesNotMatch(text(f.level(3)),/Foreign/);assert.match(text(f.level(4)),/Loose/);
 f.cards(3)[0].click();assert.deepEqual(all(f.level(4),x=>x.className==='noa-inline-song').map(text),['EP.2 · Two','EP.10 · Ten']);
 f.cards(3)[1].click();assert.match(text(f.level(4)),/Eleven/);assert.doesNotMatch(text(f.level(4)),/Two/);
 f.cards(3)[1].click();assert.match(text(f.level(4)),/Loose/);
 assert.equal(all(f.host,x=>x.dataset.unclassified==='true').length,1);
 f.cards(2)[1].click();assert.equal(f.level(4),undefined);assert.equal(f.cards(3).length,1);assert.equal(all(f.host,x=>x.dataset.unclassified==='true').length,0);f.cards(3)[0].click();assert.match(text(f.level(4)),/Foreign/);
 for(const i of [2,3]){f.cards(1)[i].click();assert.equal(f.cards(2).length,1);assert.equal(f.level(3),undefined);f.cards(2)[0].click();assert.match(text(f.level(3)),i===2?/Story/:/Cover/);}
});
test('deep links expand ACT while custom queue ordering is preserved',()=>{const f=fixture('곡','?genre=kpop-original&act=1');assert(f.level(4));const ordered=[f.rows[0],f.rows[1]];assert.deepEqual(Array.from(f.model.apply(ordered,true).queue,r=>r.key),['ten','two']);});

test('shared ACT has one row per canonical song, prefers its declared video, and keeps Shorts in All',()=>{const rows=[{key:'short',orderKey:'same-song',genre:'kpop-original',title:'Shorts',ep:1},{key:'main',orderKey:'same-song',genre:'kpop-original',title:'Full version',ep:1,preferredVideo:true},{key:'two',orderKey:'second-song',genre:'kpop-original',title:'Second song',ep:2}];const f=fixture('영상','?genre=kpop-original&act=1',rows);assert.deepEqual(all(f.level(4),x=>x.className==='noa-inline-song').map(text),['EP.1 · Full version','EP.2 · Second song']);assert.deepEqual(Array.from(f.model.apply(rows).queue,r=>r.key),['main','two']);assert.deepEqual(Array.from(f.model.apply(rows,true).queue,r=>r.key),['short','main','two']);assert.equal(rows.length,3,'source videos are never deleted');});

for(const kind of ['곡','영상'])test(kind+': ACT shortcut retains categories and existing unclassified songs need no expand action',()=>{const f=fixture(kind,'?type=playlist');assert.equal(f.cards(1).length,4);assert.equal(f.level(3),undefined);for(const i of [2,3]){f.cards(1)[i].click();f.cards(2)[0].click();assert.equal(f.level(3).attrs['aria-label'],'곡 묶음');assert.match(text(f.level(4)),i===2?/Story/:/Cover/);assert.equal(f.cards(3).length,0);}});
test('classification uses stored genre, ACT/EP and canonical saved membership, never shared titles',()=>{const {api}=fixture();const lists=[{id:'saved',group:'story',title:'우리의 모음',keys:['native-key']}];assert.deepEqual(Array.from(api.classification({genre:'kpop-original',ep:11,title:'같은 제목'}),x=>x.value),['오리지널송','K-POP Original','ACT 2','EP.11 · 같은 제목']);assert.equal(api.classification({genre:'your-story',key:'catalog:native-key',title:'같은 제목'},lists)[2].value,'우리의 모음');assert.equal(api.classification({genre:'your-story',key:'other-key',title:'같은 제목'},lists)[2].value,'미분류');assert.equal(api.classification({genre:'unknown',title:'K-POP Original'})[0].value,'분류 확인 필요');});
