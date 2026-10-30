import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync((process.env.NOA_SOURCE_ROOT||process.cwd())+'/deploy/noa-account.js','utf8');
const browser=await chromium.launch({headless:true});
try{
 for(const scenario of ['retry-success','manual-recovery','signed-out','invalid-balance','stale-value']){
  const page=await browser.newPage();let calls=0,recover=false;
  await page.route('https://noastudio.ai.kr/**',async route=>{
   if(route.request().url().includes('membership.php')){
    calls++;const good=(scenario==='retry-success'&&calls>1)||(scenario==='stale-value'&&calls===1)||recover;
    if(scenario==='signed-out')return route.fulfill({json:{ok:true,member:false}});
    if(scenario==='invalid-balance')return route.fulfill({json:{ok:true,member:true,balance:'bad',remainingDays:0}});
    if(!good)return route.fulfill({status:503,json:{ok:false}});
    await new Promise(r=>setTimeout(r,100));return route.fulfill({json:{ok:true,member:true,admin:true,balance:1234,remainingDays:0,grant:null}});
   }
   return route.fulfill({contentType:'text/html',body:'<section id="noa-my-account"><span id="noa-my-subscription">확인 중…</span><span id="noa-my-points">확인 중…</span><p id="noa-my-account-status"></p></section>'});
  });
  await page.goto('https://noastudio.ai.kr/noa-my.php');await page.addScriptTag({content:source});
  const state=s=>page.waitForFunction(s=>document.querySelector('#noa-my-account').dataset.state===s,s);
  if(scenario==='retry-success'){await state('ready');assert.equal(calls,2);assert.equal(await page.locator('#noa-my-points').innerText(),'1,234P');}
  else if(scenario==='signed-out'){await state('signed-out');assert.equal(calls,1);assert.equal(await page.locator('#noa-my-points').innerText(),'—');}
  else{
   if(scenario==='stale-value'){await state('ready');await page.evaluate(()=>dispatchEvent(new Event('noa-membership-change')));}
   await state('error');assert.equal(calls,scenario==='stale-value'?3:2);
   assert.equal(await page.locator('#noa-my-points').innerText(),scenario==='stale-value'?'1,234P':'확인 불가');
   if(scenario==='stale-value')assert.match(await page.locator('#noa-my-account-status').innerText(),/이전 조회값/);
   if(scenario==='manual-recovery'){recover=true;await page.getByRole('button',{name:'다시 확인',exact:true}).click();await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));dispatchEvent(new Event('online'));});await state('ready');assert.equal(calls,3);}
  }
  assert.equal(await page.locator('#noa-my-account').getAttribute('aria-busy'),'false');await page.close();
 }
 console.log('ACCOUNT_RECOVERY_5_SCENARIOS_OK');
}finally{await browser.close();}
