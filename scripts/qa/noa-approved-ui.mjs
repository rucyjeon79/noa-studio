import {chromium} from 'playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.env.NOA_SOURCE_ROOT||process.cwd(),phase=process.env.NOA_UI_PHASE||'candidate',base='https://noastudio.ai.kr',out=root+'/approved-ui-proof/'+phase;
mkdirSync(out,{recursive:true});
let musicKey='';
const routes=['/','/noa-youtube.php','/noa-world.php','/noa-music.php','/noa-my.php'];
const report={phase,rows:[],errors:[],publicSessionOnly:true,visualHtmlMemoryCache:true,physicalDevice:false,privateWrites:0};
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const request=await browser.newContext();const pages=new Map();
for(const path of routes){const response=await request.request.get(base+path,{timeout:90000});assert(response.ok());let body=await response.text();
 if(path==='/noa-music.php'){
  const records=JSON.parse(body.match(/const records=(\[[\s\S]*?\]);/)[1]),collections=JSON.parse(body.match(/const collections=(\[[\s\S]*?\]);/)[1]);
  musicKey=records.find(r=>r.audio)?.key;assert(musicKey);
  if(phase==='candidate'){
  const input=out+'/public-music-input.json';writeFileSync(input,JSON.stringify({records,collections}));
  body=execFileSync('php',['tests/uiux/render.php','music'],{cwd:root,encoding:'utf8',maxBuffer:12e6,env:{...process.env,NOA_MUSIC_SOURCE:input}});
  }
 }
 body=body.replace('</head>','<link rel="stylesheet" href="/noa-policy-20261024.css"></head>');pages.set(path,body);
}
await request.close();
try{
 for(const theme of ['noa-studio','noa-ivory'])for(const width of [320,360,390,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',extraHTTPHeaders:{'X-N80-Availability-Check':'1'}});
  await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),theme);
  await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===base&&u.pathname==='/noa-bridge/popularity-events.php'){if(req.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,csrf:'visual-only'})});if(req.method()==='POST'){let body;try{body=req.postDataJSON();}catch{}if(body?.action==='attach'&&typeof body.songKey==='string'&&Object.keys(body).sort().join(',')==='action,songKey'){report.visualTrackingRequestsSuppressed=(report.visualTrackingRequestsSuppressed||0)+1;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:false,error:'visual_tracking_disabled'})});}}}if(!['GET','HEAD'].includes(req.method())){report.errors.push('unexpected mutation '+u.pathname);return route.abort();}
   if(u.origin===base){
    if(req.isNavigationRequest()&&pages.has(u.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:pages.get(u.pathname)});
    if(phase==='candidate'&&['/noa-ui.css','/noa-ui.js','/noa-design.json','/noa-policy-20261024.css','/noa-app/p0-media.css','/noa-app/p0-player.js'].includes(u.pathname))return route.fulfill({path:root+'/deploy'+u.pathname,contentType:u.pathname.endsWith('.js')?'application/javascript':u.pathname.endsWith('.json')?'application/json':'text/css'});
   }return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  for(const path of routes){
   const check={path,theme,width};
   await page.goto(base+path+(path==='/noa-music.php'?'?track='+encodeURIComponent(musicKey):''),{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(theme=>document.documentElement.dataset.noaTheme===theme,theme);
   await page.locator('.noa-sidebar').waitFor({state:'attached'});
   if(path==='/noa-my.php'){
    await page.evaluate(()=>{sessionStorage.setItem('noa-recent-songs',JSON.stringify(['single:kpop-original:01','single:kpop-original:02']));});
    // Drive actual history through the same public Music selection later; seed names only in this isolated visual session.
    await page.evaluate(()=>{const host=document.getElementById('my-recent');host.innerHTML='<ol><li><a href="/noa-music.php?track=single%3Akpop-original%3A01">하루의 끝에</a></li><li><a href="/noa-music.php?track=single%3Akpop-original%3A02">난 다시 살아가</a></li></ol>';});
    await page.waitForFunction(()=>document.querySelector('#my-recent a>svg'));
    const row=await page.locator('#my-recent a').first().evaluate(a=>{const b=a.getBoundingClientRect(),s=a.querySelector('svg').getBoundingClientRect(),t=a.querySelector('span').getBoundingClientRect();return{height:b.height,iconRight:s.right,textLeft:t.left,direction:getComputedStyle(a).flexDirection,border:getComputedStyle(a.parentElement.parentElement.parentElement).borderTopWidth};});
    assert.equal(row.direction,'row');assert(row.height>=44&&row.iconRight<=row.textLeft);Object.assign(check,{history:row});
   }
   if(path==='/noa-music.php'){
    await page.locator('.song:visible').filter({has:page.locator('.sound-play')}).first().locator('.song-select').click();
    await page.waitForFunction(()=>document.getElementById('dock-artist')?.textContent.trim());
    const geometry=await page.evaluate(()=>{const d=document.querySelector('.noa-two-line'),top=d.querySelector('.noa-dock-top').getBoundingClientRect(),bottom=d.querySelector('.noa-dock-bottom').getBoundingClientRect();return{two:bottom.top>=top.bottom,artist:document.getElementById('dock-artist').textContent,controls:[...d.querySelectorAll('.controls button')].filter(b=>getComputedStyle(b).display!=='none'&&!b.hidden).map(b=>({id:b.id,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})),detail:!document.querySelector('section[aria-label="곡 상세"]').hidden,singleDetail:getComputedStyle(document.querySelector('section.player')).display==='none',iconInk:getComputedStyle(document.querySelector('#pause-play svg')).color,controlInk:getComputedStyle(document.getElementById('pause-play')).color,playShadow:getComputedStyle(document.getElementById('pause-play')).boxShadow,playLabel:getComputedStyle(document.getElementById('pause-play'),'::after').display,overflow:document.documentElement.scrollWidth>innerWidth};});
    assert(geometry.two&&geometry.detail&&geometry.singleDetail&&!geometry.overflow);assert.equal(geometry.iconInk,geometry.controlInk);assert.equal(geometry.playShadow,'none');assert.equal(geometry.playLabel,'none');assert.equal(geometry.controls.length,width<=360?5:6);assert(geometry.controls.every(b=>b.w>=44&&b.h>=44));
    await page.locator('#dock-more').click();assert(await page.locator('#noa-dock-popover').isVisible());assert.equal(await page.locator('#noa-dock-popover button').count(),width<=360?5:4);await page.keyboard.press('Escape');
    if(width===390&&theme==='noa-studio'){
     const start=Date.now();await page.locator('#pause-play').click();await page.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0.1);
     const before=await page.locator('audio').evaluate(a=>({time:a.currentTime,src:a.currentSrc}));
     await page.locator('.noa-mobile-nav a[href="/noa-world.php"]').click();await page.waitForSelector('#noa-shell-view');await page.waitForFunction(t=>document.querySelector('audio').currentTime>t+0.1,before.time);
     const during=await page.locator('audio').evaluate(a=>({time:a.currentTime,paused:a.paused,src:a.currentSrc}));assert(!during.paused&&during.src===before.src);await page.goBack();await page.waitForFunction(()=>!document.querySelector('#noa-shell-view'));assert(await page.locator('audio').evaluate(a=>!a.paused));await page.locator('#pause-play').click();report.audio={actualPublicMp3:true,continuity:true,srcPreserved:true,observedMs:Date.now()-start};
    }
    if(width<=360)await page.locator('#dock-more').click();await page.locator('#dock-add').click();await page.waitForFunction(()=>location.hash==='#my-playlists');assert(await page.locator('#my-playlists').isVisible());
    await page.locator('#dock-close').click();await page.locator('.noa-two-line').waitFor({state:'hidden'});assert(await page.locator('audio').evaluate(a=>a.paused));Object.assign(check,{geometry,guestAdd:'opens existing playlist/login section without a write',closeHidden:true});
    // Keep the selected two-row dock visible in the recorded screen.
    await page.locator('.song:visible').filter({has:page.locator('.sound-play')}).first().locator('.song-select').click();await page.locator('section[aria-label="곡 상세"]').scrollIntoViewIfNeeded();
   }
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert(!overflow,'overflow '+path+' '+width);Object.assign(check,{overflow});report.rows.push(check);
   if([390,1440].includes(width)){await page.screenshot({path:out+'/'+theme+'-'+width+'-'+(path==='/'?'home':path.slice(1,-4))+'.png'});}
  }
  await context.close();
 }
 if(phase==='live'){
  report.metrics=[];
  for(const profile of ['desktop','mobile-lab']){
   const context=await browser.newContext({viewport:profile==='desktop'?{width:1440,height:1000}:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block'});const page=await context.newPage(),cdp=await context.newCDPSession(page);
   if(profile==='mobile-lab'){await cdp.send('Network.enable');await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:80,downloadThroughput:1.6*1024*1024/8,uploadThroughput:.75*1024*1024/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});}
   for(const route of routes)for(let sample=0;sample<3;sample++){
    if(sample===0)await cdp.send('Network.clearBrowserCache');const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.NoaUI?.getState(),null,{timeout:45000});if(route==='/')await page.waitForFunction(()=>document.body.dataset.noaHomeReady==='true',null,{timeout:45000});await page.waitForTimeout(1200);
    const values=await page.evaluate(()=>{const n=performance.getEntriesByType('navigation')[0];return{ttfbMs:n.responseStart,domContentLoadedMs:n.domContentLoadedEventEnd,loadEventMs:n.loadEventEnd,domNodes:document.querySelectorAll('*').length};});report.metrics.push({profile,route,sample,cache:sample?'warm':'cold',status:response.status(),...values});writeFileSync(out+'/result.json',JSON.stringify(report,null,2));
   }await context.close();
  }
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}finally{writeFileSync(out+'/result.json',JSON.stringify(report,null,2));await browser.close();}
console.log('NOA_APPROVED_UI_OK '+JSON.stringify({phase,rows:report.rows.length,errors:report.errors.length}));

