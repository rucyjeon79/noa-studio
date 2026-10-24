import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../deploy/noa-playlists.js',import.meta.url),'utf8');
const savedId='12345678-1234-4234-8234-123456789abc';
const catalog='catalog:'+'a'.repeat(64),single='single:kpop-original:01';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
class Element{
 constructor(){this.dataset={};this.children=[];this.hidden=false;this.disabled=false;this.value='';this.textContent='';this.events={};}
 append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}
 add(node){this.children.push(node);}setAttribute(key,value){this[key]=value;}
 addEventListener(name,fn){this.events[name]=fn;}focus(){}
}
async function fixture({member=true,confirmed=true,deleteStatus=200,postCsrfOnce=false,failReadback=false,advanceRevisionOnRefresh=false}={}){
 const elements=new Map();for(const name of['my-status','my-select','my-title','my-login','my-controls','my-order','my-delete','my-new','my-add','my-remove','my-save','my-play'])elements.set(name,new Element());elements.get('my-delete').style={};
 let server=[{playlist_id:savedId,title:'검증 목록',tracks:[single],revision:7}],gets=0,posts=0;const requests=[];
 const response=(status,body)=>({status,ok:status>=200&&status<300,json:async()=>body});
 const fetch=async(url,options={})=>{const method=options.method||'GET';requests.push({method,...options,body:options.body?JSON.parse(options.body):undefined});
  if(method==='GET'){gets++;if(failReadback&&gets>1)throw Error('offline');if(advanceRevisionOnRefresh&&gets>1)server=server.map(item=>({...item,revision:8}));return member?response(200,{csrf:'fixture-csrf',items:structuredClone(server)}):response(401,{});}
  const body=JSON.parse(options.body);
  if(method==='DELETE'){if(deleteStatus!==200)return response(deleteStatus,{error:'revision_conflict'});server=server.filter(item=>item.playlist_id!==body.id);return response(200,{deleted:true,id:body.id});}
  if(body.action==='delete'){server=server.filter(item=>item.playlist_id!==body.id);return response(200,{deleted:true,id:body.id});}
  posts++;if(postCsrfOnce&&posts===1)return response(403,{error:'request_verification_failed'});
  server=[{playlist_id:body.id,title:body.title,tracks:body.tracks,revision:body.expectedRevision+1}];return response(200,{revision:body.expectedRevision+1});
 };
 const context={document:{getElementById:id=>elements.get(id),createElement:()=>new Element()},Option:class extends Element{constructor(text,value){super();this.text=text;this.value=value;}},crypto:{randomUUID:()=> 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'},window:{confirm:()=>confirmed},fetch,lookup:new Map([[single,{title:'기존 곡',kind:'single'}],[catalog,{title:'복구 곡',kind:'story'}]]),filteredQueue:[{dataset:{key:single}}],selected:{dataset:{key:catalog}},activeQueue:null,filter(){},queue(){return[]},select(){},console};
 vm.runInNewContext(source,context);await tick();
 const choose=()=>{elements.get('my-select').value=savedId;elements.get('my-select').events.change();};
 return{elements,requests,choose,getServer:()=>server};
}
test('guest cannot delete and sees the existing login state',async()=>{
 const f=await fixture({member:false});assert(f.elements.get('my-controls').hidden);assert(f.elements.get('my-delete').disabled);assert.match(f.elements.get('my-status').textContent,/로그인/);
});
test('cancelled delete makes no mutation request',async()=>{
 const f=await fixture({confirmed:false});f.choose();await f.elements.get('my-delete').onclick();assert.equal(f.requests.filter(r=>r.method==='DELETE').length,0);assert.equal(f.getServer().length,1);
});
test('delete submits the selected revision and confirms absence by readback',async()=>{
 const f=await fixture();f.choose();await f.elements.get('my-delete').onclick();const request=f.requests.find(r=>r.method==='DELETE');assert.equal(request.body.id,savedId);assert.equal(request.body.expectedRevision,7);assert.equal(request.headers['X-NOA-CSRF'],'fixture-csrf');assert.equal(f.getServer().length,0);assert.match(f.elements.get('my-status').textContent,/삭제 및 재조회 확인 완료/);assert(f.elements.get('my-delete').disabled);
});
test('revision conflict leaves the selected playlist intact',async()=>{
 const f=await fixture({deleteStatus:409});f.choose();await f.elements.get('my-delete').onclick();assert.equal(f.getServer().length,1);assert.match(f.elements.get('my-status').textContent,/다른 곳에서 변경/);assert.doesNotMatch(f.elements.get('my-status').textContent,/확인 완료/);
});
test('delete does not claim success when its verification read fails',async()=>{
 const f=await fixture({failReadback:true});f.choose();await f.elements.get('my-delete').onclick();assert.equal(f.getServer().length,0);assert.match(f.elements.get('my-status').textContent,/재조회 확인을 마치지 못/);assert.doesNotMatch(f.elements.get('my-status').textContent,/확인 완료/);
});
test('CSRF refresh preserves unsaved catalog track and original revision for retry',async()=>{
 const f=await fixture({postCsrfOnce:true});f.choose();f.elements.get('my-add').onclick();await f.elements.get('my-save').onclick();assert.match(f.elements.get('my-status').textContent,/보안 확인을 갱신/);await f.elements.get('my-save').onclick();const posts=f.requests.filter(r=>r.method==='POST');assert.deepEqual(posts.map(p=>p.body.tracks),[[single,catalog],[single,catalog]]);assert.deepEqual(posts.map(p=>p.body.expectedRevision),[7,7]);assert.match(f.elements.get('my-status').textContent,/저장 완료/);
});
test('save does not claim success when its verification read fails',async()=>{
 const f=await fixture({failReadback:true});f.choose();await f.elements.get('my-save').onclick();assert.match(f.elements.get('my-status').textContent,/재조회 확인을 마치지 못/);assert.doesNotMatch(f.elements.get('my-status').textContent,/저장 완료/);
});

for(const status of [405,501])test(`delete uses the same guarded POST action only after HTTP ${status}`,async()=>{
 const f=await fixture({deleteStatus:status});f.choose();await f.elements.get('my-delete').onclick();const mutations=f.requests.filter(r=>r.method!=='GET');assert.deepEqual(mutations.map(r=>r.method),['DELETE','POST']);assert.deepEqual(mutations[1].body,{action:'delete',id:savedId,expectedRevision:7});assert.equal(mutations[1].headers['X-NOA-CSRF'],mutations[0].headers['X-NOA-CSRF']);assert.equal(mutations[1].credentials,'same-origin');assert.equal(f.getServer().length,0);assert.match(f.elements.get('my-status').textContent,/삭제 및 재조회 확인 완료/);
});
for(const status of [401,403,409,503])test(`delete never retries POST after HTTP ${status}`,async()=>{
 const f=await fixture({deleteStatus:status});f.choose();await f.elements.get('my-delete').onclick();assert.equal(f.requests.filter(r=>r.method==='POST').length,0);assert.equal(f.getServer().length,1);
});

test('delete retains the revision the user selected after a CSRF refresh',async()=>{
 const f=await fixture({deleteStatus:403,advanceRevisionOnRefresh:true});f.choose();await f.elements.get('my-delete').onclick();await f.elements.get('my-delete').onclick();assert.deepEqual(f.requests.filter(r=>r.method==='DELETE').map(r=>r.body.expectedRevision),[7,7]);assert.equal(f.getServer()[0].revision,8);
});
