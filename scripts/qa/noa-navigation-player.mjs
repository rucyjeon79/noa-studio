import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.env.NOA_SOURCE_ROOT||process.cwd();
const server=spawn('php',['-S','127.0.0.1:8093','tests/p0/router.php'],{cwd:root,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8093/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch();
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER_ERROR',e.message);});
  await page.goto('http://127.0.0.1:8093/noa-music.php?track=one');
  await page.locator('#pause-play').click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.2);
  await page.evaluate(()=>window.originalAudio=document.querySelector('audio'));
  const nav=width<760?'.noa-mobile-nav':'.noa-menu';
  for(const path of ['/noa-lounge.php','/noa-shop.php','/']){
   const before=await page.locator('audio').evaluate(a=>a.currentTime);
   await page.locator(nav+' a[href="'+path+'"]').click();
   await page.waitForFunction(path=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname===path,path);
   await page.waitForFunction(t=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused&&window.originalAudio.currentTime>t+0.2,before);
   assert.equal(new URL(page.url()).pathname,path);
   assert(await page.locator('.noa-two-line').isVisible());
  }
  // Follow a content link inside the retained view, then browser back.
  await page.frameLocator('#noa-shell-view').locator('a[href^="/bbs/board.php"]').click();
  await page.waitForFunction(()=>location.pathname==='/bbs/board.php');
  await page.evaluate(()=>history.back());
  await page.waitForFunction(()=>location.pathname==='/');
  assert(await page.evaluate(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused));
  // MY entry and an explicit _self link must retain the same engine.
  await page.evaluate(()=>{const a=document.createElement('a');a.id='test-my';a.href='/noa-my.php';a.target='_self';a.textContent='MY';document.querySelector('.noa-two-line').append(a);});
  await page.locator('#test-my').click();
  await page.waitForFunction(()=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname==='/noa-my.php');
  await page.frameLocator('#noa-shell-view').locator('a[href="/noa-music.php"]').click();
  await page.waitForFunction(()=>!document.querySelector('#noa-shell-view'));
  assert(await page.evaluate(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused));
  await page.locator('#pause-play').click();
  assert(await page.locator('audio').evaluate(a=>a.paused));
  await page.locator('#pause-play').click();
  await page.waitForFunction(()=>!document.querySelector('audio').paused);
  assert.deepEqual(errors,[]);
  console.log('PLAYBACK_NAVIGATION_VERIFIED',width);
  await page.close();
 }
}finally{await browser?.close();server.kill();}
