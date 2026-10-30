import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8078',server=spawn('php',['-S','127.0.0.1:8078','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'}),browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [320,390,1280])for(const role of ['guest','member','vip','admin']){
  const c=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});await c.addCookies([{name:'qa_role',value:role,url:base}]);const p=await c.newPage();
  for(const path of ['/menu-fixture.php','/noa-lounge.php','/noa-shop.php','/bbs/board.php']){
   await p.goto(base+path);await p.waitForFunction(()=>document.querySelector('#noa-account-bar')?.dataset.member!==undefined);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const nav=p.locator(width<=760?'.noa-mobile-nav':'.noa-menu');assert.deepEqual(await nav.locator('a span').allTextContents(),['홈','유튜브','음원','커뮤니티','SHOP']);assert.equal(await nav.locator('[data-noa-account-nav]').count(),0);
   const account=p.locator('#noa-nav-account');assert.equal(await account.innerText(),role==='guest'?'로그인':'MY');assert.equal(await account.getAttribute('href'),role==='guest'?'/bbs/login.php?url=%2Fnoa-my.php':'/noa-my.php');
   const a=await account.boundingBox(),all=await p.locator('#noa-nav-all').boundingBox();assert(a.x>=all.x+all.width-1&&Math.abs(a.y-all.y)<2,'account follows whole menu');assert(a.height>=44&&a.width>=44);
   const footer=p.locator(width<=760?'.noa-mobile-footer':'.noa-sidebar');const about=await footer.locator('.noa-sidebar-legal a').first().boundingBox(),world=await footer.locator('.noa-footer-world').boundingBox();assert(Math.abs(about.y-world.y)<2&&world.x>=about.x+about.width-1,'world next to company');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
   if(path!='/menu-fixture.php')assert.equal(await nav.locator('[aria-current=page]').innerText(),path==='/noa-shop.php'?'SHOP':'커뮤니티');
  }
  await p.locator('#noa-nav-account').click();if(role==='guest')await p.locator('input[name=mb_password]').waitFor();else await p.waitForURL('**/noa-my.php');await c.close();
 }
 console.log('MENU_48_PAGE_ROLE_VIEWPORT_STATES_ACCOUNT_COMPANY_WORLD_AND_FIVE_DESTINATIONS_OK');
}finally{await browser.close();server.kill();}
