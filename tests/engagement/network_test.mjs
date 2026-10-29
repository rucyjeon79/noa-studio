import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../../deploy/noa-engagement.js',import.meta.url),'utf8');
function setup(fetch){
 const w={host:{isConnected:true,dataset:{}},like:{disabled:true},comments:{disabled:true}};
 const ctx={fetch,AbortController,URLSearchParams,TypeError,setTimeout:(fn,delay)=>delay===1000?queueMicrotask(fn):0,clearTimeout(){},endpoint:'/api',csrf:'',errors:{},pending:new Map([['x',{type:'music',key:'x'}]]),widgets:new Map([['x',[w]]]),key:()=> 'x',fetching:false,apply:()=>ctx.applied++,notice:()=>ctx.notices++,applied:0,notices:0};
 vm.createContext(ctx);
 const api=source.slice(source.indexOf('async function api('),source.indexOf('\nfunction icon('));
 const flush=source.slice(source.indexOf('async function flush('),source.indexOf('\nconst visibility='));
 vm.runInContext(api+'\n'+flush+'\nthis.api=api;this.flush=flush;',ctx);return {ctx,w};
}
test('temporary passive fetch failure retries once without overlay',async()=>{
 let calls=0;const {ctx}=setup(async()=>{if(++calls===1)throw new TypeError('Failed to fetch');return {ok:true,status:200,json:async()=>({ok:true,items:[{}]})};});
 await ctx.flush();assert.equal(calls,2);assert.equal(ctx.applied,1);assert.equal(ctx.notices,0);
});
test('persistent passive failure is bounded and leaves controls available',async()=>{
 let calls=0;const {ctx,w}=setup(async()=>{calls++;throw new TypeError('Failed to fetch');});
 await ctx.flush();assert.equal(calls,2);assert.equal(ctx.notices,0);assert.equal(w.host.dataset.loadError,'true');assert.equal(w.like.disabled,false);assert.match(w.host.title,/연결/);assert.doesNotMatch(w.host.title,/Failed/);
});
test('explicit writes are not automatically replayed and have readable errors',async()=>{
 let calls=0;const {ctx}=setup(async()=>{calls++;throw new TypeError('Failed to fetch');});
 await assert.rejects(()=>ctx.api(null,{action:'like'}),/연결이 원활하지 않습니다/);assert.equal(calls,1);
});
