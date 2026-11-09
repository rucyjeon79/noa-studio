import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='https://noastudio.ai.kr',live=process.env.NOA_NAVIGATION_LIVE==='1';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1280])for(const entry of (live?['home','hero']:['home','hero','music'])){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
  console.log('CHECK',live?'live':'fixture',width,entry);page.on('pageerror',error=>console.error('PAGE_ERROR',error.message));
  let popups=0;page.on('popup',()=>popups++);
  if(!live)await context.route(base+'/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/noa-listening.js'||path==='/noa-listening-model.js')return route.fulfill({contentType:'application/javascript',body:readFileSync('deploy'+path,'utf8')});
   if(path.startsWith('/noa-bridge/'))return route.fulfill({status:503,body:'{}'});
   if(path==='/noa-ai-lab.php')return route.fulfill({contentType:'text/html',body:'<h1>AI LAB</h1>'});
   const section='<section data-noa-listening="'+(entry==='music'?'music':'home')+'"></section>';
   return route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><a data-noa-listen-now href="#">내 음악 바로 듣기</a>'+(entry==='music'?'<main><div><div class="nl-music-discovery"><summary>음악 추천</summary>'+section+'</div></div></main>':section)+'<script src="/noa-listening-model.js"></script><script src="/noa-listening.js"></script>'});
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  const link=entry==='hero'?page.locator('[data-noa-listen-now]'):page.getByRole('link',{name:'AI LAB에서 맞춤 음악 듣기',exact:true});
  await link.waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('a[href="/noa-ai-lab.php?tool=listen"]')?.target==='_self');
  assert.equal(await link.getAttribute('target'),'_self');
  assert.equal(new URL(await link.getAttribute('href'),base).href,base+'/noa-ai-lab.php?tool=listen');
  await link.click();
  await page.waitForURL(url=>url.pathname==='/noa-ai-lab.php'||(live&&/login/.test(url.pathname)),{timeout:60000});
  assert.equal(popups,0);assert.equal(context.pages().length,1);
  await context.close();
 }
 console.log(live?'LIVE_HOME_AND_HERO_SINGLE_WINDOW_VERIFIED':'MOBILE_DESKTOP_HOME_HERO_MUSIC_SINGLE_WINDOW_VERIFIED');
}finally{await browser.close();}
