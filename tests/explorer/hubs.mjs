import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme:'noa-studio',language:'ko',radius:'soft',design:'ios'})));
  await context.route('**/noa-bridge/ui-preferences.php',route=>route.fulfill({json:{member:true,admin:true,revision:0,settings:null,defaults:{theme:'noa-studio',enabled:['noa-studio','noa-ivory']}}}));
  const base='http://127.0.0.1:18080';
  await context.addCookies([{name:'qa_owner',value:'qa_owner_a',url:base}]);
  const page=await context.newPage(),calls=[],errors=[];
  page.on('request',r=>{if(/\/noa-bridge\/(creator|catalog|lab-api|muvy)\.php/.test(r.url()))calls.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  for(const [path,title] of [['/noa-library.php','홈페이지 설정'],['/noa-channel-workspace.php','CREATOR LAB'],['/noa-ai-lab.php','AI LAB']]){
   calls.length=0;await page.goto(base+path);try{await page.getByRole('heading',{name:title,exact:true}).waitFor({timeout:5000});}catch(error){mkdirSync('explorer-proof/candidate',{recursive:true});writeFileSync('explorer-proof/candidate/hub-failure.html',await page.content());await page.screenshot({path:'explorer-proof/candidate/hub-failure.png',fullPage:true});console.log(await page.locator('main').innerText());throw error;}
   await page.waitForTimeout(300);
   assert.deepEqual(calls,[],title+' does not start catalog, creator or AI work');
   assert.equal(await page.locator('script[src*="noa-muvy.js"],script[src*="noa-ai-lab.js"],script[src*="noa-creator.js"]').count(),0);
   const destinations=await page.locator('main a').evaluateAll(a=>a.map(x=>x.href));
   assert.equal(destinations.length,new Set(destinations).size,title+' has no duplicate links');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('N80_LIGHTWEIGHT_WORKSPACES_OK');
}finally{await browser.close();}
