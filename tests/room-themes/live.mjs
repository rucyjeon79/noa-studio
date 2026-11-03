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
try{for(const sizes of [[[320,720],[390,900],[768,900]],[[1280,1440],[1600,900]]])await Promise.all(sizes.map(async([width,height])=>{
 const context=await browser.newContext({viewport:{width,height},timezoneId:'Asia/Seoul',serviceWorkers:'block'}),p=await context.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(phase==='candidate')for(const name of ['noa-account.js','noa-design.json','noa-starlight.css','noa-ui.js','noa-home.js','noa-desktop.js','noa-voice.js','noa-ainoa.css','noa-amt-fan.js','noa-amt-fan.css']){
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
 if(phase==='candidate')await context.route('https://noastudio.ai.kr/noa-vip.php',async route=>{
  const response=await route.fetch();let body=await response.text();
  const catalog=JSON.parse(body.match(/<script[^>]*id="vip-catalog"[^>]*>([\s\S]*?)<\/script>/)[1]);
  body=body.replace(/(STARLIGHT|CREATOR) \/ LV[.]\d+/g,(_,name)=>name+' / LV.'+Object.values(catalog).find(p=>p.plan===(name==='STARLIGHT'?'vip':'creator')).paidLevel);
  await route.fulfill({response,body});
 });
 if(phase==='candidate')await context.route('https://noastudio.ai.kr/shop/cart.php',async route=>{
  const response=await route.fetch();let body=await response.text();
  // Mirror the newly shared native commerce assets without touching cart data or handlers.
  if(!body.includes('src="/noa-ui.js'))body=body.replace('</head>','<script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script><link rel="stylesheet" href="/noa-starlight.css"></head>');
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
  for(const [route,room] of [['/','home'],['/noa-lounge.php','community'],['/noa-shop.php','shop'],['/noa-vip.php','shop'],['/noa-points.php','shop'],['/noa-settings.php',''],['/noa-sitemap.php',''],['/noa-about.php',''],['/noa-login.php',''],['/noa-install.php',''],['/shop/cart.php','shop']].filter(([route])=>process.env.NOA_VISUAL_REVIEW!=='true'||route==='/')){
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
    return {bg:style.getPropertyValue('--noa-bg').trim().toLowerCase(),shared:style.getPropertyValue('--noa-darkGray').trim().toLowerCase(),scheme:style.colorScheme,overflow:root.scrollWidth-innerWidth,text:(document.querySelector('main')||document.querySelector('#container'))?.innerText.length||0};
   });
   results.push({width,mode,route,...metrics});console.log(JSON.stringify(results.at(-1)));
   assert.equal(metrics.bg,theme.tokens.bg.toLowerCase());
   assert.equal(metrics.shared,'#30343b');
   assert.equal(metrics.scheme,mode==='noa-ivory'?'light':'dark');
   assert(metrics.overflow<=1,JSON.stringify(results.at(-1)));
   assert(metrics.text>20,'visible content: '+route);
   if(width>=1200&&width>height){
    assert(await p.locator('#noa-menu-drawer').isVisible(),'left menu is always visible: '+route);
    assert(await p.evaluate(()=>{const host=document.querySelector('main')||document.querySelector('#container');return host.getBoundingClientRect().left>=220;}),'content clears pinned navigation: '+route);
   }
   await verifyHeader(p,width,height);
   if(route==='/noa-login.php'){
    const providers=await p.locator('.noa-social-provider').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {radius:s.borderRadius,x:r.x,width:r.width,height:r.height,overflow:el.scrollWidth-el.clientWidth};}));
    assert(providers.length>=2,'existing social login providers remain available');
    for(const provider of providers){assert.equal(provider.radius,'4px','provider controls share the page corner radius');assert(provider.height>=44&&provider.overflow<=1,'provider label and touch area fit');assert(Math.abs(provider.x-providers[0].x)<1&&Math.abs(provider.width-providers[0].width)<1,'provider controls align');}
   }
   if(route==='/shop/cart.php')assert(await p.locator('.ny-native-nav').isVisible(),'native store/order navigation is preserved');
   assert.deepEqual(errors,[],'uncaught browser errors: '+route);
   const selected=p.locator('#noa-section-navigation a[aria-current=page]');
   if(mode==='noa-ivory'&&await selected.count())assert.equal(await selected.evaluate(el=>getComputedStyle(el).color),'rgb(255, 255, 255)','active section label remains readable: '+route);
   if(room==='home'){assert(await p.locator('.noa-hero').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.top<innerHeight/2;}),'original hero is visible first below the header');assert.equal(await p.locator('#noa-theme-scene h2').innerText(),theme.concept.title);assert.doesNotMatch(await p.locator('#noa-theme-scene').innerText(),/\d{1,2}:\d{2}|12시/,'theme artwork does not imply a live clock');assert(await p.locator('#noa-theme-scene .noa-theme-cover').isVisible(),'theme landscape is visible');}
   if(route==='/noa-shop.php')await p.locator('.ec-grid .ec-card').first().waitFor();
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
   if(route==='/noa-about.php'){
    assert.equal(await p.locator('.ne-hero>img').getAttribute('src'),theme.images.music,'studio introduction follows the active scene');
    assert.equal(await p.locator('.ne-masthead').isVisible(),false,'one global brand header');
    assert(await p.locator(width>=1200&&width>height?'#noa-menu-drawer .noa-logo':'#noa-account-bar .noa-account-brand').isVisible());
    assert.deepEqual(await p.locator('.ne-artist img').evaluateAll(images=>images.map(img=>img.getAttribute('src'))),['/noa-assets/editorial-noa-portrait.webp','/noa-assets/editorial-noel-portrait.webp'],'artist portraits remain original');
   }
   await p.screenshot({path:output+'/'+(route==='/'?'home':route.replace('/noa-','').replace('.php',''))+'-'+mode+'-'+width+'.png'});
   if(route==='/noa-vip.php'||route==='/noa-points.php'){
    assert.equal(await p.locator('.nv-store-nav:visible').count(),0,'one store navigation row');
    assert(await p.locator('.np-header').evaluate(el=>getComputedStyle(el,'::before').backgroundImage.includes('theme-')),'store heading has day/night scenery');
    await p.locator('.np-pack-art img').first().waitFor();
    assert(await p.locator('.np-pack-art img').count()>0,'original product artwork remains present after the catalog loads');
   }
   if(route==='/noa-vip.php'){
    const catalog=JSON.parse(await p.locator('#vip-catalog').textContent());
    for(const product of Object.values(catalog))assert((await p.locator('[data-product="'+product.id+'"] .np-edition').innerText()).endsWith('LV.'+product.paidLevel),'displayed membership level matches the existing catalog');
   }
   if(route==='/noa-settings.php'||route==='/noa-sitemap.php')assert(await p.locator('.noa-room-heading h1').isVisible(),'internal introduction is framed');
   if(route==='/noa-sitemap.php'){
    assert.equal(await p.locator('#noa-menu-search').count(),1,'directory and drawer searches have independent IDs');
    await p.locator('#noa-menu-search').fill('포인트');assert(await p.locator('.noa-site-map-link:visible').count()>0);await p.locator('#noa-menu-search').fill('');
   }
   if(room==='home'){await verifyMusicShelves(p,width,mode,theme);await verifyExpansiveShell(p,width,mode);await verifyUtilityActions(p,width,mode);}
  }
  await p.locator('[data-noa-display-settings]:visible').first().click();
  assert.equal(await p.locator('#noa-theme').inputValue(),mode,'theme survives navigation');
  await p.reload();
  await p.locator('[data-noa-display-settings]:visible').first().click();
  await p.locator('#noa-theme').waitFor();
  assert.equal(await p.locator('#noa-theme').inputValue(),mode,'theme survives reload');
 }
 await context.close();
}));
 await verifyAutomaticClock();
 console.log('PINNED_LANDSCAPE_MENU_COMPACT_MODAL_SEARCH_RESIZE_FOCUS_AND_TALL_DESKTOP_LAYOUT_OK');
 console.log('PREMIUM_THEME_IMAGES_LOADED_MATCH_PALETTE_AND_PRESERVE_ARTIST_AND_PRODUCT_PHOTOS_OK');
 console.log('PREMIUM_THEMES_AUTOMATIC_BOUNDARIES_CONTRAST_LAYOUT_AND_RELOAD_OK');
}catch(e){
 console.error('PUBLIC_THEME_CHECK_FAILED',e);
 let pageIndex=0;
 for(const c of browser.contexts())for(const p of c.pages()){
  const failure=output+'/failure-'+pageIndex++;
  try{await p.screenshot({path:failure+'.png',fullPage:true,timeout:10000});}catch(proofError){console.error('Failure screenshot unavailable:',proofError.message);}
  try{writeFileSync(failure+'.html',await p.content());}catch(proofError){console.error('Failure HTML unavailable:',proofError.message);}
 }
 throw e;
}finally{
 writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
 await browser.close();
}

