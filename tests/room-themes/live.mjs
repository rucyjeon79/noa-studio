import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync('room-theme-proof',{recursive:true});
try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await context.newPage();
 const base='https://noastudio.ai.kr';
 await p.goto(base+'/');await p.locator('[data-noa-display-settings]:visible').first().click();
 await p.locator('#noa-theme').waitFor();
 for(const mode of ['noa-ivory','noa-studio']){
  await p.locator('#noa-theme').selectOption(mode);await p.locator('#noa-settings-dialog .noa-dialog-close').click();
  for(const [route,room] of [['/','home'],['/noa-lounge.php','community'],['/noa-shop.php','shop']]){
   await p.goto(base+route,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(([mode,room])=>document.documentElement.dataset.noaTheme===mode&&document.documentElement.dataset.noaRoom===room,[mode,room]);
   assert.equal(await p.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--noa-bg').trim().toLowerCase()),mode==='noa-ivory'?'#f6f2ea':'#111316');
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(room==='shop')await p.locator('.ec-grid .ec-card').first().waitFor();
   if(room==='community')await p.locator('.ec-write-invite').first().waitFor();
   const hero=p.locator(room==='home'?'.noa-record-library':'.ec-hero').first();
   await hero.scrollIntoViewIfNeeded();
   await hero.screenshot({path:'room-theme-proof/'+room+'-'+mode+'-'+width+'.png'});
  }
  await p.goto(base+'/');await p.locator('[data-noa-display-settings]:visible').first().click();assert.equal(await p.locator('#noa-theme').inputValue(),mode);
 }
 await context.close();
}console.log('LIVE_THEME_SELECTION_RELOAD_PUBLIC_ROOMS_AND_LAYOUT_OK');}finally{await browser.close();}
