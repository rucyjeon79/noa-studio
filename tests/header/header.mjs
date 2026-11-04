import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const base='https://noastudio.ai.kr';mkdirSync('room-theme-proof/header',{recursive:true});
try{for(const [width,height]of [[320,900],[390,900],[768,900],[1600,900],[2300,900]]){
 const c=await browser.newContext({viewport:{width,height},timezoneId:'Asia/Seoul'});let requests=0;
 await c.addInitScript(()=>{window.__geoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success,error){window.__geoCalls++;if(window.__geoDenied)error({code:1});else success({coords:{latitude:35.1795543,longitude:129.0756416}});}}});});
 await c.route(base+'/**',async r=>{
  const u=new URL(r.request().url()),path=u.pathname;
  if(path==='/noa-bridge/weather.php'){requests++;assert.deepEqual(r.request().postDataJSON(),{latitude:35.18,longitude:129.08});return r.fulfill({json:{ok:true,temperature:13.6,condition:'맑음',location:'부산광역시 연제구',forecastAt:new Date().toISOString(),validUntil:new Date(Date.now()+900000).toISOString()}});}
  if(path==='/noa-bridge/membership.php')return r.fulfill({json:{ok:true,member:false}});
  if(path==='/noa-bridge/ui-preferences.php')return r.fulfill({json:{member:false,settings:null,revision:0,defaults:{enabled:['noa-studio','noa-ivory']}}});
  if(path.endsWith('.json')||path.endsWith('.js')||path.endsWith('.css')){try{return r.fulfill({body:readFileSync('deploy'+path),contentType:path.endsWith('.json')?'application/json':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});}catch{return r.fulfill({status:404,body:''});}}
  if(path.startsWith('/noa-assets/'))return r.fulfill({status:204,body:''});
  const native=path.startsWith('/shop/');return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="ko" class="'+(native?'ny-native':'')+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-account.css"><link rel="stylesheet" href="/noa-starlight.css"><link rel="stylesheet" href="/noa-youngcart-premium.css"><link rel="stylesheet" href="/noa-referral.css"><body class="'+(native?'ny-native-page':'noa-page')+'"><main><h1>NOA STUDIO</h1><p id="fixture-copy">지금, 나에게 맞는 음악</p><strong class="noa-card-heading">공지사항</strong><input id="fixture-input" value="찾기"></main><script src="/noa-page-progress.js" defer></script><script src="/noa-account.js"></script><script src="/noa-ui.js"></script></body></html>'});
 });
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/');await p.waitForFunction(()=>window.NoaUI?.getState());
 assert.equal(await p.evaluate(()=>window.__geoCalls),0,'no unsolicited location request');assert.equal(requests,0,'no weather call before location consent');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow');
 if(width<=760){
  const home=p.locator('.noa-mobile-nav [data-noa-nav=home]');
  for(const active of [false,true])for(const alert of [false,true]){
   await home.evaluate((el,[active,alert])=>{if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');el.classList.toggle('has-ainoa-alert',alert);},[active,alert]);
   const shape=await home.evaluate(el=>{const b=el.getBoundingClientRect();return [b.width,b.height,getComputedStyle(el).borderRadius];});
   assert.equal(shape[0],shape[1]);assert.equal(shape[2],'50%');
  }
 }

 assert(await p.locator('#noa-account-bar .noa-account-brand img').isVisible());assert(await p.locator('#noa-account-bar .noa-account-brand span').isVisible());
 const drawer=p.locator('#noa-menu-drawer'),trigger=p.locator('#noa-nav-all');
 const enter=async()=>{if(!await drawer.isVisible())await trigger.click();};
 const leave=async()=>{await p.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});};
 await enter();
 const choose=async code=>{await enter();await p.locator('#noa-header-language').click();await p.locator('#noa-language-options [data-language='+code+']').click();};
 for(const [code,find,heading] of [['en','Find','Music for you right now'],['ja','検索','今のあなたに合う音楽'],['th','ค้นหา','เพลงที่ใช่สำหรับคุณตอนนี้'],['ko','찾기','지금, 나에게 맞는 음악']]){
  await choose(code);assert.equal(await p.locator('html').getAttribute('lang'),code);assert.equal(await p.locator('#noa-drawer-search').count(),1);assert.equal(await p.locator('#fixture-copy').innerText(),heading);
  assert.equal(await p.locator('#noa-header-language svg').getAttribute('data-flag'),code);assert.equal(await p.locator('#noa-language-options button svg').count(),4);assert.equal(await p.locator('.noa-card-heading').innerText(),'공지사항');assert.equal(await p.locator('#fixture-input').inputValue(),'찾기');
 }
 await choose('en');await p.reload();await p.waitForFunction(()=>window.NoaUI?.getState());assert.equal(await p.locator('#noa-header-language').getAttribute('data-language'),'en');assert.equal(await p.locator('#fixture-copy').innerText(),'Music for you right now');
 await p.evaluate(()=>{const label=document.createElement('button');label.id='late-copy';label.textContent='찾기';document.querySelector('main').append(label);});await p.waitForFunction(()=>document.getElementById('late-copy').textContent==='Find');
 await choose('ko');assert.equal(await p.locator('#late-copy').innerText(),'찾기');
 assert.equal(await p.locator('#noa-header-clock').isVisible(),width>760);assert.equal(await p.locator('#noa-header-weather').isVisible(),width>760);
 if(width<=760){assert((await p.locator('#noa-account-bar').boundingBox()).height<=58);assert.equal(requests,0);}
 if(width>760){await p.locator('#noa-header-weather').click();await p.locator('[data-weather-locate]').click();try{await p.waitForFunction(()=>document.querySelector('#noa-header-weather').textContent.includes('14°'),null,{timeout:20000});}catch(e){console.log('HEADER_WEATHER_DIAGNOSTIC',JSON.stringify({requests,errors,ui:await p.evaluate(()=>({geoCalls:window.__geoCalls,weather:document.querySelector('#noa-header-weather').outerHTML,status:document.querySelector('[data-weather-status]')?.textContent,now:new Date().toISOString()}))}));await p.screenshot({path:'room-theme-proof/header/weather-failure-'+width+'.png'});throw e;}
 assert.equal(requests,1);assert.match(await p.locator('#noa-header-weather').innerText(),/부산광역시 연제구/);await p.getByRole('button',{name:'날씨 닫기',exact:true}).click();
 await p.reload();await p.waitForFunction(()=>window.NoaUI?.getState());await enter();assert.match(await p.locator('#noa-header-weather').innerText(),/부산광역시/);assert.equal(requests,1,'weather is reused within its short lifetime');
 await p.locator('#noa-header-weather').click();await p.evaluate(()=>{window.__geoDenied=true;});await p.locator('[data-weather-locate]').click();await p.getByText('위치 사용이 꺼져 있어요.',{exact:false}).waitFor();assert.equal(requests,1);assert.match(await p.locator('#noa-header-weather').innerText(),/내 위치/);await p.getByRole('button',{name:'날씨 닫기',exact:true}).click();
 }
 await enter();const search=p.locator('#noa-drawer-search');await search.fill('공지');assert.equal(await drawer.locator('.noa-drawer-secondary a:visible').count(),1);await search.fill('없는메뉴xyz');assert(await drawer.locator('.noa-menu-empty').isVisible());await search.fill('');
 const pinned=width>=1200,frame=await drawer.boundingBox();
 if(pinned){
  assert(!await drawer.evaluate(d=>d.matches(':modal')));assert(Math.abs(frame.x-Math.max(0,(width-height*16/9)/2))<=1);assert(frame.width>=220&&frame.width<300);
  await p.keyboard.press('Escape');assert(await drawer.isVisible());
 }else{
  assert(Math.abs(frame.width-width*.7)<=1&&Math.abs(frame.x)<=1);assert(await p.locator('#noa-account-bar').evaluate(e=>e.getBoundingClientRect().bottom<=1));
  assert.equal(await drawer.evaluate(e=>getComputedStyle(e).animationDuration),'1s');await p.mouse.click(width-4,120);await drawer.waitFor({state:'hidden'});assert(await trigger.evaluate(el=>el===document.activeElement));
 }
 await p.locator('[data-footer-theme=noa-ivory]').click();assert.equal(await p.locator('dialog:modal').count(),0);assert.equal(await p.locator('html').getAttribute('data-noa-theme'),'noa-ivory');
 await p.screenshot({path:'room-theme-proof/header/header-light-'+width+'.png'});await p.locator('[data-footer-theme=noa-studio]').click();assert.equal(await p.locator('dialog:modal').count(),0);assert.equal(await p.locator('html').getAttribute('data-noa-theme'),'noa-studio');await p.screenshot({path:'room-theme-proof/header/header-dark-'+width+'.png'});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.goto(base+'/shop/cart.php');await p.waitForFunction(()=>window.NoaUI?.getState());const bounds=await p.locator('#noa-account-bar').boundingBox();const edge=Math.max(0,(width-height*16/9)/2),rail=pinned?frame.width:0;assert(Math.abs(bounds.x-edge-rail)<=1);assert(Math.abs(bounds.width+rail+2*edge-width)<=2);
 const line=p.locator('#noa-page-progress');await p.evaluate(()=>{document.body.style.minHeight='360vh';scrollTo(0,document.documentElement.scrollHeight);});await p.waitForFunction(()=>document.getElementById('noa-page-progress').getAttribute('aria-valuenow')==='100');
 await p.evaluate(()=>{const dock=document.createElement('div');dock.id='jukebox-transfer-dock';dock.innerHTML='<progress max="100" value="37"></progress>';document.body.append(dock);});
 await p.waitForFunction(()=>document.getElementById('noa-page-progress').dataset.mode==='task');assert.equal(await line.getAttribute('aria-valuenow'),'37');
 await p.evaluate(()=>document.getElementById('jukebox-transfer-dock').remove());await p.waitForFunction(()=>document.getElementById('noa-page-progress').dataset.mode==='scroll');
 assert.deepEqual(errors,[]);await c.close();console.log('HEADER_LANGUAGE_WEATHER_SEARCH_THEME_OK',width);
}}finally{await browser.close();}