async function verifyAutomaticClock(){
 const context=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Asia/Seoul',serviceWorkers:'block'}),p=await context.newPage();
 const posts=[];p.on('request',r=>{if(r.url().includes('/ui-preferences.php')&&r.method()==='POST')posts.push(r.url());});
 if(phase==='candidate')for(const name of ['noa-account.js','noa-design.json','noa-starlight.css','noa-ui.js','noa-home.js','noa-desktop.js'])await context.route('**/'+name+'*',r=>r.fulfill({body:readFileSync(source+'/deploy/'+name),contentType:name.endsWith('.css')?'text/css':name.endsWith('.js')?'text/javascript':'application/json'}));
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

async function verifyMusicShelves(p,width,mode,theme){
 await p.waitForFunction(()=>document.body.dataset.noaHomeReady==='true'&&[...document.querySelectorAll('.noa-home-shelf')].length===5&&[...document.querySelectorAll('.noa-home-shelf>.noa-card-grid')].every(g=>g.querySelectorAll('.noa-music-card').length<=4));
 await p.locator('#noa-home-community .noa-feed-invite').waitFor();
 const layout=await p.evaluate(()=>{
  const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};
  return [...document.querySelectorAll('.noa-home-shelf')].map(s=>({key:s.dataset.homeSection,...box(s),grid:box(s.querySelector('.noa-card-grid')),columns:Number(s.querySelector('.noa-card-grid').dataset.noaColumns),cards:[...s.querySelectorAll('.noa-music-card')].map(a=>({key:a.dataset.video,...box(a),art:box(a.querySelector('.noa-art')),title:box(a.querySelector('.noa-card-heading'))})),pager:s.querySelector('.noa-home-pages:not([hidden])')?box(s.querySelector('.noa-home-pages')):null}));
 });
 for(const shelf of layout){
  assert.equal(shelf.cards.length,4,'each populated home shelf starts with four actual tracks: '+shelf.key);
  assert.equal(shelf.columns,shelf.key==='recommendations'&&width>=960?4:2,'shelf column count matches its content width');
  for(const card of shelf.cards){assert(Math.abs(card.art.width/card.art.height-16/9)<.03,'song art keeps landscape proportions');assert(Math.abs(card.title.height-44)<1,'two title lines have a stable baseline');}
 }
 if(width>=960)for(const pair of [['ep','stories'],['covers','playlists']]){
  const [left,right]=pair.map(key=>layout.find(s=>s.key===key));
  assert(Math.abs(left.y-right.y)<2,'paired headings align: '+pair);
  assert(Math.abs(left.grid.y-right.grid.y)<2,'paired artwork starts on the same line: '+pair);
  assert(Math.abs(left.bottom-right.bottom)<2,'paired shelves finish on the same line: '+pair);
  if(left.pager&&right.pager)assert(Math.abs(left.pager.y-right.pager.y)<2,'paired page controls align: '+pair);
 }
 const placements=await p.locator('.noa-main').evaluate(main=>{
  const hero=main.querySelector('[data-home-section=hero]'),scene=main.querySelector('#noa-theme-scene'),notice=main.querySelector('[data-home-section=notices]'),goods=main.querySelector('[data-home-banner=goods]'),youtube=main.querySelector('[data-home-banner=youtube]'),benefits=main.querySelector('.noa-monthly-benefits'),referral=main.querySelector('#noa-referral-banner');
  const box=el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,bottom:r.bottom};};
  return {heroFirst:[...main.children].find(e=>e.getBoundingClientRect().height>0)===hero,sceneAfterReferral:referral.nextElementSibling===scene,benefitsAfterScene:scene.nextElementSibling===benefits,referralAfter:hero.nextElementSibling===referral,goodsBelowNotice:goods.parentElement===notice&&goods.previousElementSibling===notice.querySelector('.noa-notice-list'),youtubeBefore:youtube.nextElementSibling?.dataset.homeSection==='collections',hero:box(hero),scene:box(scene),benefits:box(benefits),referral:box(referral),goods:box(goods),notice:box(notice.querySelector('.noa-notice-list')),youtube:box(youtube),collections:box(main.querySelector('[data-home-section=collections]'))};
 });
 for(const key of ['heroFirst','referralAfter','sceneAfterReferral','benefitsAfterScene','goodsBelowNotice','youtubeBefore'])assert(placements[key],JSON.stringify({width,mode,key,placements}));
 for(const [above,below]of [['hero','referral'],['referral','scene'],['scene','benefits'],['notice','goods'],['youtube','collections']]){assert(placements[below].y>=placements[above].bottom+15,'requested banners have a clear vertical gap: '+above+' / '+below);assert(Math.abs(placements[below].x-placements[above].x)<2,'moved banner shares its section left edge: '+below);assert(Math.abs(placements[below].width-placements[above].width)<2,'moved banner shares its section width: '+below);}
 for(const selector of ['.noa-monthly-benefits','#noa-referral-banner','[data-home-banner=goods]','[data-home-banner=youtube]'])assert.equal(await p.locator(selector).count(),1,'existing banner moved without duplication');
 console.log('HOME_BANNER_POSITIONS_VERIFIED',JSON.stringify({width,mode,placements}));
 const banner=p.locator('#noa-home-community .noa-feed-invite');
 const paint=await banner.evaluate(el=>({image:getComputedStyle(el,'::before').backgroundImage,radius:getComputedStyle(el).borderRadius,color:getComputedStyle(el.querySelector('strong')).color}));
 assert(paint.image.includes(theme.images.journey),'late-loading community invitation follows the selected day/night scenery');
 assert.equal(paint.radius,'4px');
 const hex=theme.tokens.text.replace('#','');assert.equal(paint.color,'rgb('+[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16)).join(', ')+')','invitation heading uses the readable theme text');
 await banner.screenshot({path:output+'/community-invite-'+mode+'-'+width+'.png'});
 const featured=p.locator('[data-home-section=recommendations]');
 await featured.screenshot({path:output+'/music-discovery-'+mode+'-'+width+'.png'});
 if(width>=960){await p.locator('[data-home-section=ep]').scrollIntoViewIfNeeded();await p.screenshot({path:output+'/music-pair-'+mode+'-'+width+'.png'});}
 if(width===390||width===1600){
  const ids=()=>featured.locator('.noa-music-card').evaluateAll(cards=>cards.map(c=>c.dataset.video));
  const first=await ids();await featured.getByRole('button',{name:'다음',exact:true}).click();
  const second=await ids();assert(second.length>0&&second.length<=4);assert(second.every(id=>!first.includes(id)),'next page exposes different real tracks');
  await featured.getByRole('button',{name:'이전',exact:true}).click();assert.deepEqual(await ids(),first,'previous page restores the same tracks');
 }
 console.log('MUSIC_SHELVES_AND_THEME_INVITATION',JSON.stringify({width,mode,layout,paint}));
 await p.evaluate(()=>scrollTo(0,0));
}

