import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='room-theme-proof/player';mkdirSync(out,{recursive:true});
const root=process.env.NOA_SOURCE_ROOT||process.cwd();
const server=spawn('php',['-S','127.0.0.1:8093','tests/p0/router.php'],{cwd:root,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8093/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
 for(const width of [390,1280,1600]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  await page.route('http://127.0.0.1:8093/**',async route=>{
   if(route.request().resourceType()!=='document')return route.continue();
   const response=await route.fetch();let html=await response.text();
   const shared='<link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-account.css"><script src="/noa-account.js" defer></script>'+(html.includes('src="/noa-ui.js')?'':'<script src="/noa-ui.js" defer></script>');
   await route.fulfill({response,body:html.replace('</head>',shared+'</head>')});
  });
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER_ERROR',e.message);});
  await page.goto('http://127.0.0.1:8093/noa-lounge.php');
  const songLink=page.locator('main>a[href="/noa-music.php"]');
  await songLink.evaluate(a=>a.search='?track=one');await page.locator('main>a[href$="?track=one"]').click();
  await page.locator('#pause-play').click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.2);
  await page.evaluate(()=>window.originalAudio=document.querySelector('audio'));
  const musicUrl=page.url();
  assert(await page.evaluate(()=>NoaMusic.playRecommendedMix(['two','one'])));
  await page.waitForFunction(()=>document.querySelector('.song.selected')?.dataset.key==='two'&&!document.querySelector('audio').paused);

  await page.goBack();await page.waitForURL('**/noa-lounge.php');
  await page.waitForFunction(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused&&document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname==='/noa-lounge.php');
  await page.goForward();await page.waitForURL(musicUrl);await page.waitForFunction(()=>!document.querySelector('#noa-shell-view'));
  assert(await page.evaluate(()=>document.querySelector('.song.selected').dataset.key==='two'&&!originalAudio.paused),'history does not reselect the original song link');
  const nav=width<760?'.noa-mobile-nav':'.noa-menu';
  for(const path of ['/noa-lounge.php','/noa-shop.php','/']){
   const before=await page.locator('audio').evaluate(a=>a.currentTime);
   if(width>=760)await page.locator('#noa-nav-all').click();
   await page.locator(nav+' a[href="'+path+'"]').click();
   await page.waitForFunction(path=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname===path,path);
   await page.waitForFunction(t=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused&&window.originalAudio.currentTime>t+0.2,before);
   assert.equal(new URL(page.url()).pathname,path);
   assert(await page.locator('.noa-two-line').isVisible());
   await page.waitForFunction(()=>document.querySelector('#noa-shell-view')?.contentDocument?.documentElement.hasAttribute('data-noa-shell-child'));
   const frameBox=await page.locator('#noa-shell-view').boundingBox(),dockBox=await page.locator('.noa-two-line').boundingBox();
   assert.equal(Math.round(frameBox.x),0,'retained page uses the full viewport');
   assert.equal(Math.round(dockBox.x),0,'player uses the full viewport');
   assert(frameBox.x+frameBox.width<=width+1);
   const childPadding=await page.frameLocator('#noa-shell-view').locator('body').evaluate(b=>parseFloat(getComputedStyle(b).paddingLeft));assert.equal(childPadding,0,'embedded pages do not reserve a second sidebar');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.frameLocator('#noa-shell-view').locator('main').evaluate(e=>e.style.minHeight='2000px');
   await page.frameLocator('#noa-shell-view').locator('body').evaluate(()=>scrollTo(0,700));
   await page.locator('#noa-nav-top').click();
   await page.waitForFunction(()=>document.querySelector('#noa-shell-view').contentWindow.scrollY===0);
   assert(await page.evaluate(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused),'top button scrolls the displayed page without restarting music');
   await page.screenshot({path:out+'/'+width+'-'+(path==='/'?'home':path.split('/').at(-1))+'.png'});
  }
  // Follow a content link inside the retained view, then browser back.
  await page.frameLocator('#noa-shell-view').locator('main>a[href^="/bbs/board.php"]').click();
  await page.waitForFunction(()=>location.pathname==='/bbs/board.php');
  await page.locator('#noa-nav-back').click();
  await page.waitForFunction(()=>location.pathname==='/');
  assert(await page.evaluate(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused));
  // MY entry and an explicit _self link must retain the same engine.
  await page.evaluate(()=>{const a=document.createElement('a');a.id='test-my';a.href='/noa-my.php';a.target='_self';a.textContent='MY';document.querySelector('.noa-two-line').append(a);});
  await page.locator('#test-my').click();
  await page.waitForFunction(()=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname==='/noa-my.php');
  await page.frameLocator('#noa-shell-view').locator('main>a[href="/noa-music.php"]').click();
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
}catch(e){if(browser)for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:out+'/failure.png',fullPage:true});writeFileSync(out+'/failure.html',await p.content());}throw e;}finally{await browser?.close();server.kill();}
