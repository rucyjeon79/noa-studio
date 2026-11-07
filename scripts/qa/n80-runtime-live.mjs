// Current public access contract; authenticated data/receipt checks run in n80_runtime_verify.py.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
const out=process.env.NOA_FINISH_QA_OUTPUT||'ainoa-proof/public-runtime.json',cases=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
try{
 for(const width of [360,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],work=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/\/noa-bridge\/(?:lab-worker|muvy|lab-api)\.php/.test(r.url()))work.push(new URL(r.url()).pathname);});
  await page.goto('https://noastudio.ai.kr/',{waitUntil:'networkidle',timeout:60000});
  await page.waitForFunction(()=>window.N80Runtime&&window.NoaUI);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'home horizontal bounds');
  if(width<=760){
   await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
   const control=page.locator('.noa-mobile-footer .noa-footer-themes');await control.waitFor();
   const b=await control.boundingBox(),nav=await page.locator('.noa-mobile-nav').boundingBox();
   assert(b.height>=44&&b.y+b.height<=nav.y,'footer theme buttons remain above navigation');
  }
  assert.deepEqual(work,[],'home must not poll production queues');assert.deepEqual(errors,[]);
  cases.push({ok:true,width,noOverflow:true,queueRequests:0,scriptErrors:0});await context.close();
 }
 const context=await browser.newContext();
 for(const path of ['/noa-music.php','/noa-youtube.php','/noa-library.php','/noa-editor.php']){
  const r=await context.request.get('https://noastudio.ai.kr'+path,{maxRedirects:0,maxRetries:2});
  assert.equal(r.status(),302,path);assert.match(r.headers().location,/login/);cases.push({ok:true,path,anonymousStatus:302});
 }
 await context.close();mkdirSync(dirname(out),{recursive:true});writeFileSync(out,JSON.stringify({ok:true,cases,authenticatedEvidence:'N80 signed native readback and exact replay; not a guest catalog scrape'},null,2));
 console.log('N80_PUBLIC_RUNTIME_OK',JSON.stringify(cases));
}finally{await browser.close();}
