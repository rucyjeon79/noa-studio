import test from 'node:test';
import assert from 'node:assert/strict';
import {execute} from '../../runtime/node/worker.mjs';
import {runMuvy} from '../../lab/muvy.mjs';
const request={version:1,operation:'engine.status',key:'a'.repeat(64),invocation:'b'.repeat(32)};

test('host probe verifies the signed existing N80 route without claiming or generating',async()=>{
  const calls=[];
  const result=await execute(request,()=>({call:async(action,body)=>{
    calls.push([action,body]);return {ok:true,runtime:{engine:'N80 Engine',operation:'n80_status'},generationRequests:0,workerEnabled:true,credential:'must not escape'};
  }}));
  assert.deepEqual(calls,[['n80_status',{}]]);
  assert.deepEqual(result,{state:'verified',engine:'N80 Engine',generationRequests:0,workerEnabled:true});
});
test('reject arbitrary actions, credentials and unauthenticated status envelopes',async()=>{
  let calls=0;const factory=()=>{calls++;return {call:async()=>({ok:true})};};
  for(const row of [{...request,operation:'shell.run'},{...request,key:'bad'},{...request,invocation:''}])
    await assert.rejects(execute(row,factory),/invalid_node_request/);
  assert.equal(calls,0);
  await assert.rejects(execute(request,factory),/invalid_n80_status/);
});
test('one existing MUVY lease per host invocation; an idle queue does not create work',async()=>{
  let claims=0,generated=0,completed=0;
  const client={call:async(action)=>{
    if(action==='muvy_claim'){claims++;return {task:{id:'a',request:'b',lease:'c'},credential:'fixture'};}
    if(action==='muvy_complete'){completed++;return {ok:true};}throw Error('unexpected');
  }};
  const result=await runMuvy(client,async()=>{generated++;return {output:{cuts:[]}};},1);
  assert.deepEqual(result,{processed:1,state:'bounded_turn_complete'});
  assert.deepEqual([claims,generated,completed],[1,1,1]);
  const idle=await execute({...request,operation:'ai.muvy'},()=>({call:async()=>({task:null,state:'disabled'})}));
  assert.deepEqual(idle,{processed:0,state:'disabled'});
});
test('unconfirmed host result never gets a second execution attempt',async()=>{
  let calls=0;
  await assert.rejects(execute({...request,operation:'ai.muvy'},()=>({}),async()=>{calls++;throw Error('muvy_result_delivery_unconfirmed');}),/unconfirmed/);
  assert.equal(calls,1);
});