async function verifyExpansiveShell(p,width,mode){
 const pinned=await p.locator('html').evaluate(el=>el.classList.contains('noa-menu-pinned'));
 assert(await p.locator(pinned?'#noa-menu-drawer .noa-logo':'#noa-account-bar .noa-account-brand').isVisible(),'studio identity remains visible');
 const geometry=await p.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom};};return {hero:box('.noa-hero'),media:box('.noa-hero-art'),copy:box('.noa-hero-copy'),scene:box('#noa-theme-scene'),notices:box('[data-home-section=notices]'),community:box('[data-home-section=community]'),rightDock:document.documentElement.hasAttribute('data-noa-desktop')};});
 assert(geometry.scene.x>=(pinned?220:0)&&geometry.scene.x<(pinned?320:100),'content clears the pinned navigation at wide landscape sizes');
 assert(!geometry.rightDock,'assistant remains floating instead of taking a permanent content column');
 if(width>=768){assert(geometry.hero.height>=480&&geometry.hero.height<=620,'artist film has a bounded cinematic height');assert(Math.abs(geometry.media.width/geometry.media.height-9/16)<.01,'desktop film keeps its original portrait frame');assert(geometry.copy.x>=geometry.media.x+geometry.media.width-1,'recommendations have their own space beside the film');assert(geometry.copy.bottom<=geometry.media.bottom+1,'copy stays within the feature');assert(geometry.scene.height<300,'theme welcome remains secondary to the original film');}
 else{assert(Math.abs(geometry.media.width/geometry.media.height-9/16)<.03,'mobile retains the complete portrait film');assert(geometry.copy.y>=geometry.media.bottom-1,'mobile text is below the media');}
 if(width>=960){assert(await p.locator('.noa-home-quickstart').isVisible(),'short notices share the card with real studio shortcuts');assert(Math.abs(geometry.notices.y-geometry.community.y)<2,'news sections share a row');assert(geometry.community.x>geometry.notices.x,'news columns are side by side');}
 else assert(geometry.community.y>=geometry.notices.bottom-1,'mobile news sections follow reading order');
 assert.equal(await p.locator('.noa-hero').evaluate(h=>h.nextElementSibling.id),'noa-referral-banner','500P invitation immediately follows the hero');
 assert.equal(await p.locator('#noa-hero-video').evaluate(v=>getComputedStyle(v).objectFit),'contain','original portrait film is never cropped to a landscape strip');
 assert.equal(await p.locator('#noa-hero-poster').evaluate(v=>getComputedStyle(v).objectFit),'contain','fallback poster retains the full original frame');
 assert.equal(await p.locator('.noa-feed-row.noa-action').count(),0,'feed rows remain semantic content instead of centered action buttons');
 for(const row of await p.locator('.noa-feed-row:visible').all())assert(await row.evaluate(e=>{const left=e.getBoundingClientRect().left;return [...e.children].every(n=>Math.abs(n.getBoundingClientRect().left-left)<2); }),'feed tag, title and author share the same left edge');
 if(width<768)assert(await p.locator('.noa-hero-intro').evaluate(e=>Math.abs(e.getBoundingClientRect().left-e.parentElement.getBoundingClientRect().left-20)<2),'mobile introduction keeps the left content edge');

 const all=p.locator('#noa-nav-all'),drawer=p.locator('#noa-menu-drawer');assert.equal(await drawer.isVisible(),pinned);
 if(pinned){assert.equal(await drawer.locator('.noa-drawer-secondary').isVisible(),false,'wide rail starts with only the five main destinations');assert.equal(await drawer.locator('.noa-drawer-search').isVisible(),false,'search does not clutter the default rail');assert.equal(await drawer.locator('.noa-drawer-profile').isVisible(),false,'header already provides account access');assert(await drawer.locator('.noa-sidebar-visitors').isVisible(),'original visitor information remains in the rail');}
 await all.click();await drawer.waitFor({state:'visible'});assert.equal(await all.getAttribute('aria-expanded'),'true');
 assert.equal(await drawer.evaluate(d=>d.matches(':modal')),!pinned,'only the compact drawer makes the page behind it inert');
 if(!pinned){await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('#noa-menu-drawer')),'focus stays inside modal menu');}
 const search=p.locator('#noa-drawer-search');await search.fill('공지');assert.equal(await drawer.locator('.noa-drawer-secondary a:visible').count(),1);assert.equal(await drawer.locator('.noa-drawer-secondary a:visible').innerText(),'공지사항');
 await search.fill('없는메뉴xyz');assert(await drawer.locator('.noa-menu-empty').isVisible());await search.fill('');
 assert.equal(await drawer.locator('.noa-menu a:visible').count(),5);assert.equal(await drawer.locator('[data-noa-nav=music]').getAttribute('aria-disabled'),'true','guest access rules stay in place');
 await drawer.screenshot({path:output+'/menu-'+mode+'-'+width+'.png'});
 if(pinned){
  await p.keyboard.press('Escape');assert(await drawer.isVisible(),'pinned menu remains open');assert.equal(await drawer.locator('.noa-drawer-secondary').isVisible(),false,'Escape folds details without hiding the rail');assert.equal(await all.getAttribute('aria-expanded'),'false');
  await p.locator('[data-home-section=recommendations] .noa-discovery-tabs button').first().click();
  const before=await drawer.boundingBox();await p.evaluate(()=>scrollTo(0,600));const after=await drawer.boundingBox();assert.equal(after.x,0);assert.equal(after.y,before.y,'left menu stays attached while the page scrolls');await p.evaluate(()=>scrollTo(0,0));
  await p.setViewportSize({width:390,height:900});await drawer.waitFor({state:'hidden'});await all.click();await search.fill('공지');
  await p.setViewportSize({width,height:900});await p.waitForFunction(()=>document.documentElement.classList.contains('noa-menu-pinned'));
  assert.equal(await drawer.evaluate(d=>d.matches(':modal')),false,'resize removes the modal backdrop');assert.equal(await search.inputValue(),'공지','search survives resizing');await search.fill('');await drawer.locator('.noa-drawer-expand').click();assert.equal(await drawer.locator('.noa-drawer-secondary').isVisible(),false,'rail returns to the original five destinations');
  await p.locator('[data-home-section=recommendations] .noa-discovery-tabs button').first().click();
 }else{
  await p.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});await p.waitForFunction(()=>document.getElementById('noa-nav-all')?.getAttribute('aria-expanded')==='false');assert.equal(await all.getAttribute('aria-expanded'),'false');assert(await all.evaluate(a=>a===document.activeElement),'Escape returns focus to the invoking control');
  await all.click();await p.mouse.click(width-8,100);await drawer.waitFor({state:'hidden'});
 }
 console.log('EXPANSIVE_GEOMETRY',JSON.stringify({width,mode,...geometry}));
}


