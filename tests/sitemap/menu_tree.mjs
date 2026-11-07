import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const out='menu-tree-proof',fixture=out+'/fixture';
mkdirSync(out,{recursive:true});
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const results=[];
try{
 for(const [role,theme,width] of [
  ...['guest','member','seven','eight','admin'].flatMap(role=>[390,1280].map(width=>[role,'noa-studio',width])),
  ...[320,390,1280].map(width=>['admin','noa-ivory',width]),
 ]){
  const html=readFileSync(`${fixture}/menu-${role}.html`,'utf8');
  const caps=JSON.parse(readFileSync(`${fixture}/drawer-${role}-access.json`,'utf8'));
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',reducedMotion:'reduce',serviceWorkers:'block'});
  context.setDefaultTimeout(12000);
  await context.addInitScript(theme=>{
   localStorage.setItem('noa-ui-selection-v2',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'}));
   localStorage.setItem('noa-device-theme',theme);
  },theme);
  const requests=[],errors=[];
  await context.route('**/*',async route=>{
   const u=new URL(route.request().url()),p=u.pathname;requests.push(p+u.search);
   if(p==='/noa-sitemap.php')return route.fulfill({contentType:'text/html; charset=utf-8',body:html});
   if(p==='/noa-bridge/membership.php')return route.fulfill({json:{ok:true,member:caps.member,admin:caps.admin,level:caps.level,name:caps.name,balance:0,remainingDays:0}});
   if(p==='/noa-bridge/ui-preferences.php')return route.fulfill({json:{member:caps.member,admin:caps.admin,displayName:'메뉴 확인',revision:0,settings:null,defaults:{enabled:['noa-studio','noa-ivory']}}});
   const file='deploy'+p;
   if(/\.(css|js|json)$/.test(p)&&existsSync(file))return route.fulfill({body:readFileSync(file),contentType:p.endsWith('.css')?'text/css':p.endsWith('.js')?'application/javascript':'application/json'});
   if(/\.(png|jpg|webp|svg)$/.test(p))return route.fulfill({body:pixel,contentType:'image/png'});
   if(p==='/noa-ai-lab.php')return route.fulfill({contentType:'text/html',body:'<h1>Canonical tool destination</h1>'});
   return route.fulfill({status:404,body:''});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('https://menu.test/noa-sitemap.php',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>window.NoaUI&&document.querySelector('#noa-nav-all'));
   const drawer=page.locator('#noa-menu-drawer');
   if(width<1200)await page.locator('#noa-nav-all').click();
   await page.waitForFunction(()=>document.querySelectorAll('#noa-menu-drawer .noa-drawer-category').length>0);
   const expected=role==='admin'?['creator_lab','ai_lab','admin']:['seven','eight'].includes(role)?['creator_lab','ai_lab']:role==='member'?['ai_lab']:[];
   assert.deepEqual(await drawer.locator('details[data-noa-workspace]').evaluateAll(nodes=>nodes.map(n=>n.dataset.noaWorkspace)),expected);
   assert.equal(await drawer.locator('[data-drawer-action=admin]').count(),0,'homepage settings has one tree owner');
   const destinations=await drawer.locator('[data-drawer-route]').evaluateAll(links=>links.map(a=>a.getAttribute('href')));
   assert.equal(new Set(destinations).size,destinations.length,'no repeated destinations');
   assert.equal(await drawer.locator('[data-drawer-route=channel]').count(),['eight','admin'].includes(role)?1:0);
   assert.equal(await drawer.locator('[data-drawer-route=aiSettings]').count(),role==='admin'?1:0);
   for(const key of expected){
    const group=drawer.locator(`details[data-noa-workspace="${key}"]`);
    const source=page.locator(`main>.noa-site-map[data-noa-workspace="${key}"]`);
    assert.deepEqual(await group.locator('a').evaluateAll(as=>as.map(a=>a.getAttribute('href'))),await source.locator('a[href]').evaluateAll(as=>as.map(a=>a.getAttribute('href'))),'drawer projects authorized source exactly');
    assert.equal(await group.evaluate(el=>el.open),false,'workspaces start compact');
    await group.locator('summary').click();assert.equal(await group.evaluate(el=>el.open),true);
    assert(await group.locator('a').first().isVisible());
    await group.locator('summary').press('Enter');assert.equal(await group.evaluate(el=>el.open),false);
   }
   const search=drawer.locator('#noa-drawer-search');
   if(role==='admin'){
    const first=drawer.locator('details[data-noa-workspace=creator_lab]');
    await first.locator('summary').scrollIntoViewIfNeeded();
    await page.screenshot({path:`${out}/tree-${role}-${theme}-${width}.png`});
    for(const [query,workspace,id] of [['음원 최적화','creator_lab','jukebox'],['뮤비','ai_lab','muvy'],['서비스 연결','admin','aiSettings']]){
     await search.fill(query);
     const group=drawer.locator(`details[data-noa-workspace="${workspace}"]`);
     assert(await group.locator(`[data-drawer-route="${id}"]`).isVisible());
     assert.equal(await group.evaluate(el=>el.open),true,'search expands matching tree');
     assert.equal(await drawer.locator('.noa-drawer-branch:not([hidden])').count(),1,'only matching branch remains');
     await search.fill('');assert.equal(await group.evaluate(el=>el.open),false,'clear restores disclosure state');
    }
    await search.fill('뮤비');
    await search.press('Enter');
    assert.equal(await page.locator(':focus').getAttribute('data-drawer-route'),'muvy','search submission focuses canonical match');
    await page.screenshot({path:`${out}/search-${role}-${theme}-${width}.png`});
    await search.fill('');
   }
   await search.fill('아무메뉴도없음xyz');assert(await drawer.locator('.noa-menu-empty').isVisible());await search.fill('');
   assert.equal(requests.filter(p=>p==='/noa-sitemap.php?view=mine').length,1,'toggles and search reuse one authorized directory');
   assert.deepEqual(requests.filter(p=>/\/(catalog|creator|lab-api|muvy)\.php/.test(p)),[],'menu never launches catalog scans or AI work');
   const overflow=await drawer.evaluate(el=>({drawer:el.scrollWidth-el.clientWidth,page:document.documentElement.scrollWidth-innerWidth}));
   assert(overflow.drawer<=1&&overflow.page<=1,JSON.stringify({role,width,overflow}));
   assert.deepEqual(errors,[]);
   if(role==='admin'){
    if(width<1200)await drawer.locator('.noa-drawer-close').click();
    // The full sitemap search also hides irrelevant branch headings.
    await page.locator('#noa-menu-search').fill('서비스 연결');
    assert.equal(await page.locator('main .noa-site-map-subheading:not([hidden])').count(),1);
    await page.locator('#noa-menu-search').fill('');
    if(width<1200)await page.locator('#noa-nav-all').click();
    await search.fill('뮤비');
    await drawer.locator('[data-drawer-route=muvy]').click();
    assert.equal(new URL(page.url()).pathname+new URL(page.url()).search,'/noa-ai-lab.php?tool=muvy');
   }
   results.push({role,theme,width,roots:expected,uniqueDestinations:destinations.length,directoryFetches:1,noHeavyRequests:true,noOverflow:true});
  }catch(e){await page.screenshot({path:`${out}/failure-${role}-${theme}-${width}.png`,fullPage:true});throw e;}
  finally{await context.close();}
 }
 writeFileSync(out+'/results.json',JSON.stringify(results,null,2));
 console.log('N80_MENU_TREE_BROWSER_OK',JSON.stringify(results));
}finally{await browser.close();}
