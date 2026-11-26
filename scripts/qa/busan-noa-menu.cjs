const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const width of [390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto('https://skhnslu-busan.com/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.busan-noa-menu-card .busan-noa-menu-entry'),{},{timeout:20000});
   const result=await page.evaluate(()=>{
    const card=document.querySelector('.busan-noa-menu-card');
    const entry=card.querySelector('.busan-noa-menu-entry');
    const root=document.documentElement;
    const original=root.getAttribute('data-busan-theme');
    const snapshot=()=>({bg:getComputedStyle(card).backgroundColor,color:getComputedStyle(entry).color,button:getComputedStyle(entry).backgroundColor,minHeight:getComputedStyle(entry).minHeight,radius:getComputedStyle(card).borderRadius});
    root.setAttribute('data-busan-theme','light');const light=snapshot();
    root.setAttribute('data-busan-theme','dark');const dark=snapshot();
    if(original===null)root.removeAttribute('data-busan-theme');else root.setAttribute('data-busan-theme',original);
    return {light,dark,entry:entry.textContent.trim(),subscription:!!card.querySelector('.busan-noa-menu-subscribe'),outside:!card.closest('#bo_v_con,.boardViewWrap,.boardListWrap'),menuUnaffected:!card.querySelector('a[href*="bo_table="]')};
   });
   assert(result.outside&&result.menuUnaffected&&result.subscription,'correct narrow external music card');
   assert.equal(result.entry,'NOA STUDIO 바로가기');
   assert.notEqual(result.light.bg,result.dark.bg,'theme card background');
   assert.notEqual(result.light.button,result.dark.button,'theme action background');
   assert(parseFloat(result.light.minHeight)>=44&&parseFloat(result.dark.minHeight)>=44,'touch target');
   console.log('PASS live NOA menu theme',width,JSON.stringify(result));
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
