import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const source=process.env.NOA_SOURCE_ROOT||process.cwd();
const phase=process.env.NOA_THEME_PHASE||'live';
const output='room-theme-proof/'+phase;
const config=JSON.parse(readFileSync(source+'/deploy/noa-design.json','utf8'));
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync(output,{recursive:true});
const results=[];
try{for(const [width,height] of [[390,900],[768,900],[1280,1440],[1600,900]]){
 const context=await browser.newContext({viewport:{width,height},timezoneId:'Asia/Seoul',serviceWorkers:'block'}),p=await context.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(phase==='candidate')for(const name of ['noa-design.json','noa-starlight.css','noa-ui.js','noa-desktop.js']){
  await context.route('**/'+name+'*',route=>route.fulfill({body:readFileSync(source+'/deploy/'+name),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'application/json'}));
 }
 if(phase==='candidate')await context.route('**/noa-assets/theme-*.webp*',route=>{
  const name=new URL(route.request().url()).pathname.split('/').at(-1).replace(/^theme-/,'');
  return route.fulfill({body:readFileSync(source+'/public/noa-theme-scenes/'+name),contentType:'image/webp'});
 });
 if(phase==='candidate')await context.route('https://noastudio.ai.kr/',async route=>{
  const response=await route.fetch(),html=await response.text();
  const fragment=readFileSync(source+'/deploy/noa-app/home.php','utf8').match(/<!-- noa-theme-scene:start -->[\s\S]*?<!-- noa-theme-scene:end -->/)[0];
  let body=html.includes('<!-- noa-theme-scene:start -->')?html.replace(/<!-- noa-theme-scene:start -->[\s\S]*?<!-- noa-theme-scene:end -->/,fragment):html.replace('<section class="noa-hero" data-home-section="hero">',fragment+'<section class="noa-hero" data-home-section="hero">');
  const homeSource=readFileSync(source+'/deploy/noa-app/home.php','utf8');
  for(const id of ['noa-home-action-layout','noa-home-hero-size']){const tag=id==='noa-home-action-layout'?'style':'script';const pattern=new RegExp('<'+tag+' id="'+id+'">[\\s\\S]*?<\/'+tag+'>');body=body.replace(pattern,homeSource.match(pattern)[0]);}
  await route.fulfill({response,body});
 });
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
   if(room==='home'){assert(await p.locator('#noa-theme-scene').evaluate(el=>el.getBoundingClientRect().top>=0),'home theme introduction stays above the fold');assert.equal(await p.locator('#noa-theme-scene h2').innerText(),theme.concept.title);assert.doesNotMatch(await p.locator('#noa-theme-scene').innerText(),/\d{1,2}:\d{2}|12시/,'theme artwork does not imply a live clock');assert(await p.locator('#noa-theme-scene .noa-theme-cover').isVisible(),'theme landscape is visible');}
   if(room==='shop')await p.locator('.ec-grid .ec-card').first().waitFor();
   if(room==='community')await p.locator('.ec-write-invite').first().waitFor();
   if(mode==='noa-ivory')for(const primary of await p.locator('.ec-primary:visible').all()){
    const paint=await primary.evaluate(el=>({color:getComputedStyle(el).color,background:getComputedStyle(el).backgroundColor}));
    assert.deepEqual(paint,{color:'rgb(255, 255, 255)',background:'rgb(37, 103, 125)'},'primary control remains readable: '+route);
   }
   const photos=await p.locator('[data-noa-theme-image]').all();
   if(room==='home')assert(photos.length>=5,'home uses coast, story, benefit and promotional theme imagery');
   for(const photo of photos){
    const role=await photo.getAttribute('data-noa-theme-image');assert.equal(await photo.getAttribute('src'),theme.images[role],'image follows active palette');
    await photo.scrollIntoViewIfNeeded();await photo.evaluate(img=>img.decode());
    assert(await photo.evaluate(img=>img.naturalWidth>500),'real generated asset loaded');
   }
   if(room==='home'){
    assert.equal(await p.locator('#noa-hero-poster').getAttribute('data-noa-theme-image'),null,'artist posters stay original');
    assert.equal(await p.locator('[data-home-banner="goods"]>img').getAttribute('data-noa-theme-image'),null,'actual goods photography stays original');
    for(const [name,selector]of [['story','.noa-story-entrance'],['youtube','[data-home-banner="youtube"]'],['invite','#noa-referral-banner']]){
     const banner=p.locator(selector);if(await banner.count())await banner.screenshot({path:output+'/'+name+'-'+mode+'-'+width+'.png'});
    }
   }
   await p.evaluate(()=>scrollTo(0,0));
   await p.screenshot({path:output+'/'+(room||'settings')+'-'+mode+'-'+width+'.png'});
   if(room==='home')await verifyExpansiveShell(p,width,mode);
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
 console.log('EXPANSIVE_HEADER_DRAWER_SEARCH_FOCUS_AND_TALL_DESKTOP_LAYOUT_OK');
 console.log('PREMIUM_THEME_IMAGES_LOADED_MATCH_PALETTE_AND_PRESERVE_ARTIST_AND_PRODUCT_PHOTOS_OK');
 console.log('PREMIUM_THEMES_AUTOMATIC_BOUNDARIES_CONTRAST_LAYOUT_AND_RELOAD_OK');
}finally{
 writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
 await browser.close();
}

async function verifyAutomaticClock(){
 const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Asia/Seoul',serviceWorkers:'block'}),p=await context.newPage();
 const posts=[];p.on('request',r=>{if(r.url().includes('/ui-preferences.php')&&r.method()==='POST')posts.push(r.url());});
 if(phase==='candidate')for(const name of ['noa-design.json','noa-starlight.css','noa-ui.js','noa-desktop.js'])await context.route('**/'+name+'*',r=>r.fulfill({body:readFileSync(source+'/deploy/'+name),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'application/json'}));
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
 const legacy=await context.newPage();
 const legacyScript=execFileSync('git',['show','71b05701e8b74a908ad0ef4d942a943285e259f2:deploy/noa-ui.js'],{cwd:source});
 await legacy.route('**/noa-ui.js*',route=>route.fulfill({body:legacyScript,contentType:'text/javascript'}));
 await legacy.goto('https://noastudio.ai.kr/noa-login.php');
 await legacy.locator('[data-noa-display-settings]:visible').first().click();await legacy.locator('#noa-theme').waitFor();
 await legacy.locator('#noa-theme').selectOption('noa-studio');
 await p.waitForTimeout(150);
 assert.equal(await p.locator('#noa-theme').inputValue(),'auto','an older open tab cannot overwrite automatic preference');
 await legacy.close();
 assert.deepEqual(posts,[],'clock changes never write account preferences');
 if(phase==='live'){
  for(const theme of config.themes)for(const url of Object.values(theme.images)){
   const asset=await context.request.get('https://noastudio.ai.kr'+url);assert.equal(asset.status(),200);
   const name=url.split('/').at(-1).replace(/^theme-/,'');
   const expected=createHash('sha256').update(readFileSync(source+'/public/noa-theme-scenes/'+name)).digest('hex');
   assert.equal(createHash('sha256').update(await asset.body()).digest('hex'),expected,'deployed image matches the reviewed asset');
  }
  const response=await context.request.get('https://noastudio.ai.kr/noa-bridge/ui-preferences.php');assert.equal(response.status(),200);
  const prefs=await response.json();assert.equal(prefs.defaults.theme,'auto');assert(prefs.defaults.enabled.includes('auto'));assert.equal(prefs.member,false);
 }
 console.log('AUTOMATIC_0900_2100_MANUAL_OVERRIDE_RELOAD_OLD_TAB_COMPATIBILITY_NO_ACCOUNT_WRITES_OK');await context.close();
}

async function verifyExpansiveShell(p,width,mode){
 const geometry=await p.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};return {hero:box('.noa-hero'),media:box('.noa-hero-art'),copy:box('.noa-hero-copy'),scene:box('#noa-theme-scene'),notices:box('[data-home-section=notices]'),community:box('[data-home-section=community]'),rightDock:document.documentElement.hasAttribute('data-noa-desktop')};});
 assert(geometry.scene.x>=0&&geometry.scene.x<100,'content is no longer narrowed by a persistent sidebar');
 assert(!geometry.rightDock,'assistant remains floating instead of taking a permanent content column');
 if(width>=768){assert(geometry.hero.height<460,'portrait desktop must not turn the video into a tall square');assert(geometry.media.x<geometry.copy.x,'desktop has separate media and recommendation columns');}
 else{assert(Math.abs(geometry.media.width/geometry.media.height-16/9)<.03,'mobile media keeps a landscape frame');assert(geometry.copy.y>=geometry.media.bottom-1,'mobile text is below the media');}
 if(width>=960){assert(Math.abs(geometry.notices.y-geometry.community.y)<2,'news sections share a row');assert(geometry.community.x>geometry.notices.x,'news columns are side by side');}
 else assert(geometry.community.y>=geometry.notices.bottom-1,'mobile news sections follow reading order');
 const all=p.locator('#noa-nav-all'),drawer=p.locator('#noa-menu-drawer');assert.equal(await drawer.isVisible(),false);
 await all.click();await drawer.waitFor({state:'visible'});assert.equal(await all.getAttribute('aria-expanded'),'true');
 assert.equal(await drawer.evaluate(d=>d.matches(':modal')),true,'drawer makes the page behind it inert');
 await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('#noa-menu-drawer')),'focus stays inside menu');
 const search=p.locator('#noa-menu-search');await search.fill('공지');assert.equal(await drawer.locator('.noa-drawer-secondary a:visible').count(),1);assert.equal(await drawer.locator('.noa-drawer-secondary a:visible').innerText(),'공지사항');
 await search.fill('없는메뉴xyz');assert(await drawer.locator('.noa-menu-empty').isVisible());await search.fill('');
 assert.equal(await drawer.locator('.noa-menu a:visible').count(),5);assert.equal(await drawer.locator('[data-noa-nav=music]').getAttribute('aria-disabled'),'true','guest access rules stay in place');
 await drawer.screenshot({path:output+'/menu-'+mode+'-'+width+'.png'});
 await p.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});assert.equal(await all.getAttribute('aria-expanded'),'false');assert(await all.evaluate(a=>a===document.activeElement),'Escape returns focus to the invoking control');
 await all.click();await p.mouse.click(width-8,100);await drawer.waitFor({state:'hidden'});
 console.log('EXPANSIVE_GEOMETRY',JSON.stringify({width,mode,...geometry}));
}
