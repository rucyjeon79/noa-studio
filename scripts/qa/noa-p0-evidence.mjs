import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.env.NOA_SOURCE_ROOT||process.cwd(),out=path.join(root,'p0-evidence'),base='https://noastudio.ai.kr';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const report={commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID,scope:'read-only lab and in-memory unshipped proposals',physicalDeviceTested:false,fieldINPMeasured:false,metrics:[],visuals:[],issues:[],errors:[]};
const requestContext=await browser.newContext();
const publicGet=async p=>{const r=await requestContext.request.get(base+p,{maxRetries:2,timeout:90000});assert.equal(r.status(),200,p);return r;};
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
 // Visual design proposals use a distinct fresh context; all changes exist only in browser memory.
 const prototypeCss=await fs.readFile(path.join(root,'tests/uiux/proposals/20261024/review.css'),'utf8');
 const visualRoutes=['/noa-my.php','/noa-youtube.php','/noa-music.php','/'];
 for(const variant of ['before','proposal'])for(const theme of ['noa-studio','noa-ivory'])for(const width of [320,360,390,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:width===390?844:1000},reducedMotion:'reduce',serviceWorkers:'block'});
  await context.addInitScript(({theme,seed})=>{localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'}));sessionStorage.setItem('noa-media-history-v1',JSON.stringify(seed));},{theme,seed});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(!['GET','HEAD'].includes(req.method()))return route.abort();
   if(variant==='proposal'&&u.origin===base&&u.pathname==='/p0-review-only.css')return route.fulfill({contentType:'text/css',body:prototypeCss});
   if(variant==='proposal'&&u.origin===base&&req.isNavigationRequest()){
    try{const r=await route.fetch({maxRetries:2});return route.fulfill({response:r,body:(await r.text()).replace('</head>','<link rel="stylesheet" href="/p0-review-only.css"></head>')});}catch{return route.abort();}
   }
   return route.continue();
  });
  const page=await context.newPage();
  for(const route of visualRoutes){
   await page.goto(base+route,{waitUntil:'networkidle',timeout:90000});await page.waitForFunction(theme=>document.documentElement.dataset.noaTheme===theme,theme);await page.evaluate(()=>document.fonts.ready);
   if(route==='/noa-my.php'&&seed.length)await page.waitForFunction(()=>document.querySelector('#my-recent ol,#my-recent-youtube ol'));
   if(variant==='proposal'&&route==='/noa-youtube.php')await page.evaluate(officialIds=>{
    const set=new Set(officialIds);for(const c of document.querySelectorAll('.yt-card'))if(set.has(c.dataset.browseKey))c.remove();
    const browse=document.getElementById('youtube-browse');if(browse){browse.replaceChildren();const h=document.createElement('p');h.className='noa-muted';h.textContent='일반 음악 영상 · 커버 · 사연곡';browse.append(h);}
    const grid=document.getElementById('yt-videos');if(grid)grid.hidden=false;
    for(const a of document.querySelectorAll('.yt-toolbar a'))if(a.textContent.includes('NOA WORLD'))a.href='/noa-world.php';
   },officialIds);
   if(variant==='proposal'&&route==='/noa-music.php')await page.evaluate(sample=>{
    const old=document.querySelector('.noa-two-line');if(!old)return;
    const wrap=document.createElement('section');wrap.id='p0-player-preview';wrap.setAttribute('aria-label','미배포 2줄 플레이어 시안');
    const top=document.createElement('div');top.className='p0-player-top';
    const img=document.createElement('img');img.src=sample?.thumbnail||sample?.thumb||'/noa-bridge/characters/cast-pair.jpg';img.alt='검토용 곡 카드';
    const label=document.createElement('div');label.className='p0-player-title';const strong=document.createElement('strong');strong.textContent=sample?.title||'곡을 선택하세요';const small=document.createElement('small');small.textContent='NOA · 표시 시안';label.append(strong,small);
    const controls=document.createElement('div');controls.className='p0-player-controls';
    const add=document.createElement('button');add.className='p0-add';add.setAttribute('aria-label','담기 시안');add.innerHTML='<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';controls.append(add);
    for(const id of ['previous','pause-play','next','dock-more','dock-close']){const src=document.getElementById(id);if(!src)continue;const b=src.cloneNode(true);b.removeAttribute('id');b.hidden=false;if(id==='pause-play')b.className='p0-play';controls.append(b);}
    top.append(img,label,controls);const bottom=document.createElement('div');bottom.className='p0-player-bottom';const now=document.createElement('time');now.textContent='0:00';const progress=document.createElement('progress');progress.max=100;progress.value=0;const end=document.createElement('time');end.textContent='—:—';bottom.append(now,progress,end);wrap.append(top,bottom);document.body.append(wrap);
   },sampleAudio[0]||sampleVideo[0]);
   const geometry=await page.evaluate(()=>{const overlaps=[];for(const a of document.querySelectorAll('#my-recent a,#my-recent-youtube a')){const svg=a.querySelector('svg'),text=a.querySelector('span');if(svg&&text){const s=svg.getBoundingClientRect(),t=text.getBoundingClientRect();if(Math.min(s.right,t.right)-Math.max(s.left,t.left)>1&&Math.min(s.bottom,t.bottom)-Math.max(s.top,t.top)>1)overlaps.push(a.textContent);}}return{overflow:document.documentElement.scrollWidth>innerWidth,historyOverlapCount:overlaps.length,historyLinks:document.querySelectorAll('#my-recent a,#my-recent-youtube a').length};});
   const file=variant+'-'+theme+'-'+width+'-'+(route==='/'?'home':route.slice(1).replace('.php',''))+'.png';
   const screenshot=[390,1440].includes(width)||(route==='/noa-music.php'&&width===320);
   if(screenshot)await page.screenshot({path:path.join(out,file),fullPage:false});
   report.visuals.push({variant,theme,width,route,file:screenshot?file:null,seededHistoryForReviewOnly:route==='/noa-my.php',...geometry});
   if(variant==='proposal')assert(!geometry.overflow,'proposal overflow '+file);
  }
  await context.close();
 }
 console.log('NOA_P0_EVIDENCE_COMPLETE',JSON.stringify({timingSamples:report.metrics.length,visuals:report.visuals.length,officialMvOverlap:report.content.overlap.length}));
}catch(e){report.errors.push(String(e));throw e;}
finally{await fs.writeFile(path.join(out,'evidence.json'),JSON.stringify(report,null,2));await requestContext.close();await browser.close();}
