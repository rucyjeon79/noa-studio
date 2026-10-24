import {createRequire}from'node:module';
const {chromium}=createRequire(process.env.NOA_PLAYWRIGHT_PACKAGE||import.meta.url)('playwright');
import {mkdirSync,writeFileSync,readFileSync}from'node:fs';import assert from'node:assert/strict';
const origin='https://noastudio.ai.kr',phase=process.env.NOA_FOUR_PHASE||'candidate',out='category-proof/'+phase+'/four-level';mkdirSync(out,{recursive:true});
const report={phase,cases:[],errors:[],productionWrites:0,providerPlaybackVerified:false};
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 for(const theme of ['noa-studio','noa-ivory'])for(const width of [320,360,390,430,768,1024,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
  await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),theme);
  await context.route('**/*',route=>{const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD'].includes(request.method())){report.productionWrites++;return route.abort();}
   if(url.hostname==='www.youtube.com'||url.hostname==='www.youtube-nocookie.com')return route.abort();
   if(phase==='candidate'&&url.origin===origin&&['/noa-browse.js','/noa-ui.css'].includes(url.pathname))return route.fulfill({path:process.cwd()+'/deploy'+url.pathname,contentType:url.pathname.endsWith('.js')?'application/javascript':'text/css'});
   return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
  for(const path of ['/noa-music.php','/noa-youtube.php']){
   await page.goto(origin+path,{waitUntil:'domcontentloaded',timeout:90000});await page.waitForFunction(()=>window.NoaBrowse&&document.querySelector('[data-browse-group]'));
   const host=page.locator('.noa-browse');assert.deepEqual(await host.locator('[data-browse-group] strong').allTextContents(),['오리지널송','EP 컬렉션','당신의 이야기, 우리의 음악','AInoa의 유명곡 커버']);assert.equal(await host.locator('[data-browse-level="2"]').count(),0);
   let genreCount=0,actLists=0,looseLists=0;
   for(const group of ['original','ep','story','cover']){
    await host.locator('[data-browse-group="'+group+'"]').click();assert.equal(await host.locator('[data-browse-group]').count(),4);assert.equal(await host.locator('[data-browse-group][aria-expanded="true"]').count(),1);assert.equal(await host.locator('[data-browse-level="3"]').count(),0,'group cannot skip genres');
    const ids=await host.locator('[data-browse-genre]').evaluateAll(nodes=>nodes.map(n=>n.dataset.browseGenre));assert.equal(ids.length,group==='original'?4:group==='ep'?9:1);
    for(const genre of ids){
     await host.locator('[data-browse-genre="'+genre+'"]').click();assert.equal(await host.locator('[data-browse-genre][aria-expanded="true"]').count(),1);assert.equal(await host.locator('[data-browse-level="3"]').count(),1);assert.equal(await host.locator('[data-browse-level="4"]').count(),0);genreCount++;
     const acts=host.locator('[data-browse-act]'),values=await acts.evaluateAll(nodes=>nodes.map(n=>Number(n.dataset.browseAct)));assert.deepEqual(values,[...values].sort((a,b)=>a-b));
     if(values.length){
      await acts.first().click();assert.equal(await host.locator('[data-browse-level="4"]').count(),1);assert.equal(await acts.first().getAttribute('aria-expanded'),'true');
      const rows=host.locator('[data-browse-level="4"] .noa-inline-song');assert(await rows.count()>0);const eps=(await rows.allTextContents()).map(t=>Number(t.match(/^EP[.](\d+)/)?.[1]||0)).filter(Boolean);assert.deepEqual(eps,[...eps].sort((a,b)=>a-b));actLists++;
      if(values.length>1){await acts.nth(1).click();assert.equal(await acts.first().getAttribute('aria-expanded'),'false');assert.equal(await acts.nth(1).getAttribute('aria-expanded'),'true');assert.equal(await host.locator('[data-browse-level="4"]').count(),1);await acts.nth(1).click();}
      else await acts.first().click();assert.equal(await host.locator('[data-browse-level="4"]').count(),0);
     }
     const loose=host.locator('.noa-loose-songs');if(await loose.count()){assert(await loose.locator('.noa-inline-song').count()>0);assert(await loose.evaluate(n=>n===n.parentElement.lastElementChild));looseLists++;}
    }
   }
   assert.equal(genreCount,15);
   await host.locator('[data-browse-group="original"]').click();await host.locator('[data-browse-genre="kpop-original"]').click();const act=host.locator('[data-browse-act]').first();await act.click();const first=host.locator('[data-browse-level="4"] .noa-inline-song').first();
   const image=first.locator('img');assert.equal(await image.count(),1);await image.evaluate(n=>n.loading='eager');await page.waitForFunction(()=>{const i=document.querySelector('[data-browse-level="4"] img');return i?.complete&&i.naturalWidth>0;});
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
   if([390,1440].includes(width))await page.screenshot({path:out+'/'+theme+'-'+width+'-'+path.slice(1,-4)+'.png'});
   await first.click();if(path.includes('music'))assert(await page.locator('[aria-label="곡 상세"]').isVisible());else{assert(await page.locator('#yt-player').isVisible());assert.match(await page.locator('#yt-frame').getAttribute('src'),/youtube/);}
   await host.locator('.noa-browse-all').click();assert.equal(await host.locator('.noa-browse-pager button').count(),2);
   report.cases.push({path,theme,width,genreCount,actLists,looseLists,parentChoicesPreserved:true,folding:true,epAscending:true,realArtwork:true,itemSelection:true,pagination:true,overflow:false});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);assert.equal(report.productionWrites,0);report.ok=true;
}finally{await browser.close();writeFileSync(out+'/result.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,cases:report.cases.length,errors:report.errors,productionWrites:report.productionWrites}));}
