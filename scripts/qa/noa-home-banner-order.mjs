import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const origin='https://noastudio.ai.kr';
const candidate=process.env.NOA_BANNER_CANDIDATE;
const pairs=[
 ['[data-home-section=hero]','#noa-daily-fortune'],
 ['[data-home-banner=youtube]','[data-home-section=world]'],
 ['[data-home-banner=amt]','[data-home-section=collections]']
];
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try {
 for(const width of [390,1280]){
  for(const scripts of [false,true]){
   const page=await browser.newPage({viewport:{width,height:900},javaScriptEnabled:scripts,serviceWorkers:'block'});
   try {
    if(candidate){
     await page.route(url=>url.origin===origin&&url.pathname==='/',route=>route.fulfill({contentType:'text/html',body:readFileSync(candidate)}));
     await page.route(url=>url.origin===origin&&url.pathname==='/noa-ui.js',route=>route.fulfill({contentType:'application/javascript',body:readFileSync('deploy/noa-ui.js')}));
    }
    await page.goto(origin+'/?home-banner-order='+Date.now(),{waitUntil:'domcontentloaded'});
    if(scripts){
     await page.waitForSelector('[data-home-section=notices] [data-home-banner=goods]',{state:'attached'});
     // A late policy response must preserve the fortune card immediately below the hero.
     if(candidate)await page.locator('.noa-monthly-benefits').evaluate(node=>node.parentElement.append(node));
    }
    const read=()=>page.evaluate(pairs=>pairs.map(([selector,target])=>{
     const list=document.querySelectorAll(selector),el=list[0],section=document.querySelector(target);
     const r=el?.getBoundingClientRect(),s=section?.getBoundingClientRect();
     return {one:list.length===1,adjacent:!!el&&el.nextElementSibling===section,visible:!!r&&!!s&&r.height>0&&s.height>0&&r.bottom<=s.top+1};
    }),pairs);
    const result=await read();
    assert(result.every(p=>p.one&&p.adjacent&&(!scripts||p.visible)),JSON.stringify({width,scripts,result}));
    console.log('HOME_BANNER_ORDER_OK',candidate?'candidate':'live',width,scripts?'rendered':'initial',pairs.length);
   }finally{await page.context().close();}
  }
 }
}finally{await browser.close();}
