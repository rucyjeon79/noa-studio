import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const base='https://noastudio.ai.kr';mkdirSync('room-theme-proof/header',{recursive:true});
try{for(const [width,height]of [[320,900],[390,900],[768,900],[1600,900]]){
 const c=await browser.newContext({viewport:{width,height},timezoneId:'Asia/Seoul'});let requests=0;
 await c.addInitScript(()=>{window.__geoCalls=0;Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success,error){window.__geoCalls++;if(window.__geoDenied)error({code:1});else success({coords:{latitude:35.1795543,longitude:129.0756416}});}}});});
 await c.route(base+'/**',async r=>{
  const u=new URL(r.request().url()),path=u.pathname;
  if(path==='/noa-bridge/weather.php'){requests++;assert.deepEqual(r.request().postDataJSON(),{latitude:35.18,longitude:129.08});return r.fulfill({json:{ok:true,temperature:13.6,condition:'맑음',location:'부산광역시 연제구',forecastAt:new Date().toISOString(),validUntil:new Date(Date.now()+900000).toISOString()}});}
  if(path==='/noa-bridge/membership.php')return r.fulfill({json:{ok:true,member:false}});
  if(path==='/noa-bridge/ui-preferences.php')return r.fulfill({json:{member:false,settings:null,revision:0,defaults:{enabled:['noa-studio','noa-ivory']}}});
  if(path.endsWith('.json')||path.endsWith('.js')||path.endsWith('.css')){try{return r.fulfill({body:readFileSync('deploy'+path),contentType:path.endsWith('.json')?'application/json':path.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'});}catch{return r.fulfill({status:404,body:''});}}
  if(path.startsWith('/noa-assets/'))return r.fulfill({status:204,body:''});
  return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-account.css"><link rel="stylesheet" href="/noa-starlight.css"><body class="noa-page"><main><h1>NOA STUDIO</h1></main><script src="/noa-account.js"></script><script src="/noa-ui.js"></script></body></html>'});
 });
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/');await p.waitForFunction(()=>window.NoaUI?.getState());
 assert.equal(await p.evaluate(()=>window.__geoCalls),0,'no unsolicited location request');assert.equal(requests,0,'no weather call before location consent');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no overflow');
 await p.locator('#noa-header-language').selectOption('en');assert.equal(await p.locator('html').getAttribute('lang'),'en');await p.reload();await p.waitForFunction(()=>window.NoaUI?.getState());assert.equal(await p.locator('#noa-header-language').inputValue(),'en','language selection survives reload');
 await p.locator('#noa-header-language').selectOption('ko');await p.locator('#noa-header-weather').click();await p.locator('[data-weather-locate]').click();try{await p.waitForFunction(()=>document.querySelector('#noa-header-weather').textContent.includes('14°'),null,{timeout:20000});}catch(e){console.log('HEADER_WEATHER_DIAGNOSTIC',JSON.stringify({requests,errors,ui:await p.evaluate(()=>({geoCalls:window.__geoCalls,weather:document.querySelector('#noa-header-weather').outerHTML,status:document.querySelector('[data-weather-status]')?.textContent,now:new Date().toISOString()}))}));await p.screenshot({path:'room-theme-proof/header/weather-failure-'+width+'.png'});throw e;}
 assert.equal(requests,1);assert.match(await p.locator('#noa-header-weather').innerText(),/부산광역시 연제구/);await p.getByRole('button',{name:'날씨 닫기',exact:true}).click();
 await p.reload();await p.waitForFunction(()=>window.NoaUI?.getState());assert.match(await p.locator('#noa-header-weather').innerText(),/부산광역시/);assert.equal(requests,1,'weather is reused within its short lifetime');
 await p.locator('#noa-header-weather').click();await p.evaluate(()=>{window.__geoDenied=true;});await p.locator('[data-weather-locate]').click();await p.getByText('위치 사용이 꺼져 있어요.',{exact:false}).waitFor();assert.equal(requests,1);assert.match(await p.locator('#noa-header-weather').innerText(),/내 위치/);await p.getByRole('button',{name:'날씨 닫기',exact:true}).click();
 await p.locator('#noa-menu-find').click();await p.locator('#noa-global-search').fill('공지');assert.equal(await p.locator('#noa-find-dialog nav>a:visible').count(),1);await p.getByRole('button',{name:'찾기 닫기',exact:true}).click();
 await p.getByRole('button',{name:'테마 선택',exact:true}).click();await p.locator('#noa-theme').selectOption('noa-ivory');await p.getByRole('button',{name:'Close',exact:true}).click();
 await p.screenshot({path:'room-theme-proof/header/header-light-'+width+'.png'});await p.getByRole('button',{name:'테마 선택',exact:true}).click();await p.locator('#noa-theme').selectOption('noa-studio');await p.getByRole('button',{name:'Close',exact:true}).click();await p.screenshot({path:'room-theme-proof/header/header-dark-'+width+'.png'});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);await c.close();console.log('HEADER_LANGUAGE_WEATHER_SEARCH_THEME_OK',width);
}}finally{await browser.close();}
