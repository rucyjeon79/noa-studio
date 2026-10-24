import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.env.NOA_SOURCE_ROOT||process.cwd(),out=path.join(root,'p0-evidence'),base='https://noastudio.ai.kr';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const report={commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,scope:'read-only lab and in-memory unshipped proposals',physicalDeviceTested:false,fieldINPMeasured:false,metrics:[],visuals:[],issues:[],errors:[]};
report.apiMeasurements=[];report.interactions=[];
if(process.env.NOA_P0_REUSE_METRICS){const baseline=JSON.parse(await fs.readFile(process.env.NOA_P0_REUSE_METRICS,'utf8'));report.metrics=baseline.metrics;report.measurementRun=baseline.run;report.measurementCommit=baseline.commit;}
const requestContext=await browser.newContext();
const publicGet=async p=>{const start=performance.now();const r=await requestContext.request.get(base+p,{maxRetries:2,timeout:90000});assert.equal(r.status(),200,p);report.apiMeasurements.push({path:p,totalMs:performance.now()-start,bytes:(await r.body()).length,status:r.status(),scope:'runner HTTP, not device TTFB'});return r;};
async function ids(html,selector){const p=await requestContext.newPage();await p.setContent(html);const v=await p.locator(selector).evaluateAll(ns=>[...new Set(ns.map(n=>n.dataset.video).filter(Boolean))]);await p.close();return v;}
try{
 const catalog=await(await publicGet('/noa-bridge/catalog.php')).json();
 const sampleAudio=(catalog.items||[]).filter(i=>i.audioVerified&&i.audioUrl).slice(0,2);
 const sampleVideo=(catalog.items||[]).filter(i=>i.youtubeId).slice(0,2);
 const seed=[...sampleAudio.map(i=>({type:'audio',key:i.key})),...sampleVideo.map(i=>({type:'youtube',key:i.youtubeId}))];
 report.publicCatalog={items:catalog.items?.length,verifiedAudioReferences:sampleAudio.length};
 const youtubeHtml=await(await publicGet('/noa-youtube.php')).text();
 const official='PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY';
 const listHtml=await(await publicGet('/noa-youtube.php?playlist='+official)).text();
 const ordinaryIds=await ids(youtubeHtml,'.yt-watch[data-video]'),officialIds=await ids(listHtml,'.yt-watch[data-video]');
 const worldIds=new Set();
 for(const p of ['/noa-world.php',...Array.from({length:4},(_,i)=>'/noa-world.php?story='+(i+1))])for(const id of await ids(await(await publicGet(p)).text(),'[data-video]'))worldIds.add(id);
 report.content={officialPlaylistId:official,ordinaryCount:ordinaryIds.length,officialCount:officialIds.length,overlap:officialIds.filter(id=>ordinaryIds.includes(id)),worldIds:[...worldIds],officialNotObservedInWorld:officialIds.filter(id=>!worldIds.has(id))};
 if(report.content.overlap.length)report.issues.push({id:'YT-OFFICIAL-MV-OVERLAP',severity:'P0',count:report.content.overlap.length,evidence:'exact collected official playlist membership, not EP title matching'});
 const paths=['/','/noa-youtube.php','/noa-world.php','/noa-music.php','/noa-my.php'];
 // Unmodified production pages only. No design override participates in these timings.
 for(const profile of ['desktop','mobile-lab']){
  const context=await browser.newContext({viewport:profile==='desktop'?{width:1440,height:1000}:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>{
   const p=window.__p0={lcp:0,cls:0,longTasks:[],events:[]};
   for(const[type,callback]of [['largest-contentful-paint',e=>p.lcp=e.startTime],['layout-shift',e=>{if(!e.hadRecentInput)p.cls+=e.value}],['longtask',e=>p.longTasks.push(e.duration)],['event',e=>{if(e.interactionId)p.events.push(e.duration)}]])try{new PerformanceObserver(list=>list.getEntries().forEach(callback)).observe({type,buffered:true,durationThreshold:16});}catch{}
  });
  const page=await context.newPage();
  const cdp=await context.newCDPSession(page);
  if(profile==='mobile-lab'){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1.6*1024*1024/8,uploadThroughput:0.75*1024*1024/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  for(const route of paths)for(let sample=0;sample<3;sample++){
   if(report.metrics.some(m=>m.profile===profile&&m.route===route&&m.sample===sample))continue;
   if(sample===0){await cdp.send('Network.clearBrowserCache');}
   const start=performance.now();const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});
   await page.waitForFunction(()=>window.NoaUI?.getState(),null,{timeout:45000});
   if(route==='/')await page.waitForFunction(()=>document.body.dataset.noaHomeReady==='true',null,{timeout:45000});
   await page.waitForTimeout(1200);
   const values=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0],r=performance.getEntriesByType('resource');return{ttfbMs:n.responseStart,domContentLoadedMs:n.domContentLoadedEventEnd,loadEventMs:n.loadEventEnd,lcpMs:window.__p0.lcp,cls:window.__p0.cls,domNodes:document.querySelectorAll('*').length,domBytes:document.documentElement.outerHTML.length,resources:r.length,transferBytes:r.reduce((s,x)=>s+x.transferSize,0),longTaskCount:window.__p0.longTasks.length,longTaskMaxMs:Math.max(0,...window.__p0.longTasks),scriptRequests:r.filter(x=>x.initiatorType==='script').map(x=>({path:new URL(x.name).pathname,durationMs:x.duration,bytes:x.transferSize})),sameOriginSlowResources:r.filter(x=>new URL(x.name).origin===location.origin).sort((a,b)=>b.duration-a.duration).slice(0,8).map(x=>({path:new URL(x.name).pathname,durationMs:x.duration,bytes:x.transferSize})),overflow:document.documentElement.scrollWidth>innerWidth};});
   const button=page.locator('.noa-menu a').first();const feedbackStart=performance.now();await button.focus();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));values.focusFeedbackLabMs=performance.now()-feedbackStart;
   report.metrics.push({profile,route,sample,cache:sample?'warm':'cold',status:response.status(),observedReadyMs:performance.now()-start,...values});
  }
  await context.close();
 }
 // Collect settled load metrics separately. The earlier 1.2s observations are not final/field LCP.
 report.lcpAudit=[];
 for(const profile of ['desktop','mobile-lab']){
  const context=await browser.newContext({viewport:profile==='desktop'?{width:1440,height:1000}:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__settled={lcp:0,cls:0};for(const type of ['largest-contentful-paint','layout-shift'])try{new PerformanceObserver(list=>{for(const e of list.getEntries()){if(type==='largest-contentful-paint')window.__settled.lcp=e.startTime;else if(!e.hadRecentInput)window.__settled.cls+=e.value;}}).observe({type,buffered:true});}catch{}});
  const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Network.enable');
  if(profile==='mobile-lab'){await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1.6*1024*1024/8,uploadThroughput:.75*1024*1024/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  for(const route of paths){await cdp.send('Network.clearBrowserCache');await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});let complete=true;try{await page.waitForLoadState('load',{timeout:45000});await page.waitForFunction(()=>window.NoaUI?.getState(),null,{timeout:45000});await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}catch{complete=false;}
   report.lcpAudit.push({profile,route,cache:'cold',loadComplete:complete,...await page.evaluate(()=>({...window.__settled,ttfbMs:performance.getEntriesByType('navigation')[0].responseStart,elapsedMs:performance.now(),brokenAboveFold:[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.top<innerHeight&&r.bottom>0&&i.complete&&!i.naturalWidth}).length}))});await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));
  }await context.close();
 }
 // Real public controls, no uploads, membership or playlist writes. Modes/history stay in this isolated context.
 for(const profile of ['desktop','mobile-lab']){
  const context=await browser.newContext({viewport:profile==='desktop'?{width:1440,height:1000}:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
  const page=await context.newPage();
  if(profile==='mobile-lab'){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
  for(const [url,label]of [['/noa-youtube.php','전체 영상'],['/noa-music.php','전체 음원']]){
   await page.goto(base+url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.NoaUI?.getState()&&window.NoaBrowse);
   const start=performance.now();await page.getByRole('button',{name:label,exact:true}).click();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   report.interactions.push({profile,path:url,action:label,clickToTwoFramesLabMs:performance.now()-start,visibleCards:await page.locator(url.includes('youtube')?'.yt-card:visible':'.song:visible').count()});
   if(url.includes('youtube')){const start=performance.now();await page.locator('#youtube-search').fill('NOA');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));report.interactions.push({profile,path:url,action:'search NOA',inputToTwoFramesLabMs:performance.now()-start});}
  }
  for(const target of ['/noa-world.php','/noa-my.php','/']){
   const menu=page.locator('.noa-menu a[href="'+target+'"]:visible,.noa-mobile-nav a[href="'+target+'"]:visible').first();const start=performance.now();await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),menu.click()]);await page.waitForFunction(()=>window.NoaUI?.getState());report.interactions.push({profile,action:'menu '+target,transitionToThemeReadyLabMs:performance.now()-start});
  }
  await context.close();
 }
 if(sampleAudio.length){
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
  const page=await context.newPage();const media={sampleKey:sampleAudio[0].key,actualSource:true,productionWrites:0,uploadQueueActions:0,physicalDevice:false};
  try{
   await page.goto(base+'/noa-music.php?track='+encodeURIComponent(sampleAudio[0].key),{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.getElementById('sound-player')?.readyState>=2,null,{timeout:60000});
   const start=performance.now();await page.locator('#pause-play').click();await page.waitForFunction(()=>{const a=document.getElementById('sound-player');return !a.paused&&a.currentTime>.1},null,{timeout:20000});media.playStartLabMs=performance.now()-start;
   media.before=await page.locator('#sound-player').evaluate(a=>({time:a.currentTime,src:a.currentSrc,duration:a.duration}));
   for(const id of ['repeat','shuffle','sequential']){await page.locator('#dock-more').click();const b=page.locator('#'+id);const before=await b.getAttribute('aria-pressed');await b.click();const after=await b.getAttribute('aria-pressed');(media.modes??=[]).push({id,before,after});if(before!==after){await page.locator('#dock-more').click();await b.click();}}
   const seek=page.locator('#seek');const before=await seek.inputValue();await seek.press('ArrowRight');media.seek={before,after:await seek.inputValue()};
   const startNav=performance.now();await page.locator('.noa-menu a[href="/noa-world.php"]:visible,.noa-mobile-nav a[href="/noa-world.php"]:visible').first().click();
   await page.waitForFunction(()=>document.querySelector('#noa-shell-view')?.contentDocument?.querySelector('main h1'),null,{timeout:45000});
   media.shellTransitionMs=performance.now()-startNav;media.duringView=await page.locator('#sound-player').evaluate(a=>({paused:a.paused,time:a.currentTime,src:a.currentSrc}));
   await page.goBack();await page.waitForFunction(()=>!document.getElementById('noa-shell-view'));media.afterBack=await page.locator('#sound-player').evaluate(a=>({paused:a.paused,time:a.currentTime,src:a.currentSrc}));
   for(const id of ['next','previous']){const before=await page.locator('#dock-title').innerText();await page.locator('#'+id).click();await page.waitForTimeout(300);(media.trackMoves??=[]).push({id,before,after:await page.locator('#dock-title').innerText()});}
   await page.locator('#dock-close').click();media.closedPaused=await page.locator('#sound-player').evaluate(a=>a.paused);
  }catch(e){media.error=String(e);}
  finally{report.realAudio=media;await context.close();}
 }
 // Visual design proposals use a distinct fresh context; all changes exist only in browser memory.
 const prototypeCss=await fs.readFile(path.join(root,'tests/uiux/proposals/20261024/review.css'),'utf8');
 const visualRoutes=['/noa-my.php','/noa-youtube.php','/noa-music.php','/','/noa-world.php'];
 for(const variant of ['before','proposal'])for(const theme of ['noa-studio','noa-ivory'])for(const width of [320,360,390,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(({theme,seed})=>{localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'}));sessionStorage.setItem('noa-media-history-v1',JSON.stringify(seed));},{theme,seed});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(!['GET','HEAD'].includes(req.method()))return route.abort();
   if(variant==='proposal'&&u.origin===base&&u.pathname==='/p0-review-only.css')return route.fulfill({contentType:'text/css',body:prototypeCss});
   if(variant==='proposal'&&u.origin===base&&req.isNavigationRequest()){
    try{const r=await route.fetch({maxRetries:2});let html=(await r.text()).replace('</head>','<link rel="stylesheet" href="/p0-review-only.css"></head>');if(u.pathname==='/noa-youtube.php')html=html.replace(/const rows=(\[.*?\]),search=/s,(whole,json)=>'const rows='+JSON.stringify(JSON.parse(json).filter(r=>!officialIds.includes(r.key)))+',search=');return route.fulfill({response:r,body:html});}catch{return route.abort();}
   }
   return route.continue();
  });
  const page=await context.newPage();
  for(const route of visualRoutes){
   await page.goto(base+route+(route==='/noa-youtube.php'?'?view=all':''),{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(theme=>document.documentElement.dataset.noaTheme===theme,theme,{timeout:45000});await page.evaluate(()=>document.fonts.ready);
   if(route==='/noa-my.php'&&seed.length)await page.waitForFunction(()=>document.querySelector('#my-recent ol,#my-recent-youtube ol'));
   if(variant==='proposal'&&route==='/noa-youtube.php')await page.evaluate(officialIds=>{
    const set=new Set(officialIds);for(const c of document.querySelectorAll('.yt-card'))if(set.has(c.dataset.browseKey))c.remove();
    for(const a of document.querySelectorAll('.yt-toolbar a'))if(a.textContent.includes('NOA WORLD'))a.href='/noa-world.php';
   },officialIds);
   if(route==='/noa-music.php')await page.evaluate(sample=>{const dock=document.querySelector('.noa-two-line');if(dock)dock.hidden=false;const title=document.getElementById('dock-title');if(title)title.textContent=sample?.title||'곡을 선택하세요';const image=document.getElementById('dock-cover');if(image&&sample?.thumbnail){image.src=sample.thumbnail;image.hidden=false;const empty=document.getElementById('dock-cover-empty');if(empty)empty.hidden=true;}},sampleAudio[0]||sampleVideo[0]);
   if(variant==='proposal'&&route==='/noa-music.php')await page.evaluate(sample=>{
    const old=document.querySelector('.noa-two-line');if(!old)return;
    const wrap=document.createElement('section');wrap.id='p0-player-preview';wrap.setAttribute('aria-label','미배포 2줄 플레이어 시안');
    const top=document.createElement('div');top.className='p0-player-top';
    const img=document.createElement('img');img.src=sample?.thumbnail||sample?.thumb||'/noa-bridge/characters/cast-pair.jpg';img.alt='검토용 곡 카드';
    const label=document.createElement('div');label.className='p0-player-title';const strong=document.createElement('strong');strong.textContent=sample?.title||'곡을 선택하세요';const small=document.createElement('small');small.textContent='NOA · 표시 시안';label.append(strong,small);
    const controls=document.createElement('div');controls.className='p0-player-controls';
    const add=document.createElement('button');add.className='p0-add';add.setAttribute('aria-label','담기 시안');add.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';controls.append(add);
    for(const id of ['previous','pause-play','next','dock-more','dock-close']){const src=document.getElementById(id);if(!src)continue;const b=src.cloneNode(true);b.removeAttribute('id');b.className=id==='pause-play'?'p0-play':'';b.hidden=false;controls.append(b);}
    top.append(img,label,controls);const bottom=document.createElement('div');bottom.className='p0-player-bottom';const now=document.createElement('time');now.textContent='0:00';const progress=document.createElement('progress');progress.max=100;progress.value=0;const end=document.createElement('time');end.textContent='—:—';bottom.append(now,progress,end);wrap.append(top,bottom);document.body.append(wrap);
   },sampleAudio[0]||sampleVideo[0]);
   const geometry=await page.evaluate(()=>{const overlaps=[];for(const a of document.querySelectorAll('#my-recent a,#my-recent-youtube a')){const svg=a.querySelector('svg'),text=a.querySelector('span');if(svg&&text){const s=svg.getBoundingClientRect(),t=text.getBoundingClientRect();if(Math.min(s.right,t.right)-Math.max(s.left,t.left)>1&&Math.min(s.bottom,t.bottom)-Math.max(s.top,t.top)>1)overlaps.push(a.textContent);}}return{overflow:document.documentElement.scrollWidth>innerWidth,historyOverlapCount:overlaps.length,historyLinks:document.querySelectorAll('#my-recent a,#my-recent-youtube a').length};});
   const file=variant+'-'+theme+'-'+width+'-'+(route==='/'?'home':route.slice(1).replace('.php',''))+'.png';
   const screenshot=[390,1440].includes(width)||(route==='/noa-music.php'&&width===320);
   if(screenshot)await page.waitForFunction(()=>[...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.top<innerHeight&&r.bottom>0}).every(i=>i.complete),null,{timeout:15000}).catch(()=>{});
   if(screenshot)await page.screenshot({path:path.join(out,file),fullPage:false});
   report.visuals.push({variant,theme,width,route,file:screenshot?file:null,seededHistoryForReviewOnly:route==='/noa-my.php',...geometry});
   await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));
   if(variant==='proposal')assert(!geometry.overflow,'proposal overflow '+file);
  }
  await context.close();
 }
 console.log('NOA_P0_EVIDENCE_COMPLETE',JSON.stringify({timingSamples:report.metrics.length,visuals:report.visuals.length,officialMvOverlap:report.content.overlap.length}));
}catch(e){report.errors.push(String(e));throw e;}
finally{await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));await requestContext.close();await browser.close();}
