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
const sizing=home.slice(home.indexOf('function homePageSize('),home.indexOf('function rawListSize('));
const size=vm.runInNewContext(sizing+';homePageSize');
test('viewport height fills only complete equal-width rows',()=>{
 assert.equal(size(540,800,200,160),9);assert.equal(size(760,800,200,160),12);
 assert.equal(size(760,600,200,160),8);assert.equal(size(760,1050,200,160),16);
 for(let h=400;h<1400;h++){const count=size(760,h,200,160),rows=count/4;assert.equal(count%4,0);assert(rows*200+(rows-1)*16<=h-160);assert((rows+1)*200+rows*16>h-160);}
});

test('measured row gaps prevent overflow at mobile and desktop boundaries',()=>{
 for(const width of [280,350,390,540,760,1100])for(const rowGap of [16,24,32])for(let h=500;h<1200;h+=7){
  const columns=size(width,1,1,0,16,rowGap),count=size(width,h,180,200,16,rowGap),rows=count/columns;
  assert.equal(count%columns,0);assert(rows*180+(rows-1)*rowGap<=h-200);assert((rows+1)*180+rows*rowGap>h-200);
 }
});

test('all home lists share the most restrictive viewport capacity',()=>{
 const source=home.slice(home.indexOf('function listSize('),home.indexOf('function fitList('));
 const states=[{capacity:2,rows:[1]},{capacity:4,rows:[1]},{capacity:4,rows:[1]}];
 const fn=vm.runInNewContext(source+';listSize',{homeLists:new Map(states.map((s,i)=>[i,s])),rawListSize:s=>s.capacity});
 assert.deepEqual(states.map(fn),[2,2,2]);states[0].capacity=6;assert.deepEqual(states.map(fn),[4,4,4]);
});

test('home community follows the AMT banner',()=>{
 const html=fs.readFileSync(new URL('../../deploy/noa-app/home.php',import.meta.url),'utf8');
 assert(html.indexOf('data-home-section="community"')>html.indexOf("<?php noa_home_banner('amt');?>"));
 assert.equal(html.match(/data-home-section="community"/g).length,1);
});
