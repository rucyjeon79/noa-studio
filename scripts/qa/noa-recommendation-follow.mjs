import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('deploy/noa-app/p0-player.js','utf8');
const follow=source.slice(source.indexOf('/* Always follow jukebox playback'));
const browser=await chromium.launch({channel:'chrome'});
try {
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:780}});
  await page.setContent('<button id="dock-list">목록</button><audio id="sound-player"></audio><div class="song selected" data-key="one"></div><div style="height:1600px"></div><button id="target">현재 곡</button><dialog id="dock-queue" style="height:200px;overflow:auto"></dialog>');
  await page.evaluate(()=>{
   window.NoaMusic={listeningSelection:()=>null};
   window.focused=[];
   window.addEventListener('noa-find-song',e=>{if(e.detail.allow()){window.focused.push(e.detail.key);e.detail.scroll(document.getElementById('target'));}});
   window.drawDockQueue=()=>{
    document.getElementById('dock-queue').innerHTML='<div style="height:900px"></div><button aria-current="true">현재 곡</button>';
   };
   document.getElementById('dock-list').onclick=()=>{drawDockQueue();document.getElementById('dock-queue').showModal();};
  });
  await page.addScriptTag({content:follow});
  await page.evaluate(()=>{
   window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{key:'two'}}}));
   document.getElementById('sound-player').dispatchEvent(new Event('playing'));
  });
  assert.deepEqual(await page.evaluate(()=>window.focused),['two']);
  assert(await page.evaluate(()=>scrollY>0));
  await page.click('#dock-list');
  await page.waitForFunction(()=>document.getElementById('dock-queue').scrollTop>0);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{key:'three'}}})));
  await page.waitForFunction(()=>document.getElementById('dock-queue').scrollTop>0);
  await page.evaluate(()=>{
   document.getElementById('dock-queue').close();
   document.body.classList.add('noa-shell-open');
   document.getElementById('sound-player').dispatchEvent(new Event('playing'));
  });
  assert.deepEqual(await page.evaluate(()=>window.focused),['two']);
  await page.evaluate(()=>{
   document.body.classList.remove('noa-shell-open');
   for (const key of ['next','random','previous']) {
    window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{key}}}));
    document.getElementById('sound-player').dispatchEvent(new Event('playing'));
   }
  });
  assert.deepEqual(await page.evaluate(()=>window.focused),['two','next','random','previous']);
  await page.close();
  console.log('Universal jukebox follow, queue updates, background page verified',width);
 }
}finally{await browser.close();}
