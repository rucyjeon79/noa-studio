import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const live=process.env.NOA_NAV_PHASE==='live',base='http://127.0.0.1:8078',out='navigation-proof/'+(live?'live':'candidate');mkdirSync(out,{recursive:true});
const report={phase:live?'deployed-assets in isolated native-auth fixture, plus anonymous production':'isolated native-auth fixture',accounts:[],hierarchy:[],productionWrites:0};
const server=spawn('php',['-S','127.0.0.1:8078','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'});
const assets=['noa-account.js','noa-account.css','noa-ui.js','noa-browse.js','noa-browse-order.js'];
const browsers=[];
try{
 for(const engine of ['chromium',...(live?[]:['webkit'])]){
  const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'chrome',args:['--no-sandbox']});browsers.push(browser);
  const probe=await browser.newContext();for(let i=0;i<50;i++){try{if((await probe.request.get(base+'/')).ok())break;}catch{}await new Promise(r=>setTimeout(r,100));}await probe.close();
  async function context(options={}){const c=await browser.newContext({serviceWorkers:'block',reducedMotion:'reduce',...options});if(live)for(const file of assets){const response=await c.request.get('https://noastudio.ai.kr/'+file+'?nav-live=1');assert(response.ok());const body=await response.body();await c.route(base+'/'+file+'*',r=>r.fulfill({body,contentType:file.endsWith('.js')?'text/javascript':'text/css'}));}return c;}
  for(const width of engine==='webkit'?[390]:[320,390,1280])for(const theme of ['noa-studio','noa-ivory'])for(const role of ['guest','member','vip','admin']){
   const c=await context({viewport:{width,height:900}});await c.addCookies([{name:'qa_role',value:role,url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),theme);
   const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/');const bar=p.locator('#noa-account-bar');await bar.waitFor();await p.waitForFunction(()=>document.getElementById('noa-account-bar').dataset.member!==undefined);
   assert.equal(await bar.locator('a[href*=login],a[href*=logout],.noa-account-status').count(),0);
   assert.equal(await bar.locator('.noa-account-brand span').textContent(),'NOA STUDIO');assert.equal(await bar.locator('.noa-account-shortcut').count(),4);
   const brand=await bar.locator('.noa-account-brand').boundingBox(),shortcuts=await bar.locator('.noa-account-shortcuts').boundingBox();assert(shortcuts.x>=brand.x+brand.width,'shortcuts are right of full brand');assert((await bar.boundingBox()).height<=64);
   const nav=p.locator(width<=760?'.noa-mobile-nav':'.noa-menu');const account=nav.locator('[data-noa-account-nav]');assert.equal(await account.textContent(),role==='guest'?'로그인':'MY');assert.equal(await account.locator('svg').count(),1);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   if(role==='guest'){await account.click();await p.locator('input[name=mb_password]').waitFor();assert(new URL(p.url()).pathname.includes('login'));}
   else{
    await account.click();await p.waitForURL('**/noa-my.php');const summary=p.locator('#noa-my-account[data-state=ready]');await summary.waitFor();assert.equal(await p.locator('#noa-my-points').textContent(),role==='admin'?'12,345,678P':role==='member'?'0P':'600P');assert.equal(await p.locator('#noa-my-subscription').textContent(),role==='vip'?'구독 중 · 14일 남음':'구독 없음');assert.equal(await summary.locator('a[href="/noa-membership.php#points"]').count(),1);assert(await summary.getByRole('link',{name:'로그아웃',exact:true}).isVisible());
    assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(width===390||width===1280&&role==='vip')await p.screenshot({path:out+'/'+engine+'-'+theme+'-'+width+'-'+role+'-my.png'});
    await summary.getByRole('link',{name:'로그아웃',exact:true}).click();await p.waitForURL(base+'/');await p.locator('.noa-mobile-nav [data-noa-account-nav=login]').waitFor({state:width<=760?'visible':'attached'});
   }
   assert.deepEqual(errors,[]);report.accounts.push({engine,width,theme,role,brandAndRightShortcuts:true,bottomAccount:true,mySummary:role!=='guest',logout:role!=='guest',noOverflow:true});await c.close();
  }
  // Exercise the actual shared hierarchy in both media modes, including administrator pool controls.
  for(const kind of ['곡','영상']){
   const c=await context({viewport:{width:390,height:844}});await c.addCookies([{name:'qa_role',value:'admin',url:base}]);const p=await c.newPage();await p.goto(base+'/noa-my.php?type=playlist');await p.addScriptTag({url:base+'/noa-browse.js'});
   await p.evaluate(kind=>{
    const rows=[{key:'ep-10',genre:'kpop-original',ep:10},{key:'ep-2',genre:'kpop-original',ep:2},{key:'ep-11',genre:'kpop-original',ep:11},{key:'foreign',genre:'jpop-original',ep:1},{key:'loose-a',genre:'your-story'},{key:'loose-b',genre:'your-story'},{key:'saved-a',genre:'your-story'},{key:'saved-b',genre:'your-story'},{key:'cover-loose',genre:'cover-reborn'}].map(r=>({...r,title:r.key,kind:kind==='영상'?'video':'single',...(kind==='영상'?{video:r.key}:{})}));
    const host=document.createElement('section');host.id='navigation-hierarchy';document.querySelector('main').replaceChildren(host);let model;model=window.NoaBrowse.mount({host,rows,kind,onChange:()=>model.apply(rows)});window.qaBrowse=model;model.apply(rows);
   },kind);
   const host=p.locator('#navigation-hierarchy');await host.locator('[data-browse-level="1"]').waitFor();assert.equal(await host.locator('[data-browse-level="1"] .noa-browse-card').count(),4);assert.equal(await host.locator('[data-browse-level="3"]').count(),0);
   await host.locator('[data-browse-level="1"] .noa-browse-card').first().click();await host.locator('[data-browse-level="2"] .noa-browse-card').first().click();assert.equal(await host.locator('[data-browse-level="2"]>h2').textContent(),'세부 장르');assert.equal(await host.locator('[data-browse-level="3"]>h2').textContent(),'곡 묶음');assert.equal(await host.locator('[data-browse-level="4"]:visible').count(),0);
   await host.locator('[data-act-number="1"]>.noa-browse-card').click();assert.deepEqual(await host.locator('[data-browse-level="4"]:visible .noa-inline-title').allTextContents(),['EP.2 · ep-2','EP.10 · ep-10']);
   await host.locator('[data-browse-level="1"] .noa-browse-card').nth(2).click();await host.locator('[data-browse-level="2"] .noa-browse-card').click();const pool=host.locator('[data-unclassified]');assert(await pool.locator('[data-browse-level="4"]').isVisible());assert.equal(await pool.locator(':scope>.noa-browse-card').count(),0);assert.deepEqual(await pool.locator('.noa-inline-title').allTextContents(),['loose-b','loose-a']);
   const saved=host.locator('[data-playlist-id="fixture-collection"]');await saved.locator(':scope>.noa-browse-card').click();assert.deepEqual(await saved.locator('.noa-inline-title').allTextContents(),['saved-b','saved-a']);
   // Unclassified rows remain visible while selecting and cancelling new collections.
   await host.getByRole('button',{name:'새 플레이리스트 생성',exact:true}).click();assert(await pool.locator('[data-browse-level="4"]').isVisible());await host.getByRole('button',{name:'플레이리스트 생성 취소',exact:true}).click();
   await p.evaluate(()=>window.qaBrowse.focusTrack('cover-loose'));await host.locator('[data-noa-focus=true]').waitFor();assert(await host.locator('[data-noa-focus=true]').isVisible());assert.equal(await host.locator('[data-noa-focus=true]').getAttribute('data-inline-key'),'cover-loose');await p.screenshot({path:out+'/'+engine+'-'+(kind==='곡'?'audio':'video')+'-unclassified.png'});
   report.hierarchy.push({engine,kind,fourLevels:true,actShortcut:true,actOrder:true,savedOrder:true,unclassifiedAlwaysVisible:true,administratorPoolUsable:true,deepLinkVisible:true});await c.close();
  }
  const c=await context();await c.addCookies([{name:'qa_role',value:'vip',url:base}]);await c.route('**/noa-bridge/membership.php',r=>r.fulfill({status:503,json:{ok:false}}));const p=await c.newPage();await p.goto(base+'/noa-my.php');await p.locator('#noa-my-account[data-state=error]').waitFor();assert.match(await p.locator('#noa-my-account-status').textContent(),/불러오지 못/);assert(await p.getByRole('link',{name:'로그아웃',exact:true}).isVisible());report.errorState=true;await c.close();
  if(live){const c=await browser.newContext({viewport:{width:390,height:844}}),p=await c.newPage();await p.goto('https://noastudio.ai.kr/');await p.locator('.noa-mobile-nav [data-noa-account-nav=login]').waitFor();assert.equal(await p.locator('#noa-account-bar .noa-account-brand span').textContent(),'NOA STUDIO');assert(await p.locator('[data-home-section=hero]').isVisible());await p.screenshot({path:out+'/production-home.png'});await p.locator('.noa-mobile-nav [data-noa-account-nav=login]').click();await p.locator('input[name=mb_password]').waitFor();report.liveHomeAndLogin=true;await c.close();}
 }
}finally{for(const browser of browsers)await browser.close();server.kill();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
console.log('NAVIGATION_MY_FOUR_LEVEL_OK',JSON.stringify({accounts:report.accounts.length,hierarchy:report.hierarchy.length,live}));
