import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../deploy/noa-ui.js',import.meta.url),'utf8');
const start=source.indexOf('function plan(count,capacity,featured=true)'),end=source.indexOf('\nconst specs=',start);
const plan=vm.runInNewContext(source.slice(start,end)+';plan');
test('card count never changes column width or adds a featured card',()=>{
 for(let n=0;n<=100;n++)for(let cap=1;cap<=5;cap++){
 const p=plan(n,cap);assert.equal(p.columns,cap);assert.equal(p.featured,false);assert.equal(p.rows.reduce((s,v)=>s+v,0),n);assert(p.rows.slice(0,-1).every(v=>v===cap));}
});
const home=fs.readFileSync(new URL('../../deploy/noa-home.js',import.meta.url),'utf8');
const sizing=home.slice(home.indexOf('function homePageSize('),home.indexOf('function listSize('));
const size=vm.runInNewContext(sizing+';homePageSize');
test('viewport height fills only complete equal-width rows',()=>{
 assert.equal(size(540,800,200,160),9);assert.equal(size(760,800,200,160),12);
 assert.equal(size(760,600,200,160),8);assert.equal(size(760,1050,200,160),16);
 for(let h=400;h<1400;h++){const count=size(760,h,200,160),rows=count/4;assert.equal(count%4,0);assert(rows*200+(rows-1)*16<=h-160);assert((rows+1)*200+rows*16>h-160);}
});
