import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';

const base='https://noastudio.ai.kr',phase=process.env.NOA_THEME_PHASE||'live';
const out='room-theme-proof/'+phase;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const results=[];
try{
 await Promise.all([320,390,1440].map(async width=>{
  const context=await browser.newContext({viewport:{width,height:844},locale:'ko-KR',serviceWorkers:'block'});
  try{
   if(phase==='candidate')for(const name of ['noa-starlight.css','noa-account.js','noa-ui.js']){
    await context.route('**/'+name+'*',route=>route.fulfill({body:readFileSync('deploy/'+name),contentType:name.endsWith('.css')?'text/css':'text/javascript'}));
   }
   const p=await context.newPage(),bar=p.locator('#noa-account-bar'),drawer=p.locator('#noa-menu-drawer'),trigger=p.locator('#noa-nav-all');
   const settle=async()=>{await drawer.evaluate(async el=>{await Promise.allSettled(el.getAnimations().map(a=>a.finished));});};
   for(const theme of ['noa-ivory','noa-studio']){
    await p.goto(base+'/noa-login.php',{waitUntil:'domcontentloaded'});
    await p.locator('[data-footer-theme="'+theme+'"]').click();
    for(const path of ['/','/noa-lounge.php','/noa-shop.php','/shop/cart.php']){
     const started=Date.now();await p.goto(base+path,{waitUntil:'domcontentloaded'});
     const navigationMs=Date.now()-started;
     await p.waitForFunction(t=>document.documentElement.dataset.noaTheme===t&&document.querySelector('#noa-drawer-tools')?.closest('dialog'),theme);
     if(path==='/'){const dismiss=p.locator('#noa-amt-fan .amt-close');if(await dismiss.isVisible())await dismiss.click();}
     const items=await bar.locator('.noa-navigation-bar a,.noa-navigation-bar button').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height};}));
     assert.deepEqual(items.map(e=>e.id),['noa-nav-all','','noa-nav-back','noa-nav-top','noa-nav-account']);
     for(const [i,item] of items.entries()){assert(item.h>=44&&item.w>=44&&item.x>=0&&item.x+item.w<=width+1,JSON.stringify({path,width,items}));if(i)assert(item.x>=items[i-1].x+items[i-1].w-1&&Math.abs(item.y-items[0].y)<2);}
     const home=p.locator('.noa-mobile-nav [data-noa-nav=home]');
     if(width<=390){const shape=await home.evaluate(e=>[e.offsetWidth,e.offsetHeight,getComputedStyle(e).borderRadius]);assert.equal(shape[0],shape[1]);assert.equal(shape[2],'50%');}
     assert.equal(await drawer.isVisible(),false);assert.equal(await p.locator('#noa-menu-find,#noa-find-dialog').count(),0);
     if(path==='/'&&width===390){await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:out+'/home-'+theme+'-390.png'});}
     await trigger.click();await settle();const panel=await drawer.boundingBox();assert(Math.abs(panel.x)<1&&Math.abs(panel.width-width*.7)<=1,JSON.stringify({width,panel}));
     assert((await bar.boundingBox()).y+items[0].h<=0);assert(await drawer.evaluate(e=>e.matches(':modal')&&getComputedStyle(e).animationDuration==='1s'));
     const search=drawer.locator('#noa-drawer-search');await search.fill('공지');assert.equal(await drawer.locator('.noa-drawer-secondary a:visible').count(),1);
     await search.fill('없는메뉴xyz');assert(await drawer.locator('.noa-menu-empty').isVisible());await search.fill('');
     assert(await drawer.locator('#noa-nav-install').isVisible());assert(await drawer.locator('#noa-header-language').isVisible());
     if(path==='/'){
      await drawer.locator('#noa-header-language').click();await drawer.locator('[data-language=en]').last().click();await p.waitForFunction(()=>document.documentElement.lang==='en');
      await drawer.locator('#noa-header-language').click();await drawer.locator('button[data-language=ko]').last().click();await p.waitForFunction(()=>document.documentElement.lang==='ko');
      if(width===390){await drawer.locator('.noa-drawer-close').focus();await p.screenshot({path:out+'/menu-'+theme+'-390.png'});}
      await drawer.locator('#noa-referral-share').click();const share=p.locator('#noa-referral-dialog');await share.waitFor();await share.locator('.nrf-close').click();await share.waitFor({state:'detached'});
     }
     await p.mouse.click(width-4,100);await drawer.waitFor({state:'hidden'});assert(await trigger.evaluate(e=>document.activeElement===e));
     const overflow=await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(overflow<=1);
     results.push({width,mode:theme,route:path,navigationMs,overflow,drawerWidth:panel.width});
    }
    await trigger.click();await drawer.locator('#noa-nav-install').click();await p.waitForURL('**/noa-install.php');await p.locator('#noa-nav-back').click();await p.waitForURL('**/shop/cart.php');
   }
  }finally{await context.close();}
 }));
 console.log('OPERATING_DRAWER_OK',phase,results.length,JSON.stringify([...new Set(results.map(r=>r.drawerWidth))]));
}finally{writeFileSync(out+'/results.json',JSON.stringify(results));await browser.close();}
