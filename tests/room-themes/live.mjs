import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const source=process.env.NOA_SOURCE_ROOT||process.cwd();
const phase=process.env.NOA_THEME_PHASE||'live';
const output='room-theme-proof/'+phase;
const config=JSON.parse(readFileSync(source+'/deploy/noa-design.json','utf8'));
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync(output,{recursive:true});
const results=[];
try{for(const width of [390,768,1280]){
 const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Asia/Seoul',serviceWorkers:'block'}),p=await context.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(phase==='candidate')for(const name of ['noa-design.json','noa-starlight.css','noa-ui.js']){
  await context.route('**/'+name+'*',route=>route.fulfill({body:readFileSync(source+'/deploy/'+name),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'application/json'}));
 }
 const base='https://noastudio.ai.kr';
 await p.clock.setFixedTime(new Date('2026-11-03T12:00:00+09:00'));
 await p.goto(base+'/');
 await p.waitForFunction(()=>document.documentElement.dataset.noaTheme==='noa-ivory'&&document.documentElement.dataset.noaThemePreference==='auto');
 const campaign=p.locator('#noa-amt-fan .amt-close');if(await campaign.isVisible())await campaign.click();
 await p.locator('[data-noa-display-settings]:visible').first().click();
 await p.locator('#noa-theme').waitFor();
 assert.equal(await p.locator('#noa-theme').inputValue(),'auto','fresh visitor defaults to scheduled automatic mode');
 for(const mode of ['noa-ivory','noa-studio']){
  const theme=config.themes.find(t=>t.id===mode);
  await p.locator('#noa-theme').selectOption(mode);
  assert.equal(await p.locator('#noa-theme option:checked').innerText(),theme.name);
  await p.locator('#noa-settings-dialog .noa-dialog-close').click();
  for(const [route,room] of [['/','home'],['/noa-lounge.php','community'],['/noa-shop.php','shop'],['/noa-login.php','']]){
   await p.goto(base+route,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(([mode,room])=>document.documentElement.dataset.noaTheme===mode&&document.documentElement.dataset.noaRoom===room,[mode,room]);
   // Close the real campaign overlay through its existing control, without account writes.
   if(room==='home'){
    const close=p.locator('#noa-amt-fan .amt-close');
    if(await close.isVisible())await close.click();
   }
   await p.evaluate(()=>document.fonts.ready);
   const metrics=await p.evaluate(()=>{
    const root=document.documentElement,style=getComputedStyle(root);
    return {bg:style.getPropertyValue('--noa-bg').trim().toLowerCase(),shared:style.getPropertyValue('--noa-darkGray').trim().toLowerCase(),scheme:style.colorScheme,overflow:root.scrollWidth-innerWidth,text:document.querySelector('main')?.innerText.length||0};
   });
   results.push({width,mode,route,...metrics});console.log(JSON.stringify(results.at(-1)));
   assert.equal(metrics.bg,theme.tokens.bg.toLowerCase());
   assert.equal(metrics.shared,'#30343b');
   assert.equal(metrics.scheme,mode==='noa-ivory'?'light':'dark');
   assert(metrics.overflow<=1,JSON.stringify(results.at(-1)));
   assert(metrics.text>20,'visible content: '+route);
   assert.deepEqual(errors,[],'uncaught browser errors: '+route);
   const selected=p.locator('#noa-section-navigation a[aria-current=page]');
   if(mode==='noa-ivory'&&await selected.count())assert.equal(await selected.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)','active section label remains readable: '+route);
   if(room==='home'){assert.equal(await p.locator('#noa-theme-scene h2').innerText(),theme.concept.title);assert.equal(await p.locator('#noa-theme-scene .noa-theme-hour strong').innerText(),theme.concept.time);}
   if(room==='shop')await p.locator('.ec-grid .ec-card').first().waitFor();
   if(room==='community')await p.locator('.ec-write-invite').first().waitFor();
   if(mode==='noa-ivory')for(const primary of await p.locator('.ec-primary:visible').all()){
    const paint=await primary.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
    assert.deepEqual(paint,{color:'rgb(255, 255, 255)',background:'rgb(37, 103, 125)'},'primary control remains readable: '+route);
   }
   await p.screenshot({path:output+'/'+(room||'settings')+'-'+mode+'-'+width+'.png'});
  }
  await p.locator('[data-noa-display-settings]:visible').first().click();
  assert.equal(await p.locator('#noa-theme').inputValue(),mode,'theme survives navigation');
  await p.reload();
  await p.locator('[data-noa-display-settings]:visible').first().click();
  await p.locator('#noa-theme').waitFor();
  assert.equal(await p.locator('#noa-theme').inputValue(),mode,'theme survives reload');
 }
 await context.close();
}
 await verifyAutomaticClock();
 console.log('PREMIUM_THEMES_AUTOMATIC_BOUNDARIES_CONTRAST_LAYOUT_AND_RELOAD_OK');
}finally{
 writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
 await browser.close();
}

