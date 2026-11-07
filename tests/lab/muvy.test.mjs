import test from 'node:test';import assert from 'node:assert/strict';
import {generateMuvy,runMuvy} from '../../lab/muvy.mjs';
test('MUVY uses fixed provider, validates finish and parses bounded JSON without leaking credentials',async()=>{
 const task={model:'existing-model',tokens:500,system:'JSON',user:'song'};
 const result=await generateMuvy(task,'fixture-key',async(url,options)=>{assert.equal(url,'https://api.x.ai/v1/chat/completions');assert.equal(options.redirect,'error');assert.equal(JSON.parse(options.body).model,'existing-model');return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{"cuts":[]}'}}],usage:{total_tokens:10,secret:'never returned'}}));});
 assert.deepEqual(result,{output:{cuts:[]},usage:{total_tokens:10}});
 await assert.rejects(generateMuvy(task,'fixture-key',async()=>{throw Error('network');}),/provider_unconfirmed/);
 await assert.rejects(generateMuvy(task,'fixture-key',async()=>new Response('{"choices":[{"finish_reason":"length"}]}')),/provider_incomplete/);
});
test('lost completion response retries delivery with the same lease, never paid generation',async()=>{
 let claimed=0,generated=0,delivered=0;const completions=[];
 const client={call:async(action,body)=>{if(action==='muvy_claim')return ++claimed===1?{task:{id:'a',request:'b',lease:'c'},credential:'fixture'}:{task:null,state:'idle'};if(action==='muvy_complete'){completions.push(body);if(++delivered===1)throw Error('network');return {ok:true,replayed:true};}throw Error('unexpected');}};
 assert.equal((await runMuvy(client,async()=>{generated++;return {output:{cuts:[]}};})).processed,1);
 assert.equal(generated,1);assert.deepEqual(completions[0],completions[1]);
});
test('unknown provider outcome is reconciled without an automatic new call',async()=>{
 const actions=[];let claimed=false,calls=0;const client={call:async(action,body)=>{actions.push({action,body});if(action==='muvy_claim'){if(claimed)return {task:null};claimed=true;return {task:{id:'a',request:'b',lease:'c'},credential:'fixture'};}return {ok:true};}};
 await runMuvy(client,async()=>{calls++;throw Error('socket disappeared');});assert.equal(calls,1);assert.equal(actions.find(x=>x.action==='muvy_failed').body.error,'provider_unconfirmed');
});
