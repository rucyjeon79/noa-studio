import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8078',server=spawn('php',['-S','127.0.0.1:8078','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'}),browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [320,390,1280])for(const role of ['guest','member','vip','admin']){
  const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});await c.addCookies([{name:'qa_role',value:role,url:base}]);const p=await c.newPage();
  for(const path of ['/','/menu-fixture.php','/noa-lounge.php','/noa-shop.php','/bbs/board.php']){
   await p.goto(base+path);await p.waitForFunction(()=>document.querySelector('#noa-account-bar')?.dataset.member!==undefined);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const nav=p.locator(width<=760?'.noa-mobile-nav':'.noa-menu');assert.deepEqual(await nav.locator('a span').allTextContents(),['홈','유튜브','음원','커뮤니티','SHOP']);assert.equal(await nav.locator('[data-noa-account-nav]').count(),0);
   const account=p.locator('#noa-nav-account');assert.equal(await account.innerText(),role==='guest'?'로그인':'MY');assert.equal(await account.getAttribute('href'),role==='guest'?'/bbs/login.php?url=%2Fnoa-my.php':'/noa-my.php');
   const a=await account.boundingBox(),all=await p.locator('#noa-nav-all').boundingBox();assert(a.x>=all.x+all.width-1&&Math.abs(a.y-all.y)<2,'account follows whole menu');assert(a.height>=44&&a.width>=44);
   const footer=p.locator(width<=760?'.noa-mobile-footer':'.noa-sidebar');const about=await footer.locator('.noa-sidebar-legal a').first().boundingBox(),world=await footer.locator('.noa-footer-world').boundingBox();assert(Math.abs(about.y-world.y)<2&&world.x>=about.x+about.width-1,'world next to company');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   if(path==='/'){
    await p.waitForFunction(()=>document.body.dataset.noaHomeReady==='true');
    assert.equal(await p.locator('#noa-genres img').count(),4);assert.equal(new Set(await p.locator('#noa-genres img').evaluateAll(xs=>xs.map(x=>x.src))).size,4);
    await p.locator('#noa-genres').scrollIntoViewIfNeeded();await p.waitForFunction(()=>[...document.querySelectorAll('#noa-genres img')].every(x=>x.complete&&x.naturalWidth>0));
    assert.equal(await p.locator('#noa-ecosystem-links').count(),0);assert.equal(await p.locator('[data-home-banner=goods]').getAttribute('href'),'/noa-shop.php');
    assert((await p.locator('#noa-featured .noa-card-meta').first().innerText()).includes('1.2M'));assert((await p.locator('#noa-featured .noa-card-meta').first().getAttribute('title')).includes('1,250,000'));
    if(width<=760){assert.equal(await p.locator('#noa-featured>.noa-music-card').count(),4);const boxes=await p.locator('#noa-featured>.noa-music-card').evaluateAll(xs=>xs.map(x=>({x:x.offsetLeft,y:x.offsetTop})));assert.equal(boxes[0].y,boxes[1].y);assert.equal(boxes[2].y,boxes[3].y);assert(boxes[2].y>boxes[0].y);}
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home has no horizontal overflow');
   }
   if(role==='guest'&&path==='/bbs/board.php'){assert.equal(new URL(p.url()).pathname,'/bbs/login.php');}else if(path!='/menu-fixture.php'){assert.equal(await nav.locator('[aria-current=page]').count(),1,JSON.stringify({width,role,path,url:p.url(),nav:await nav.innerHTML()}));assert.equal(await nav.locator('[aria-current=page]').innerText(),path==='/'?'홈':path==='/noa-shop.php'?'SHOP':'커뮤니티');}
  }
  await p.locator('#noa-nav-account').click();if(role==='guest')await p.locator('input[name=mb_password]').waitFor();else await p.waitForURL('**/noa-my.php');await c.close();
 }
 console.log('MENU_AND_HOME_60_PAGE_ROLE_VIEWPORT_STATES_COMPACT_COUNTS_DISTINCT_ART_AND_2X2_OK');
}finally{await browser.close();server.kill();}