async function verifyHeader(p,width,height){
 const state=await p.evaluate(()=>{
  const bar=document.querySelector('#noa-account-bar'),rect=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id:e.id,x:r.x,y:r.y,width:r.width,height:r.height,radius:s.borderRadius,text:e.textContent.trim(),display:s.display};};
  return {bar:rect(bar),actions:[...bar.querySelector('.noa-account-utilities').children].map(rect),overflow:bar.scrollWidth-bar.clientWidth};
 });
 assert.deepEqual(state.actions.map(a=>a.id),['noa-nav-back','noa-nav-top','noa-referral-share','noa-nav-install'],'same four real actions on every page');
 assert.deepEqual(state.actions.map(a=>a.text),['이전','맨 위','공유','앱 설치']);
 assert(state.overflow<=1,JSON.stringify(state));
 for(const [i,a] of state.actions.entries()){
  assert(a.width>=44&&a.height>=44&&a.x>=state.bar.x&&a.x+a.width<=width+1&&a.y>=state.bar.y&&a.y+a.height<=state.bar.y+state.bar.height+1,JSON.stringify(a));
  assert.equal(a.radius,'4px');
  assert(Math.abs(a.y-state.actions[0].y)<1,'utility buttons share one baseline');
  if(i)assert(a.x>=state.actions[i-1].x+state.actions[i-1].width+3,'utility touch areas do not overlap');
 }
 if(!(width>=1200&&width>height))assert(Math.max(...state.actions.map(a=>a.width))-Math.min(...state.actions.map(a=>a.width))<1,'compact utilities have equal width');
 assert.equal(await p.locator('#noa-nav-install').getAttribute('href'),'/noa-install.php');
 assert.equal(await p.locator('#noa-menu-find').isVisible(),false,'menu search stays inside the drawer');
 if(!(width>=1200&&width>height)){const brand=p.locator('#noa-account-bar .noa-account-brand');assert(await brand.locator('span').isVisible());assert(await brand.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'brand is not squeezed by utilities');}
}
async function verifyUtilityActions(p,width,mode){
 await p.evaluate(()=>scrollTo(0,1200));await p.locator('#noa-nav-top').click();await p.waitForFunction(()=>scrollY===0);
 await p.locator('#noa-referral-share').click();const dialog=p.locator('#noa-referral-dialog');await dialog.waitFor();
 await dialog.locator('.nrf-primary').waitFor();
 const colors=await dialog.evaluate(d=>({bg:getComputedStyle(d).backgroundColor,surface:getComputedStyle(document.documentElement).getPropertyValue('--noa-surface').trim(),radius:getComputedStyle(d).borderRadius,overflow:d.scrollWidth-d.clientWidth}));
 assert.equal(colors.radius,'4px');assert(colors.overflow<=1);assert.equal(colors.bg,mode==='noa-ivory'?'rgb(245, 246, 248)':'rgb(25, 34, 47)');
 await p.screenshot({path:output+'/share-'+mode+'-'+width+'.png'});
 await dialog.locator('.nrf-close').click();await dialog.waitFor({state:'detached'});
 await p.locator('#noa-nav-install').click();await p.waitForURL('**/noa-install.php');await p.locator('[data-noa-install-page]').waitFor();
 await p.locator('#noa-nav-back').click();await p.waitForURL('https://noastudio.ai.kr/');
 await p.waitForFunction(()=>document.querySelector('.noa-main')?.firstElementChild?.dataset.homeSection==='hero');
 console.log('VISIBLE_UTILITIES_CLICK_TOP_SHARE_INSTALL_BACK_OK',JSON.stringify({width,mode,colors}));
}