async function verifyAutomaticClock(){
 const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Asia/Seoul',serviceWorkers:'block'}),p=await context.newPage();
 const posts=[];p.on('request',r=>{if(r.url().includes('/ui-preferences.php')&&r.method()==='POST')posts.push(r.url());});
 if(phase==='candidate')for(const name of ['noa-design.json','noa-starlight.css','noa-ui.js'])await context.route('**/'+name+'*',r=>r.fulfill({body:readFileSync(source+'/deploy/'+name),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'application/json'}));
 await p.clock.install({time:new Date('2026-11-03T08:55:00+09:00')});
 await p.goto('https://noastudio.ai.kr/noa-login.php');
 await p.waitForFunction(()=>document.documentElement.dataset.noaThemePreference==='auto'&&document.documentElement.dataset.noaTheme==='noa-studio');
 await p.locator('[data-noa-display-settings]:visible').first().click();await p.locator('#noa-theme').waitFor();
 assert.equal(await p.locator('#noa-theme').inputValue(),'auto');
 await p.clock.pauseAt(new Date('2026-11-03T08:59:59+09:00'));
 await p.clock.runFor(1000);
 assert.equal(await p.locator('html').getAttribute('data-noa-theme'),'noa-ivory','09:00 changes an open page to light');
 assert.equal(await p.locator('#noa-theme').inputValue(),'auto');
 await p.clock.pauseAt(new Date('2026-11-03T20:59:59+09:00'));await p.clock.runFor(1000);
 assert.equal(await p.locator('html').getAttribute('data-noa-theme'),'noa-studio','21:00 changes an open page to dark');
 assert.equal(await p.locator('#noa-theme').inputValue(),'auto');
 await p.clock.resume();await p.locator('#noa-theme').selectOption('noa-ivory');
 await p.clock.pauseAt(new Date('2026-11-03T23:00:00+09:00'));
 assert.equal(await p.locator('html').getAttribute('data-noa-theme'),'noa-ivory','manual light remains after the automatic boundary');
 await p.clock.resume();await p.locator('#noa-theme').selectOption('auto');
 await p.screenshot({path:output+'/automatic-settings-390.png'});
 await p.reload();await p.locator('[data-noa-display-settings]:visible').first().click();await p.locator('#noa-theme').waitFor();
 assert.equal(await p.locator('#noa-theme').inputValue(),'auto','automatic preference survives reload');
 assert.equal(await p.locator('html').getAttribute('data-noa-theme'),'noa-studio');
 assert.deepEqual(posts,[],'clock changes never write account preferences');
 if(phase==='live'){
  const response=await context.request.get('https://noastudio.ai.kr/noa-bridge/ui-preferences.php');assert.equal(response.status(),200);
  const prefs=await response.json();assert.equal(prefs.defaults.theme,'auto');assert(prefs.defaults.enabled.includes('auto'));assert.equal(prefs.member,false);
 }
 console.log('AUTOMATIC_0900_2100_MANUAL_OVERRIDE_RELOAD_NO_ACCOUNT_WRITES_OK');await context.close();
}
