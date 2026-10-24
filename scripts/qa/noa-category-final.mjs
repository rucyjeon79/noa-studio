import{chromium}from'playwright';import assert from'node:assert/strict';import{mkdirSync,writeFileSync}from'node:fs';
const base='https://noastudio.ai.kr',phase=process.env.NOA_CATEGORY_PHASE||'candidate',out='category-proof/'+phase;mkdirSync(out,{recursive:true});const report={phase,cases:[],errors:[],realAdminSession:false};
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
try{
 const isolated=await browser.newContext();const p=await isolated.newPage(),fixture='http://127.0.0.1:8099';
 let response=await isolated.request.post(fixture+'/noa-category-order.php',{data:{group:'story',keys:['x']}});assert.equal(response.status(),403);
 await p.goto(fixture+'/noa-category-order-admin.php?auth=admin');await p.waitForFunction(()=>document.querySelectorAll('.order-list li').length===3);await p.waitForTimeout(100);
 const section=p.locator('section[data-group=story]'),keys=()=>section.locator('li').evaluateAll(items=>items.map(x=>x.dataset.key));const original=await keys();
 await section.locator('li').first().locator('.down').click();assert.deepEqual(await keys(),[...original].reverse());await section.locator('.save').click();await p.waitForFunction(()=>document.querySelector('#status').textContent==='순서 저장 및 재조회 확인 완료');
 await p.reload();await p.waitForFunction(()=>document.querySelector('section[data-group=story] li')?.dataset.key==='b'.repeat(64));
 await section.locator('li').first().dragTo(section.locator('li').last());assert.deepEqual(await keys(),original);await section.locator('.save').click();await p.waitForFunction(()=>document.querySelector('#status').textContent==='순서 저장 및 재조회 확인 완료');
 response=await isolated.request.post(fixture+'/noa-category-order.php?auth=admin',{data:{group:'story',keys:[]}});assert.equal(response.status(),403);
 response=await isolated.request.post(fixture+'/noa-category-order.php?auth=admin',{headers:{'X-CSRF-Token':'isolated-token'},data:{group:'story',keys:['x','x']}});assert.equal(response.status(),400);
 await p.route('**/noa-category-order.php',route=>route.request().method()==='POST'?route.fulfill({json:{ok:false}}):route.continue());await section.locator('.save').click();await p.waitForFunction(()=>document.querySelector('#status').textContent.startsWith('저장 실패'));report.isolatedAdmin={drag:true,mobileButtons:true,save:true,readback:true,reloadPersistence:true,csrfDenied:true,guestDenied:true,duplicateDenied:true,falseSuccessPrevented:true};await isolated.close();
 for(const theme of['noa-studio','noa-ivory'])for(const width of[320,360,390,430]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),theme);
  if(phase==='candidate')await context.route('**/*',route=>{const u=new URL(route.request().url());if(u.origin===base&&['/noa-browse.js','/noa-ui.css'].includes(u.pathname))return route.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:u.pathname.endsWith('.js')?'application/javascript':'text/css'});return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const path of['/noa-music.php','/noa-youtube.php']){
   await page.goto(base+path,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.NoaBrowse&&document.querySelector('.noa-browse-card'));const host=page.locator('.noa-browse');assert.equal(await host.locator('.noa-browse-card').count(),4);
   await host.locator('.noa-browse-card').first().click();const toggles=host.locator('.noa-inline-act>.noa-browse-card'),acts=(await toggles.locator('strong').allTextContents()).map(x=>Number(x.match(/\d+/)?.[0]));assert.deepEqual(acts,[...acts].sort((a,b)=>a-b));assert(acts.length>1);
   await toggles.first().click();assert.equal(await toggles.first().getAttribute('aria-expanded'),'true');await toggles.nth(1).click();assert.equal(await toggles.first().getAttribute('aria-expanded'),'false');assert.equal(await toggles.nth(1).getAttribute('aria-expanded'),'true');await toggles.first().click();
   const rows=host.locator('.noa-inline-act').first().locator('.noa-inline-song');const eps=(await rows.allTextContents()).map(x=>Number(x.match(/^EP[.](\d+)/)?.[1]||0)).filter(Boolean);assert.deepEqual(eps,[...eps].sort((a,b)=>a-b));assert(await rows.count()>0);
   const art=rows.first().locator('img');assert(await art.count()>0);await art.evaluate(img=>img.loading='eager');await page.waitForFunction(()=>{const i=document.querySelector('.noa-inline-song img');return i?.complete&&i.naturalWidth>0;});
   await rows.first().click();if(path.includes('music')){assert(await page.locator('[aria-label="곡 상세"]').isVisible());const hasAudio=await page.locator('#sound-player').getAttribute('src');if(hasAudio){await page.waitForFunction(()=>{const a=document.querySelector('audio');return !a.paused&&a.currentTime>0;});await page.locator('#pause-play').click();}}
   else{assert(await page.locator('#yt-player').isVisible());assert.match(await page.locator('#yt-frame').getAttribute('src'),/youtube/);}
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await page.screenshot({path:out+'/'+theme+'-'+width+'-'+path.slice(1,-4)+'.png',fullPage:false});
   report.cases.push({theme,width,path,actAscending:true,collapse:true,epAscending:true,realImage:true,selection:true,overflow:false});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}finally{writeFileSync(out+'/result.json',JSON.stringify(report,null,2));await browser.close();}console.log('NOA_CATEGORY_FINAL_OK '+report.cases.length);
