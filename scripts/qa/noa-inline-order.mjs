import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const phase=process.env.NOA_ORDER_PHASE||'candidate',base='https://noastudio.ai.kr',out='inline-order-proof/'+phase;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
try{
 // Native session/CSRF/storage contract runs only in a local, isolated PHP fixture.
 const api=await browser.newContext(),local='http://127.0.0.1:8099/noa-category-order.php';
 let r=await api.request.get(local);assert.equal(r.status(),200);assert(!('csrf' in await r.json()));assert.equal((await api.request.post(local,{data:{group:'cover',keys:['a']}})).status(),403);
 r=await api.request.get(local+'?auth=admin');const access=await r.json();assert.equal(access.admin,true);assert.equal(access.csrf,'isolated-token');
 assert.equal((await api.request.post(local,{headers:{'X-CSRF-Token':'bad'},data:{group:'cover',keys:['a']}})).status(),403);
 assert.equal((await api.request.post(local,{headers:{'X-CSRF-Token':access.csrf},data:{group:'cover',keys:['b','a'],expected:access.cover}})).status(),200);
 assert.deepEqual((await (await api.request.get(local)).json()).cover,['b','a']);
 assert.equal((await api.request.post(local,{headers:{'X-CSRF-Token':access.csrf},data:{group:'cover',keys:['a','b'],expected:access.cover}})).status(),409);
 assert.equal((await api.request.post(local,{headers:{'X-CSRF-Token':access.csrf},data:{group:'cover',keys:['a','a']}})).status(),400);await api.close();report.push({nativeSession:true,guestDenied:true,csrfDenied:true,storageReadback:true,concurrentConflict:true,duplicateDenied:true});
 for(const pagePath of ['/noa-music.php','/noa-youtube.php'])for(const width of [360,390,430,1280])for(const theme of ['noa-studio','noa-ivory']){
  const context=await browser.newContext({viewport:{width,height:844},isMobile:width<700,hasTouch:width<700,reducedMotion:'reduce',serviceWorkers:'block'});let saved={story:[],cover:[]},writes=0,fail=false,embedLoads=0;const video=pagePath.includes('youtube'),rowSelector=video?'.noa-inline-video-row':'.noa-inline-song-row';
  await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
  await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='www.youtube.com'&&u.pathname.startsWith('/embed/')){embedLoads++;return route.fulfill({contentType:'text/html',body:'<!doctype html><body>isolated video player</body>'});}if(u.origin===base&&u.pathname==='/noa-category-order.php'){
   if(route.request().method()==='GET')return route.fulfill({json:{...saved,admin:true,csrf:'isolated-ui-token'}});
   writes++;assert.equal(route.request().headers()['x-csrf-token'],'isolated-ui-token');const body=route.request().postDataJSON();if(fail)return route.fulfill({status:503,json:{error:'isolated_failure'}});assert.deepEqual(body.expected,saved[body.group]);assert.equal(new Set(body.keys).size,body.keys.length);saved[body.group]=body.keys;return route.fulfill({json:{ok:true}});
  }
  if(!['GET','HEAD'].includes(route.request().method()))return route.abort();
  if(phase==='candidate'&&u.origin===base&&['/noa-browse.js','/noa-browse-order.js'].includes(u.pathname))return route.fulfill({path:process.cwd()+'/deploy'+u.pathname,contentType:'application/javascript'});return route.continue();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const prefs=page.waitForResponse(r=>r.url().includes('/noa-bridge/ui-preferences.php'));await page.goto(base+pagePath+'?genre=cover-reborn',{waitUntil:'domcontentloaded'});await prefs;await page.waitForFunction(()=>window.NoaUI?.getState());const order=page.getByRole('button',{name:video?'플레이리스트 영상 순서 변경':'플레이리스트 곡 순서 변경',exact:true});await order.waitFor();
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));const titleBox=await page.locator('[data-browse-level="3"] h2').boundingBox(),orderBox=await order.boundingBox();assert(orderBox.x>titleBox.x+titleBox.width-1);
  const rows=page.locator(rowSelector);const firstTwo=await rows.evaluateAll(ns=>ns.slice(0,2).map(n=>n.dataset.inlineKey));assert(firstTwo.length===2);
  if(video){await rows.last().locator('.noa-inline-song').click();await page.frameLocator('#yt-frame').getByText('isolated video player').waitFor();assert.equal(embedLoads,1);}
  await order.click();const handles=page.locator('.noa-order-move');assert(await handles.count()>1);assert(await handles.first().evaluate(n=>getComputedStyle(n).touchAction==='none'));assert.equal(writes,0);
  // Dispatch actual pointer events through the production handlers with native capture stubbed in this isolated document.
  await page.evaluate(()=>{const list=document.querySelector('.noa-order-list'),nodes=[...list.children],handle=nodes[0].querySelector('.noa-order-move');handle.scrollIntoView({block:'center'});const a=handle.getBoundingClientRect(),b=nodes[1].getBoundingClientRect();handle.setPointerCapture=()=>{};handle.hasPointerCapture=()=>false;handle.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,pointerId:7,clientX:a.x+10,clientY:a.y+10,pointerType:'touch'}));handle.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:7,clientX:b.x+b.width/2,clientY:b.bottom-2,pointerType:'touch'}));handle.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7,pointerType:'touch'}));});
  assert.deepEqual(await rows.evaluateAll(ns=>ns.slice(0,2).map(n=>n.dataset.inlineKey)),firstTwo.slice().reverse());assert.equal(writes,0);
  await page.getByRole('button',{name:'순서 변경 취소',exact:true}).click();assert.deepEqual(await rows.evaluateAll(ns=>ns.slice(0,2).map(n=>n.dataset.inlineKey)),firstTwo);assert.equal(writes,0);
  await order.click();await handles.first().press('ArrowDown');await page.getByRole('button',{name:'플레이리스트 순서 저장',exact:true}).click();await page.getByText('순서를 저장했습니다.',{exact:true}).waitFor();assert.equal(writes,1);if(video){assert.equal(embedLoads,1,'drag, cancel and save must retain the video iframe');await page.frameLocator('#yt-frame').getByText('isolated video player').waitFor();}
  const after=await rows.evaluateAll(ns=>ns.slice(0,2).map(n=>n.dataset.inlineKey));assert.deepEqual(after,firstTwo.slice().reverse());await page.reload();await order.waitFor();assert.deepEqual(await rows.evaluateAll(ns=>ns.slice(0,2).map(n=>n.dataset.inlineKey)),after);
  await order.click();await handles.first().press('ArrowDown');fail=true;await page.getByRole('button',{name:'플레이리스트 순서 저장',exact:true}).click();await page.getByText('저장하지 못했습니다. 다시 시도해 주세요.',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'플레이리스트 순서 저장',exact:true}).isEnabled());await page.getByRole('button',{name:'순서 변경 취소',exact:true}).click();assert.deepEqual(await rows.evaluateAll(ns=>ns.slice(0,2).map(n=>n.dataset.inlineKey)),after);assert.deepEqual(errors,[]);
  await order.click();await page.screenshot({path:out+'/'+(video?'youtube-':'music-')+theme+'-'+width+'.jpg',type:'jpeg',quality:86});report.push({pagePath,width,theme,videoIframePreserved:video,adminUIFixture:true,pointerDrag:true,keyboardMove:true,cancelNoWrite:true,explicitSave:true,reloadPersistence:true,saveFailureRetainsDraft:true});
  await page.goto(base+pagePath+'?genre=kpop-original&act=1');await page.waitForFunction(()=>document.querySelector('[data-browse-ready="true"]'));assert.equal(await order.count(),0,'EP order stays automatic');await context.close();
 }
 const guest=await browser.newContext();const guestPage=await guest.newPage();if(phase==='candidate')await guestPage.route('**/noa-browse.js*',route=>route.fulfill({path:process.cwd()+'/deploy/noa-browse.js',contentType:'application/javascript'}));for(const pagePath of ['/noa-music.php','/noa-youtube.php']){await guestPage.goto(base+pagePath+'?genre=cover-reborn');await guestPage.waitForFunction(()=>document.querySelector('[data-browse-ready="true"]'));assert.equal(await guestPage.locator('.noa-order-controls').count(),0);}await guest.close();
 writeFileSync(out+'/report.json',JSON.stringify({ok:true,phase,productionOrderWrites:0,physicalAndroid:false,report},null,2));console.log('NOA_INLINE_ORDER_OK',report.length);
}finally{await browser.close();}
