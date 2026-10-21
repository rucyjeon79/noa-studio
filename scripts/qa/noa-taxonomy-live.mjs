import {chromium} from 'playwright';import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage(),origin='https://noastudio.ai.kr';const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const get=async path=>{const r=await page.request.get(origin+path);assert.ok(r.ok(),path);return r.json();};
 const home=await get('/noa-bridge/home.php');assert.ok(home.ok);for(const s of ['stories','covers','playlists'])assert.equal(home[s].length,10);
 const taxonomy=await get('/noa-bridge/taxonomy.php');assert.ok(taxonomy.installed);assert.equal(taxonomy.categories.length,5);assert.ok(taxonomy.videos.length>0);
 assert.equal((await page.request.get(origin+'/noa-app/taxonomy/')).status(),403);
 assert.equal((await page.request.post(origin+'/noa-app/taxonomy/',{data:{action:'status'}})).status(),403);
 assert.equal((await page.request.get(origin+'/noa-bridge/taxonomy-worker.php')).status(),401);
 assert.equal((await page.request.get(origin+'/noa-bridge/taxonomy-store.php')).status(),403);
 let previous;
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});await page.goto(origin+'/noa-music.php',{waitUntil:'domcontentloaded'});await page.locator('#noa-taxonomy-browse[data-ready=true]').waitFor();await page.getByLabel('1차 카테고리',{exact:true}).selectOption('kpop-original');await page.getByLabel('2차 카테고리',{exact:true}).selectOption('collection');await page.waitForFunction(()=>document.querySelectorAll('#taxonomy-video-results a').length>0);const rows=await page.locator('#taxonomy-video-results a').evaluateAll(as=>as.map(a=>({href:a.getAttribute('href'),title:a.querySelector('strong').textContent})));if(previous)assert.deepEqual(rows,previous);previous=rows;assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'music horizontal overflow');await page.screenshot({path:'quality-taxonomy/music-'+width+'.jpg',fullPage:true,type:'jpeg',quality:65});}
 await page.goto(origin+'/noa-world.php',{waitUntil:'domcontentloaded'});assert.equal(await page.locator('.world-mv-card').count(),30);assert.deepEqual(errors,[]);
 const report={ok:true,environment:'actual production anonymous browser',homeCounts:Object.fromEntries(['stories','covers','playlists'].map(s=>[s,home[s].length])),publicCategoryVideos:taxonomy.videos.length,musicCategoryFilterCount:previous.length,musicPcMobileRowsEqual:true,officialMvDisplayed:30,anonymousAdminDenied:true,unsignedServiceDenied:true,coreDirectAccessDenied:true,authenticatedAdminInteractionVerified:false,authenticatedAdminLimitation:'Native credential browser state could not be resumed; isolated UI and real production service/SQL tests passed.'};await fs.writeFile('quality-taxonomy/live-report.json',JSON.stringify(report,null,2));console.log('NOA_TAXONOMY_LIVE_UI '+JSON.stringify(report));
}finally{await browser.close();}
