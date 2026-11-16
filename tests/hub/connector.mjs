import assert from 'node:assert/strict';
import worker from '../../integrations/chatgpt-assistant/worker.mjs';
const original=globalThis.fetch,calls=[];
globalThis.fetch=async(url,options)=>{calls.push({url:String(url),options});return Response.json({ok:true,transport:'chatgpt_direct'});};
async function call(name,args={},email='owner@example.test'){
 return (await worker.fetch(new Request('https://test.invalid/mcp',{method:'POST',headers:{'content-type':'application/json','oai-authenticated-user-email':email},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}),{NOA_OWNER_EMAIL:'owner@example.test',NOA_SITE_BRIDGE:'test-key'})).json();
}
try{
 for(const [name,args,action]of [
  ['noa_hub_status',{},'status'],['noa_hub_status',{releaseId:'a'.repeat(32)},'receipt'],
  ['noa_hub_source',{action:'read',path:'noa-hub.php',offset:0},'read'],
  ['noa_hub_source',{action:'manifest',paths:['noa-hub.php']},'manifest'],
  ['noa_hub_release',{action:'recover',revision:4,package:{id:'b'.repeat(32)}},'release'],
  ['noa_hub_recover',{action:'release'},'recover']
 ]){
  const r=await call(name,args);assert.equal(r.result.isError,false);
  const c=calls.at(-1);assert.equal(c.url,'https://noastudio.ai.kr/noa-gpt.php?op=hub');assert.equal(c.options.redirect,'manual');
  assert.equal(JSON.parse(c.options.body).action,action);assert.equal(c.options.headers['X-NOA-Action-Key'],'test-key');
 }
 const count=calls.length;
 assert.equal((await call('noa_hub_release',{},'other@example.test')).result.isError,true);
 assert.equal((await call('noa_hub_source',{action:'release'})).result.isError,true);
 assert.equal(calls.length,count);
 globalThis.fetch=async()=>new Response(null,{status:302,headers:{location:'https://github.com'}});
 assert.equal((await call('noa_hub_status')).result.isError,true);
 console.log('N80 direct connector: fixed host, owner boundary, read/write isolation, receipt routing and redirect rejection passed.');
}finally{globalThis.fetch=original;}
