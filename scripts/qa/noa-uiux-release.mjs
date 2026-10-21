/* Read-only visual/interaction gates. Candidate documents use PHP-rendered public fixtures;
   music/auth documents remain production HTML. No member, SQL or media writes. */
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.env.NOA_SOURCE_ROOT||process.cwd(),phase=process.env.NOA_UIUX_PHASE||'candidate',out=path.join(root,'uiux-proof',phase);
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'});
const base='https://noastudio.ai.kr',docs=new Map(),report=[];
try{
 if(phase==='candidate'){
  const response=await context.request.get(base+'/noa-world.php?story=1');assert.equal(response.status(),200);const html=await response.text();
  const extract=await context.newPage();await extract.setContent(html);
  const observed=await extract.locator('.world-mv-card .world-thumbnail').evaluateAll(bs=>bs.map(b=>({id:b.dataset.video,title:b.dataset.title})));
  await extract.close();assert(observed.length>0);
  const pid='PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY',channelId='UCwYy9xsAqDFat6AV5UKrfgA';
  const source={playlist:{id:pid,snippet:{title:'📖 NOA’s Diary : EP Series M/V',channelId},status:{privacyStatus:'public'}},items:observed.map((v,i)=>({video_id:v.id,position:i})),videos:Object.fromEntries(observed.map(v=>[v.id,{id:v.id,snippet:{title:v.title,channelId,description:''},status:{privacyStatus:'public',embeddable:true}}]))};
  const sourcePath=path.join(out,'public-world-source.json');await fs.writeFile(sourcePath,JSON.stringify(source));
  const yr=await context.request.get(base+'/noa-youtube.php');assert.equal(yr.status(),200);const yt=await context.newPage();await yt.setContent(await yr.text());
  const youtube=await yt.evaluate(()=>{
   const videos=Object.fromEntries([...document.querySelectorAll('.yt-watch')].map(b=>[b.dataset.video,{id:b.dataset.video,snippet:{title:b.dataset.title},status:{privacyStatus:'public',embeddable:true},classification:b.closest('.yt-card').querySelector('p')?.textContent.includes('공식 MV')?'official_mv':'music'}]));
   const script=[...document.scripts].find(s=>s.textContent.includes('const rows='));const match=script?.textContent.match(/const rows=(\[.*?\]),search=/s);if(!match)throw Error('Public browse source missing');
   const playlists=Object.fromEntries([...document.querySelectorAll('#youtube-playlists a')].map(a=>[new URL(a.getAttribute('href'),'https://noastudio.ai.kr/noa-youtube.php').searchParams.get('playlist'),{snippet:{title:a.textContent}}]));return{videos,browseRows:JSON.parse(match[1]),playlists};
  });await yt.close();const ytPath=path.join(out,'public-youtube-source.json');await fs.writeFile(ytPath,JSON.stringify(youtube));
  for(const [route,kind,role]of [['/','home',''],['/noa-world.php','world',''],['/noa-my.php','my',''],['/noa-youtube.php','youtube',''],['/noa-my-admin-fixture','my','admin']]){
   const rendered=execFileSync('php',[path.join(root,'tests/uiux/render.php'),kind,role],{env:{...process.env,NOA_WORLD_SOURCE:sourcePath,NOA_YOUTUBE_SOURCE:ytPath},encoding:'utf8'});assert(!rendered.includes('Fatal error'));docs.set(route,rendered);
  }
  await context.route(base+'/**',async route=>{
   const request=route.request(),u=new URL(request.url());
   if(request.isNavigationRequest()&&docs.has(u.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:docs.get(u.pathname)});
   const local=path.join(root,'deploy',u.pathname.slice(1));
   if(/\.(?:css|js|json)$/.test(u.pathname)&&existsSync(local))return route.fulfill({path:local,contentType:u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.json')?'application/json':'application/javascript'});
   return route.continue();
  });
 }
 // The inline iframe URL and stop behavior are checked without starting external playback.
 await context.route('https://www.youtube.com/embed/**',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Official embed URL test</title>'}));
 const routes=['/','/noa-world.php?story=1','/noa-my.php','/noa-youtube.php','/noa-music.php','/noa-settings.php','/bbs/login.php'];
 if(phase==='candidate')routes.push('/noa-my-admin-fixture');
 for(const width of [320,390,768,1280])for(const route of routes){
  const page=await context.newPage();await page.setViewportSize({width,height:900});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:60000});assert.equal(response.status(),200,route);
  await page.locator('.noa-sidebar').waitFor({state:'attached'});await page.waitForFunction(()=>document.fonts.status==='loaded');
  if(route==='/')await page.waitForFunction(()=>document.body.dataset.noaHomeReady);
  if(['/noa-music.php','/noa-youtube.php'].includes(route))await page.locator('.noa-browse-grid .noa-browse-card').first().waitFor();
  const layout=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,text:document.body.innerText.length,actions:[...document.querySelectorAll('.noa-action')].map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,gap:getComputedStyle(e).gap})),broken:[...document.images].filter(i=>i.getBoundingClientRect().width&&i.getBoundingClientRect().height&&i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src'))}));
  assert(layout.scroll<=width+1,'overflow '+width+' '+route+' '+layout.scroll);assert(layout.text>50,'blank '+route);assert.deepEqual(errors,[],route);
  for(const action of layout.actions)assert(action.width>=43&&action.height>=43,'small action '+route);
  if(route==='/noa-my.php')assert.equal(await page.locator('.noa-workspace').count(),0);
  if(route==='/noa-my-admin-fixture')assert.equal(await page.locator('.noa-workspace a').count(),10);
  if(route.startsWith('/noa-world.php')){
   const anchors=page.locator('[aria-label="EP 선택"] a');assert.equal(await anchors.count(),10);
   await anchors.nth(4).click();await page.waitForFunction(()=>location.hash==='#ep-5');assert.equal(await page.locator('.noa-world-chapter').count(),10);
   page.on('console',m=>{if(m.text().startsWith('P0_WORLD_EVENT'))console.log(width,route,m.text());});
   await page.evaluate(()=>document.addEventListener('click',e=>{const b=e.target.closest('button');console.log('P0_WORLD_EVENT '+JSON.stringify({type:'capture',target:b?.className,id:b?.dataset.video,src:document.getElementById('world-frame')?.getAttribute('src')}));queueMicrotask(()=>console.log('P0_WORLD_EVENT '+JSON.stringify({type:'after',id:b?.dataset.video,src:document.getElementById('world-frame')?.getAttribute('src')})));},true));
   const preview=page.locator('.world-chapter-mv .world-play');const ids=[...new Set(await preview.evaluateAll(bs=>bs.map(b=>b.dataset.video)))];assert(ids.length>1);
   await page.locator('.world-chapter-mv .world-play[data-video="'+ids[0]+'"]').first().click();
   await page.waitForFunction(id=>document.getElementById('world-frame').getAttribute('src')?.includes('/embed/'+id),ids[0]);
   assert.equal(await page.locator('.world-chapter-mv #world-player').count(),1);
   await page.locator('.world-chapter-mv .world-play[data-video="'+ids[1]+'"]').first().click();
   console.log('P0_WORLD_EXPECT '+JSON.stringify({width,ids}));
   try{await page.waitForFunction(id=>document.getElementById('world-frame').getAttribute('src')?.includes('/embed/'+id),ids[1]);}
   catch(e){await page.screenshot({path:path.join(out,'world-switch-failure-'+width+'.jpg')});await fs.writeFile(path.join(out,'world-switch-failure-'+width+'.html'),await page.content());throw e;}
   assert.equal(await page.locator('#world-frame').count(),1);
   await page.getByRole('button',{name:'영상 닫기',exact:true}).click();assert.equal(await page.locator('#world-frame').getAttribute('src'),'about:blank');
   await page.evaluate(()=>scrollTo(0,0));
  }
  const filename=route.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'home';await page.screenshot({path:path.join(out,filename+'-'+width+'.jpg'),type:'jpeg',quality:78});
  if(route==='/noa-my-admin-fixture'){await page.locator('.noa-workspace').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'workspace-'+width+'.jpg'),type:'jpeg',quality:80});}
  report.push({phase,route,width,status:response.status(),layout,errors});await page.close();
 }
 if(phase==='live'){
  const r=await context.request.get(base+'/noa-bridge/home.php');assert.equal(r.status(),200);const d=await r.json();assert(d.ok);const featured=new Set(d.featured.map(v=>v.videoId));
  for(const section of ['ep','stories','covers']){assert(d[section].length<=10);assert(d[section].every(v=>!featured.has(v.videoId)),section+' repeats featured');}
  const response=await context.request.get(base+'/noa-youtube.php?playlist=PLEPMKciKgvch9TGMAcBdKzhVt1QeYsfKB');assert.equal(response.status(),200);const html=await response.text(),ids=new Set([...html.matchAll(/class="yt-watch" data-video="([A-Za-z0-9_-]{11})"/g)].map(x=>x[1]));assert(ids.size>0);assert(d.stories.every(v=>ids.has(v.videoId)),'story outside official playlist');
  const mediaPage=await context.newPage();await mediaPage.emulateMedia({reducedMotion:'no-preference'});await mediaPage.goto(base+'/',{waitUntil:'domcontentloaded'});
  await mediaPage.waitForFunction(()=>{const v=document.getElementById('noa-hero-video');return v.readyState>=2&&!v.paused;},null,{timeout:30000});
  assert.equal(await mediaPage.locator('video').evaluate(v=>v.loop),false);await mediaPage.locator('video').evaluate(v=>{v.currentTime=Math.max(0,v.duration-.2);});
  await mediaPage.waitForFunction(()=>document.querySelector('video').ended,null,{timeout:10000});assert.equal(await mediaPage.locator('video').evaluate(v=>v.paused),true);await mediaPage.close();
  report.push({phase,homeCounts:Object.fromEntries(['featured','ep','stories','covers'].map(k=>[k,d[k].length])),officialStoryMembership:true,nativeHeroEndedPaused:true});
 }
 await fs.writeFile(path.join(out,'report.json'),JSON.stringify({ok:true,phase,notVerified:['authenticated member and superadmin production interactions','actual YouTube media output; iframe route was intercepted'],checks:report},null,2));
 console.log(JSON.stringify({ok:true,phase,pages:report.length,screenWidths:[320,390,768,1280]}));
}finally{await context.close();await browser.close();}
