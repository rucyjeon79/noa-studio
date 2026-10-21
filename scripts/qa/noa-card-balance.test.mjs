import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../deploy/noa-ui.js',import.meta.url),'utf8');
const start=source.indexOf('function plan(count,capacity,featured=true)'),end=source.indexOf('\nconst specs=',start);
const plan=vm.runInNewContext(source.slice(start,end)+';plan');
test('preferred balanced arrangements avoid a large isolated feature gap',()=>{
 for(const [n,cap,expected] of [[10,5,'5+5'],[10,3,'2+2+2+2+2'],[10,2,'2+2+2+2+2'],[9,4,'3+3+3'],[8,4,'4+4'],[7,4,'4+3'],[7,5,'4+3'],[6,4,'3+3'],[5,3,'3+2'],[5,4,'3+2'],[5,5,'3+2'],[4,4,'2+2']]){
  const p=plan(n,cap);assert.equal([...(p.featured?[1]:[]),...p.rows].join('+'),expected);
 }
});
test('all counts preserve totals, readable capacity and avoid isolated final cards',()=>{
 for(let n=0;n<=100;n++)for(let cap=1;cap<=5;cap++)for(const media of [true,false]){
  const p=plan(n,cap,media);assert.equal(p.rows.reduce((s,v)=>s+v,Number(p.featured)),n);
  assert(p.columns<=cap);assert(p.rows.every(v=>v>0&&v<=p.columns));
  if(p.columns>1)assert(p.rows.every(v=>v>1));
  if(!media)assert.equal(p.featured,false);
 }
});
test('menu rows balance without media styling',()=>{const p=plan(7,3,false);assert.equal(p.rows.join('+'),'3+2+2');assert.equal(p.featured,false);});
