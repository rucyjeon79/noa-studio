import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const base='https://noastudio.ai.kr',phase=process.env.NOA_FLASH_PHASE||'candidate',out='initial-flash-proof/'+phase;
mkdirSync(out,{recursive:true});
const report={phase,cases:[],errors:[],platform:'Android Chrome emulation in Chromium',physicalAndroid:false};
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const contextOptions=width=>({viewport:{width,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block',userAgent:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',reducedMotion:'reduce'});
async function routes(context,held){
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(!['GET','HEAD'].includes(req.method()))return route.fulfill({status:204,body:''});
  if(u.origin!==base)return route.continue();
  if(u.pathname==='/noa-browse.js'&&held.current)await held.current;
  if(phase==='candidate'&&['/noa-browse.js'].includes(u.pathname))return route.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:'application/javascript'});
  if(phase==='candidate'&&req.isNavigationRequest()&&['/','/noa-music.php','/noa-youtube.php'].includes(u.pathname)){
   const response=await route.fetch({maxRetries:2});let body=await response.text();if(u.pathname==='/'){body=body.replace(/ · TOP 10/g,'').replace('추천 음악과 겹치지 않는 EP 시리즈 TOP 10.','추천 음악과 겹치지 않는 EP 시리즈.');return route.fulfill({response,body});}
   // Reuse public records and overlay only the modified HTML/inline regions.
   const music=u.pathname.includes('music'),id=music?'songs':'yt-videos',host=music?'music-browse':'youtube-browse';if(music)body=body.replace('id="my-playlists" aria-label','id="my-playlists" hidden aria-label');
   body=body.replace(new RegExp('id="'+id+'"(?! hidden)'), 'id="'+id+'" hidden');
   body=body.replace(":{visible:rows,queue:rows,stage:'songs'}",":{visible:[],queue:rows,stage:'groups'}");body=body.replace('||buttons.find(b=>b.dataset.key===saved&&!b.hidden);',"||(new URLSearchParams(location.search).get('view')==='all'?buttons.find(b=>b.dataset.key===saved&&!b.hidden):null);");
   const local=await import('node:fs').then(fs=>fs.readFileSync('deploy'+u.pathname,'utf8'));
   const boot=local.match(/<script data-noa-browse-watchdog>\(function\(\)\{window[.]setTimeout[\s\S]*?<\/script>/)?.[0];assert(boot);
   body=body.replace(/<script data-noa-browse-watchdog>[\s\S]*?<\/script>/g,'').replace('</head>',boot+'</head>').replace('id="'+host+'" class="noa-browse"','id="'+host+'" class="noa-browse" data-noa-browse-boot');body=body.replace(/data-noa-browse-boot data-noa-browse-boot/g,'data-noa-browse-boot');
   body=body.replace(new RegExp('(id="'+host+'"[^>]*>)(</section>)'),'$1<p role="status">카테고리를 불러오는 중입니다.</p>$2');
   return route.fulfill({response,body});
  }
  return route.continue();
 });
 await context.addInitScript(()=>{
  window.__initialFrames=[];
  function sample(){const list=document.querySelector('#songs,#yt-videos'),host=document.querySelector('[data-noa-browse-boot]');if(list){const personal=document.querySelector('#my-playlists'),personalVisible=personal&&!personal.hidden&&getComputedStyle(personal).display!=='none';const style=getComputedStyle(list);window.__initialFrames.push({personalVisible,visible:!list.hidden&&style.display!=='none'&&style.visibility!=='hidden',ready:host?.dataset.browseReady==='true'});}if(!host||host.dataset.browseReady!=='true')requestAnimationFrame(sample);}
  requestAnimationFrame(sample);
 });
}
try{
 for(const width of [360,390,430]){
  const context=await browser.newContext(contextOptions(width)),held={current:null};await routes(context,held);
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const path of ['/noa-music.php','/noa-youtube.php']){
   let release;held.current=new Promise(r=>release=r);
   await page.goto(base+path,{waitUntil:'commit',timeout:90000});
   await page.locator('#songs,#yt-videos').waitFor({state:'attached'});
   await page.waitForTimeout(350);
   assert(await page.locator('#songs,#yt-videos').evaluate(e=>e.hidden&&getComputedStyle(e).display==='none'));
   const captureSession=await context.newCDPSession(page);const capture=await captureSession.send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});writeFileSync(out+'/'+width+'-'+path.slice(1,-4)+'-before-js.png',Buffer.from(capture.data,'base64'));await captureSession.detach();
   release();held.current=null;
   await page.waitForFunction(()=>document.querySelector('[data-noa-browse-boot]')?.dataset.browseReady==='true');
   assert.equal(await page.locator('[data-browse-level="1"] .noa-browse-card').count(),4);
   assert((await page.evaluate(()=>window.__initialFrames)).every(f=>!f.visible&&!f.personalVisible),'full list visible during initial frames');
   for(const mode of ['ordinary','cache-bypass']){
    const session=await context.newCDPSession(page);await session.send('Network.setCacheDisabled',{cacheDisabled:mode==='cache-bypass'});await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>document.querySelector('[data-noa-browse-boot]')?.dataset.browseReady==='true');assert((await page.evaluate(()=>window.__initialFrames)).every(f=>!f.visible&&!f.personalVisible));await session.detach();
   }
   await page.locator('[data-browse-level="1"] .noa-browse-card').first().click();await page.waitForFunction(()=>{const e=document.querySelector('[data-browse-level="2"]');const r=e?.getBoundingClientRect();return r&&r.top>=-2&&r.top<innerHeight/2;});await page.locator('[data-browse-level="2"] .noa-browse-card').first().click();await page.waitForFunction(()=>{const r=document.querySelector('[data-browse-level="3"]')?.getBoundingClientRect();return r&&r.top>=-2&&r.top<innerHeight/2;});const acts=page.locator('.noa-inline-act>.noa-browse-card');await acts.first().click();assert.equal(await acts.first().getAttribute('aria-expanded'),'true');await page.waitForFunction(()=>{const r=document.querySelector('[data-browse-level="4"]')?.closest('.noa-inline-act').getBoundingClientRect();return r&&r.top>=-2&&r.top<innerHeight/2;});await acts.first().click();assert.equal(await acts.first().getAttribute('aria-expanded'),'false');await acts.first().click();
   const eps=(await page.locator('[data-browse-level="4"] .noa-inline-song').allTextContents()).map(t=>Number(t.match(/^EP[.]([0-9]+)/)?.[1]||0)).filter(Boolean);assert.deepEqual(eps,[...eps].sort((a,b)=>a-b));
   await page.locator('[data-browse-level="4"] .noa-inline-song').first().click();
   const panel=page.locator('.noa-inline-playback');assert.equal(await panel.count(),1);assert(await panel.evaluate(e=>e.previousElementSibling?.classList.contains('noa-inline-song')),'player must expand immediately below the selected row');
   assert(await panel.locator(path.includes('music')?'[aria-label="곡 상세"]':'#yt-player').isVisible());
   await page.waitForFunction(()=>{const e=document.querySelector('.noa-inline-playback'),r=e?.getBoundingClientRect();return r&&r.bottom>0&&r.top<innerHeight;});
   const firstKey=await panel.getAttribute('data-playback-key');await page.locator('[data-browse-level="4"] .noa-inline-song').nth(1).click();assert.notEqual(await panel.getAttribute('data-playback-key'),firstKey);assert.equal(await page.locator('#yt-frame,audio').count(),1);assert(await panel.evaluate(e=>e.previousElementSibling?.dataset.inlineKey===e.dataset.playbackKey));await page.waitForFunction(()=>{const e=document.querySelector('.noa-inline-playback'),r=e?.getBoundingClientRect();return r&&r.bottom>0&&r.top>=0&&r.top<innerHeight/2;});
   if(width===390)await page.screenshot({path:out+'/'+path.slice(1,-4)+'-inline-playback.png'});
   if(path.includes('music')){await page.waitForFunction(()=>{const a=document.querySelector('audio');return a&&!a.paused&&a.currentTime>0;});const beforeNext=await panel.getAttribute('data-playback-key');await page.locator('#next').click();assert.notEqual(await panel.getAttribute('data-playback-key'),beforeNext);assert(await panel.evaluate(e=>e.previousElementSibling?.dataset.inlineKey===e.dataset.playbackKey));await page.locator('#pause-play').click();
    await page.getByRole('button',{name:'전체 음원',exact:true}).click();await page.locator('#songs .sound-play:visible').first().click();assert(await panel.evaluate(e=>e.previousElementSibling?.classList.contains('song')));await page.locator('#pause-play').click();
   }
   else {assert(await page.locator('#yt-player').isVisible());assert.match(await page.locator('#yt-frame').getAttribute('src'),/youtube/);
    if(width===390){let provider={playing:false};try{await page.waitForTimeout(1500);const frame=page.frames().find(f=>f.url().includes('youtube.com/embed/'));assert(frame);await frame.waitForFunction(()=>{const v=document.querySelector('video');return v&&!v.paused&&v.currentTime>0;},null,{timeout:8000});provider={playing:true};}catch{const frame=page.frames().find(f=>f.url().includes('youtube.com/embed/'));provider.reason=frame?await frame.evaluate(()=>document.body.innerText.slice(0,300)).catch(()=> 'provider_frame_unavailable'):'provider_frame_unavailable';}report.videoProvider=provider;}
    const title=await page.locator('.yt-card h2').first().textContent();await page.locator('#youtube-search').fill(title);assert(await page.locator('#yt-videos').isVisible());assert(await page.locator('.yt-card:visible').count()>0);await page.locator('.yt-card:visible .yt-watch').first().click();assert(await panel.evaluate(e=>e.previousElementSibling?.classList.contains('yt-card')));await page.locator('#youtube-search').fill('');
   }
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));await page.screenshot({path:out+'/'+width+'-'+path.slice(1,-4)+'-ready.png'});
   if(width===390){await page.goto(base+path+'?group=original',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>{const r=document.querySelector('[data-browse-level="2"]')?.getBoundingClientRect();return r&&r.top>=-2&&r.top<innerHeight/2;});await page.goto(base+path+'?genre=kpop-original&act=1',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>{const r=document.querySelector('[data-browse-level="4"]')?.closest('.noa-inline-act').getBoundingClientRect();return r&&r.top>=-2&&r.top<innerHeight/2;});}
   report.cases.push({width,path,firstFramesHidden:true,delayedScript:true,reloads:2,actCollapse:true,epAscending:true,selection:true,inlinePlayer:true,switchSong:true,audioPlayback:path.includes('music'),videoEmbed:path.includes('youtube'),overflow:false});
  }
  // Exercise the actual fixed bottom navigation, not only direct navigation.
  const musicLink=page.locator('.noa-mobile-nav a[href*="noa-music.php"]');assert.equal(await musicLink.count(),1);{await musicLink.first().click();await page.waitForFunction(()=>document.querySelector('#music-browse')?.dataset.browseReady==='true');assert((await page.evaluate(()=>window.__initialFrames)).every(f=>!f.visible&&!f.personalVisible));report.cases.push({width,bottomNavigation:true});}
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});assert(!/TOP\s*10/i.test(await page.locator('main').innerText()));assert(await page.getByRole('heading',{name:'추천 음악',exact:true}).isVisible());report.cases.push({width,homeTop10Removed:true});
  await context.close();
 }
 for(const path of ['/noa-music.php','/noa-youtube.php']){
  const context=await browser.newContext(contextOptions(390)),held={current:null};await routes(context,held);await context.route('**/noa-browse.js*',r=>r.abort());const page=await context.newPage();await page.goto(base+path,{waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'다시 불러오기',exact:true}).waitFor({timeout:12000});assert(await page.locator('#songs,#yt-videos').evaluate(e=>e.hidden&&getComputedStyle(e).display==='none'));report.cases.push({path,scriptFailureRecovery:true,fullListHidden:true});await context.close();
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}finally{writeFileSync(out+'/result.json',JSON.stringify(report,null,2));await browser.close();}
console.log('NOA_INITIAL_FLASH_BROWSER_OK '+report.cases.length);
