import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../deploy/noa-shorts-control.js',import.meta.url),'utf8');
class Element {
  textContent='';children=[];hidden=false;value='';listeners={};classList={add(){},remove(){}};
  append(...nodes){this.children.push(...nodes);} prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;} addEventListener(name,fn){this.listeners[name]=fn;}
}
const seed={ok:true,checkedAt:1794890000,runnerState:'retired',paused:true,needsPolling:false,
  trial:null,receipt:null,moduleCheck:{state:'checked',requestedAt:1794890000,elapsedMs:1.234},
  job:{title:'Original',duration:52,state:'cancelled',planned:0,scenes:7,images:0,videos:0,finals:0,controller:{enabled:true}},
  campaign:{readiness:{missing:['chatgpt_unattended_dispatch_not_verified']}},chatgpt:{request:null}};
function fixture(state,{fail=false}={}){
  const nodes=new Map(),timers=new Map();let next=0,calls=0;
  const doc={hidden:false,getElementById(id){if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);},
    createElement(){return new Element();},addEventListener(){}};
  doc.getElementById('initial-state').textContent=JSON.stringify(state);
  vm.runInNewContext(source,{document:doc,AbortController,Date,Number,Error,
    setTimeout(fn,delay){const id=++next;timers.set(id,{fn,delay});return id;},clearTimeout(id){timers.delete(id);},
    fetch:async()=>{calls++;if(fail)throw Error('fixture_failure');return {ok:true,json:async()=>state};}});
  return {doc,nodes,timers,calls:()=>calls};
}
let f=fixture(seed);
assert.match(f.nodes.get('job-title').textContent,/취소됨/,'missing NoaDisplay must not break rendering');
assert.match(f.nodes.get('live-state').textContent,/점검 완료/);
assert.match(f.nodes.get('clock-capability').textContent,/1.234 ms/);
assert.match(f.nodes.get('blockers').children.map(x=>x.textContent).join(' '),/ChatGPT 무인 호출/);
assert.equal(f.timers.size,0,'retired idle state must not poll');
const active=structuredClone(seed);active.needsPolling=true;active.job.state='running';
f=fixture(active);
for(let n=0;n<20;n++){
  const timer=[...f.timers.entries()].find(([,v])=>v.delay===5000);if(!timer)break;
  f.timers.delete(timer[0]);timer[1].fn();await new Promise(setImmediate);
}
assert.equal(f.calls(),12,'automatic reads stop after at most one minute');
assert.equal(f.timers.size,0);
f=fixture(active,{fail:true});
const timer=[...f.timers.entries()].find(([,v])=>v.delay===5000);f.timers.delete(timer[0]);timer[1].fn();await new Promise(setImmediate);
assert.equal(f.calls(),1);assert.equal(f.timers.size,0,'failure stops repeat requests');
assert.match(f.nodes.get('live-state').textContent,/새로고침/);
console.log('N80_SHORTS_UI_PASS absent display helper, cancelled job, host evidence, idle/failure polling stopped, 12-read limit');
