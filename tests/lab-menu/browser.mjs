import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
const out='lab-menu-proof';mkdirSync(out,{recursive:true});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const [role,theme,width] of [
  ...[320,390,1280].flatMap(w=>['noa-studio','noa-ivory'].map(t=>['admin',t,w])),
  ['eight','noa-studio',390],['member','noa-studio',390],
 ]){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block'});
  const caps=JSON.parse(readFileSync(`${out}/fixture/${role}.json`));
  await context.addInitScript(theme=>{
   localStorage.setItem('noa-ui-selection-v2',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'}));
   localStorage.setItem('noa-device-theme',theme);
  },theme);
  const requests=[],errors=[];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url()),p=u.pathname;requests.push(p);
   if(p==='/noa-ai-lab.php'){
    const mode=u.searchParams.get('tool')||'hub';
    return route.fulfill({contentType:'text/html; charset=utf-8',body:readFileSync(`${out}/fixture/${role}-${mode}.html`)});
   }
   if(p==='/noa-sitemap.php')return route.fulfill({contentType:'text/html; charset=utf-8',body:readFileSync(`menu-tree-proof/fixture/menu-${role}.html`)});
   if(p==='/noa-bridge/ui-preferences.php')return route.fulfill({json:{member:true,admin:caps.admin,revision:0,settings:null,defaults:{enabled:['noa-studio','noa-ivory']}}});
   if(p==='/noa-bridge/membership.php')return route.fulfill({json:{ok:true,member:true,admin:caps.admin,level:caps.level,balance:0}});
   const file='deploy'+p;
   if(/\.(css|js|json)$/.test(p)&&existsSync(file))return route.fulfill({body:readFileSync(file),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'text/javascript':'application/json'});
   if(/\.(png|jpg|webp|svg)$/.test(p))return route.fulfill({body:pixel,contentType:'image/png'});
   return route.fulfill({status:404,body:''});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('https://lab-menu.test/noa-ai-lab.php',{waitUntil:'networkidle'});
   const expected=role==='admin'?['creative','batch','create','chat','jobs','growth']:(role==='eight'?['creative','chat']:['chat']);
   const links=page.locator('main [data-n80-module]');
   assert.deepEqual(await links.evaluateAll(as=>as.map(a=>a.dataset.n80Module)),expected);
   for(const a of await links.all()){
    assert(await a.locator('small').isVisible());assert((await a.locator('small').innerText()).length>10);
    assert((await a.boundingBox()).height>=44);
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'hub overflow');
   assert.equal(await page.locator('script[src*="noa-ai-lab.js"],script[src*="noa-muvy.js"],script[src*="noa-creator.js"]').count(),0);
   assert.deepEqual(requests.filter(p=>/\/(catalog|creator|lab-api|muvy)\.php/.test(p)),[],'hub must not execute work');
   await page.screenshot({path:`${out}/hub-${role}-${theme}-${width}.png`,fullPage:true});
   await page.locator('[data-n80-module=chat]').click();
   const modes=page.locator('[data-n80-lab-modes=conversation]');
   assert.equal(await modes.locator('a').count(),2);
   await modes.locator('a[href$="tool=listen"]').click();
   assert.equal(new URL(page.url()).search,'?tool=listen');
   assert.equal(await modes.locator('[aria-current=page]').innerText(),'음악 추천');
   assert(await page.locator('[data-n80-tool-description]').isVisible());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mode overflow');
   await page.screenshot({path:`${out}/modes-${role}-${theme}-${width}.png`,fullPage:true});
   await page.locator('.lab-tabs>a').first().click();await page.waitForURL('**/noa-ai-lab.php');
   if(role==='admin')for(const id of ['batch','create']){
    await page.locator(`[data-n80-module=${id}]`).click();
    assert.equal(new URL(page.url()).search,'?tool='+id);
    assert.equal(await page.locator('.lab-tool-links a[href$="tool=muvy"],.lab-tool-links a[href$="tool=song"],.lab-tool-links a[href$="tool=text"],.lab-tool-links a[href$="tool=channel"]').count(),0);
    await page.locator('.lab-tabs>a').first().click();
   }
   assert.deepEqual(errors,[]);console.log('AI_LAB_BROWSER_OK',role,theme,width);
  }catch(e){await page.screenshot({path:`${out}/failure-${role}-${theme}-${width}.png`,fullPage:true});throw e;}
  finally{await context.close();}
 }
}finally{await browser.close();}
