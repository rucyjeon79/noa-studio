import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8079',out='rhythm-proof';mkdirSync(out,{recursive:true});const report=[];
const server=spawn('php',['-S','127.0.0.1:8079','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'});
let browser;
try{for(const engine of ['chromium','webkit']){
 browser=await(engine==='webkit'?webkit.launch():chromium.launch({channel:'chrome',args:['--no-sandbox']}));
 for(const width of engine==='webkit'?[390]:[320,390,1280])for(const theme of ['noa-studio','noa-ivory']){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});await context.addCookies([{name:'qa_role',value:'admin',url:base}]);await context.addInitScript(t=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme:t,language:'ko',design:'ios',radius:'soft'})),theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const [name,path]of [['home','/'],['my','/noa-my.php'],['world','/noa-world.php?story=1'],['music','/rhythm-music.php']]){
   await page.goto(base+path);await page.locator('#noa-account-bar').waitFor();
   if(name==='home'){
    await page.locator('.noa-discovery-tabs').waitFor();assert.equal(await page.locator('#noa-featured .noa-music-card').count(),8);
    assert.equal(new Set(await page.locator('#noa-featured .noa-discovery-reason').allTextContents()).size,3);
    await page.getByRole('button',{name:'상승세',exact:true}).click();assert.equal(await page.locator('#noa-featured .noa-music-card').count(),2);assert((await page.locator('[data-home-section="recommendations"]>p').innerText()).includes('24시간'));
    await page.getByRole('button',{name:'새 영상',exact:true}).click();assert((await page.locator('#noa-featured .noa-music-card').first().getAttribute('href')).includes('video000011'));
    await page.getByRole('button',{name:'골고루',exact:true}).click();await page.getByRole('heading',{name:'추천 음악',exact:true}).click();
   }
   if(name==='world'){
    await page.locator('[aria-label="세계관 ACT 선택"] a').last().waitFor();const ys=await page.locator('[aria-label="세계관 ACT 선택"] a').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().y));assert(ys.every(y=>Math.abs(y-ys[0])<1),'ACT filters wrap');await page.getByRole('heading',{name:'ACT 뮤직비디오',exact:true}).click();
   }
   if(name==='music'){
    await page.locator('.noa-inline-song-row .noa-engagement button').first().waitFor();const d=await page.locator('.noa-inline-song-row').evaluate(row=>{const b=[...row.querySelectorAll('.noa-engagement>button')],r=b.map(x=>x.getBoundingClientRect());return {height:row.getBoundingClientRect().height,gap:b[1].querySelector('svg').getBoundingClientRect().x-b[0].querySelector('span').getBoundingClientRect().right,targets:r.every(x=>x.width>=44&&x.height>=44),aligned:r[0].y===r[1].y};});assert(d.height<=104&&d.gap>=0&&d.gap<=5&&d.targets&&d.aligned,JSON.stringify(d));
   }
   const dims=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,controls:[...document.querySelectorAll('main .noa-action:not(.noa-personal-card)')].filter(e=>e.getBoundingClientRect().height>0&&!e.closest('.noa-workspace-grid,.noa-hero,.noa-engagement')).map(e=>({text:e.textContent.trim(),direction:getComputedStyle(e).flexDirection,height:e.getBoundingClientRect().height}))}));
   assert(!dims.overflow,`${name}/${width} overflow`);assert(dims.controls.every(x=>x.direction==='row'&&x.height>=44),JSON.stringify({name,width,...dims}));
   await page.screenshot({path:`${out}/${name}-${engine}-${width}-${theme}.png`});report.push({name,engine,width,theme,...dims});
  }
  assert.deepEqual(errors,[]);await context.close();
 }
 await browser.close();browser=null;
}}finally{if(browser)await browser.close();server.kill();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
console.log('SITE_RHYTHM_AND_DISCOVERY_UI_OK',report.length);
