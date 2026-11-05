import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const phase=process.env.NOA_RUNTIME_PHASE||'baseline',out='home-runtime-proof/'+phase;mkdirSync(out,{recursive:true});
let server;
if(phase==='candidate'){
 server=spawn('php',['-S','127.0.0.1:8097','-t','deploy'],{stdio:'ignore'});
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8097/noa-home-assets.php')).status===400)break;}catch{}await new Promise(r=>setTimeout(r,100));}
}
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',locale:'ko-KR'});
  if(phase==='candidate'){
   await context.route('https://noastudio.ai.kr/',async route=>{
    const response=await route.fetch();
    const output=spawnSync('php',['tests/home-runtime/rewrite.php'],{input:await response.text(),encoding:'utf8'});
    assert.equal(output.status,0,output.stderr);
    await route.fulfill({response,body:output.stdout});
   });
   await context.route('**/noa-home-assets.php?*',async route=>{
    const response=await fetch('http://127.0.0.1:8097'+new URL(route.request().url()).pathname+new URL(route.request().url()).search);
    assert.equal(response.status,200);
    await route.fulfill({status:200,contentType:response.headers.get('content-type'),body:await response.text()});
   });
  }
  const page=await context.newPage(),errors=[],requests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfinished',async request=>{const response=await request.response();requests.push({path:new URL(request.url()).pathname,type:request.resourceType(),timing:request.timing(),status:response?.status()});});
  await page.addInitScript(()=>{
   window.qaLongTasks=[];
   new PerformanceObserver(list=>window.qaLongTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:true});
  });
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  await page.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForTimeout(8000);
  const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  await cdp.send('Profiler.enable');await cdp.send('Profiler.start');
  await page.waitForTimeout(5000);
  const {profile}=await cdp.send('Profiler.stop');
  const after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  writeFileSync(out+'/'+width+'.cpuprofile',JSON.stringify(profile));
  const hot=profile.nodes.filter(n=>n.hitCount).sort((a,b)=>b.hitCount-a.hitCount).slice(0,20).map(n=>({function:n.callFrame.functionName,url:n.callFrame.url.split('?')[0],line:n.callFrame.lineNumber+1,hits:n.hitCount}));
  const timing=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation')[0].toJSON(),paints:performance.getEntriesByType('paint').map(e=>e.toJSON()),resources:performance.getEntriesByType('resource').map(e=>({path:new URL(e.name).pathname,duration:e.duration,size:e.encodedBodySize})),longTasks:window.qaLongTasks,nodes:document.querySelectorAll('*').length}));
  const initialRequests=requests.slice();
  const idle=Object.fromEntries(['TaskDuration','ScriptDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,after[k]-before[k]]));
  let transport=[];
  if(phase!=='baseline'){
   const urls=await page.locator('script[src*="/noa-home-assets.php"],link[href*="/noa-home-assets.php"]').evaluateAll(nodes=>nodes.map(n=>n.src||n.href));
   assert(urls.length>=4&&urls.length<=7,'expected compact asset groups');
   for(const url of urls){
    const target=phase==='candidate'?'http://127.0.0.1:8097'+new URL(url).pathname+new URL(url).search:url;
    const response=await fetch(target,{headers:{'Accept-Encoding':'gzip'}}),body=await response.text();
    assert.equal(response.status,200);assert.equal(response.headers.get('content-encoding'),'gzip');
    assert.match(response.headers.get('cache-control'),/immutable/);assert.equal(response.headers.get('set-cookie'),null);
    assert.equal((await fetch(target,{headers:{'Accept-Encoding':'gzip','If-None-Match':response.headers.get('etag')}})).status,304);
    transport.push({files:new URL(url).searchParams.get('files'),decoded:Buffer.byteLength(body),encoded:Number(response.headers.get('content-length'))});
   }
   const invalidBase=phase==='candidate'?'http://127.0.0.1:8097':'https://noastudio.ai.kr';
   assert.equal((await fetch(invalidBase+'/noa-home-assets.php?files=common.php')).status,400);
   const stale=await fetch(invalidBase+'/noa-home-assets.php?files=noa-brand.js&v=old',{headers:{'Accept-Encoding':'gzip;q=0'}});
   assert.equal(stale.status,200);assert.equal(stale.headers.get('cache-control'),'no-store');assert.equal(stale.headers.get('content-encoding'),null);
   assert(await page.evaluate(()=>!!window.NoaUI&&!!window.NoaCardLayout&&!!window.NoaVoice&&!!window.NoaMemberSurfaces));
   assert.equal(await page.locator('.nl-moods button').count(),8);
   assert.equal(await page.locator('#noa-daily-fortune h2').textContent(),'오늘의 운세');
   const close=page.getByRole('button',{name:'응원 안내 닫기'});if(await close.isVisible())await close.click();
   assert(await page.locator('#noa-featured .noa-music-card').count()>0);
   const titles=await page.locator('#noa-featured .noa-card-heading').allTextContents();
   await page.locator('[aria-label="추천 음악 페이지"]').getByRole('button',{name:'다음'}).click();
   assert.notDeepEqual(await page.locator('#noa-featured .noa-card-heading').allTextContents(),titles);
   const order=await page.locator('.noa-main').evaluate(main=>[...main.children].map(e=>e.id||e.dataset.homeBanner||e.dataset.homeSection||e.className));
   assert(order.indexOf('noa-daily-fortune')>order.findIndex(x=>x.includes('noa-monthly-benefits')));
   assert(order.indexOf('youtube')<order.indexOf('noa-world'));assert(order.indexOf('amt')<order.indexOf('collections'));
   await page.locator('[data-footer-theme="noa-ivory"]').click();
   assert.equal(await page.locator('html').getAttribute('data-noa-theme'),'noa-ivory');
   await page.evaluate(()=>scrollTo(0,0));
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.screenshot({path:out+'/'+width+'-light.png'});
   await page.locator('[data-footer-theme="noa-studio"]').click();
   assert.equal(await page.locator('html').getAttribute('data-noa-theme'),'noa-studio');
   await page.evaluate(()=>scrollTo(0,0));
   assert.deepEqual(errors,[]);
   assert(transport.reduce((sum,r)=>sum+r.encoded,0)<transport.reduce((sum,r)=>sum+r.decoded,0)*.4,'asset compression regressed');
  }
  let warm=null;
  if(phase==='live'){
   await page.reload({waitUntil:'domcontentloaded'});
   warm=await page.evaluate(()=>({navigation:performance.getEntriesByType('navigation')[0].toJSON(),bundles:performance.getEntriesByType('resource').filter(e=>e.name.includes('/noa-home-assets.php?')).map(e=>({transfer:e.transferSize,encoded:e.encodedBodySize,duration:e.duration}))}));
   assert.equal(warm.bundles.length,transport.length);assert(warm.bundles.every(r=>r.transfer===0),'unchanged bundles must come from the browser cache');
  }
  const report={phase,width,errors,requests:initialRequests,timing,idle,hot,transport,warm};
  writeFileSync(out+'/'+width+'.json',JSON.stringify(report,null,2));
  console.log('HOME_RUNTIME',JSON.stringify({...report,requests:initialRequests.length,timing:{...timing,resources:timing.resources.sort((a,b)=>b.duration-a.duration).slice(0,15),longTasks:timing.longTasks.slice(-10)}}));
  await page.screenshot({path:out+'/'+width+'.png'});
  await context.close();
 }
}finally{await browser.close();server?.kill();}
