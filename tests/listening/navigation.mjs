import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='https://noastudio.ai.kr',live=process.env.NOA_NAVIGATION_LIVE==='1';
const browser=await chromium.launch({...process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{channel:'chrome'},args:['--no-sandbox']});
try{
 for(const width of [360,390,1280])for(const entry of (live?['home','hero']:['home','hero','music'])){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
  console.log('CHECK',live?'live':'fixture',width,entry);page.on('pageerror',error=>console.error('PAGE_ERROR',error.message));
  let popups=0,listeningRequests=0;page.on('popup',()=>popups++);
  page.on('request',request=>{if(new URL(request.url()).pathname==='/noa-bridge/listening.php')listeningRequests++;});
  if(live)await page.addLocatorHandler(page.getByRole('button',{name:'응원 안내 닫기',exact:true}),button=>button.click());
  if(!live)await context.route(base+'/**',route=>{
   const path=new URL(route.request().url()).pathname;
   if(path==='/noa-listening.js'||path==='/noa-listening-model.js')return route.fulfill({contentType:'application/javascript',body:readFileSync('deploy'+path,'utf8')});
   if(['/noa-listening.css','/noa-listening-banner.css','/noa-ui.css','/noa-starlight.css'].includes(path))return route.fulfill({contentType:'text/css',body:readFileSync('deploy'+path,'utf8')});
   if(path==='/noa-assets/banner-ai-listening.webp')return route.fulfill({contentType:'image/webp',body:readFileSync('deploy'+path)});
   if(path.startsWith('/noa-bridge/'))return route.fulfill({status:503,body:'{}'});
   if(path==='/noa-ai-lab.php')return route.fulfill({contentType:'text/html',body:'<h1>AI LAB</h1>'});
   const section='<section id="noa-listening" data-noa-listening="'+(entry==='music'?'music':'home')+'"></section>';
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html class="noa-shell-wide" data-noa-theme="noa-studio"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-listening.css"><link rel="stylesheet" href="/noa-starlight.css"></head><body><main style="max-width:1040px;margin:auto;padding:16px"><a data-noa-listen-now href="#">내 음악 바로 듣기</a>'+(entry==='music'?'<div><div class="nl-music-discovery"><summary>음악 추천</summary>'+section+'</div></div>':section)+'</main><script src="/noa-listening-model.js"></script><script src="/noa-listening.js"></script></body></html>'});
  });
  await page.goto(base+'/',{waitUntil:'domcontentloaded',timeout:60000});
  const link=entry==='hero'?page.locator('[data-noa-listen-now]'):page.getByRole('link',{name:'AI LAB에서 맞춤 음악 듣기',exact:true});
  await link.waitFor({timeout:30000});
  await page.waitForFunction(()=>document.querySelector('a[href="/noa-ai-lab.php?tool=listen"]')?.target==='_self');
  assert.equal(await link.getAttribute('target'),'_self');
  assert.equal(new URL(await link.getAttribute('href'),base).href,base+'/noa-ai-lab.php?tool=listen');
  if(entry==='home'){
   const banner=page.locator('.nl-listen-banner');await banner.scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>{const img=document.querySelector('.nl-listen-art');return img?.complete&&img.naturalWidth>0;});
   const box=await banner.boundingBox();assert(box.height>=200);assert(box.width<=width);
   assert.equal(await page.locator('#noa-listening').evaluate(el=>el.scrollWidth<=el.clientWidth+2),true);
   assert.equal((await page.locator('.nl-listen-title').innerText()).replace(/\s/g,''),'맞춤음악듣기');
   assert.equal(listeningRequests,0,'The home banner must not request AI recommendations');
   const out=process.env.NOA_SCREENSHOTS||'listening-proof/navigation';mkdirSync(out,{recursive:true});
   await banner.screenshot({path:out+'/'+(live?'live':'candidate')+'-'+width+'.png'});
  }
  await link.click();
  await page.waitForURL(url=>url.pathname==='/noa-ai-lab.php'||(live&&/login/.test(url.pathname)),{timeout:60000});
  assert.equal(popups,0);assert.equal(context.pages().length,1);
  await context.close();
 }
 console.log(live?'LIVE_HOME_AND_HERO_SINGLE_WINDOW_VERIFIED':'MOBILE_DESKTOP_HOME_HERO_MUSIC_SINGLE_WINDOW_VERIFIED');
}finally{await browser.close();}
