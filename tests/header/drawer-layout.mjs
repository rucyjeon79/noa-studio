import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const minePath='/noa-sitemap.php?view=mine';
import {createHash} from 'node:crypto';

const phase=process.env.NOA_THEME_PHASE||'candidate';
const out='room-theme-proof/drawer-'+phase;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
async function checkFooter(page,width,theme,home=false){
 const footer=page.locator('.noa-mobile-footer'),scene=footer.locator('.noa-footer-scene'),image=scene.locator('.noa-footer-landscape');
 await footer.scrollIntoViewIfNeeded();
 await page.waitForFunction(()=>{const img=document.querySelector('.noa-footer-landscape');return img?.complete&&img.naturalWidth>0;});
 assert((await image.getAttribute('src')).includes(theme==='noa-studio'?'night-coast':'day-coast'));
 assert.equal(await page.locator('.noa-sidebar-visitors').count(),1,'one visitor counter per page');
 assert.equal(await page.locator('#noa-menu-drawer footer .noa-sidebar-visitors').count(),1);
 assert.equal(await footer.locator('.noa-sidebar-visitors').count(),0,'no page footer may retain the counter');
 const links=scene.locator('nav a');
 assert.deepEqual(await links.allTextContents(),['제이알','세계관','이용약관','개인정보처리방침']);
 assert.equal(await footer.locator(':scope > .noa-footer-scene').count(),1);
 assert.equal(await footer.locator('.noa-sidebar-legal').count(),1);
 const geometry=await scene.evaluate(el=>{
  const r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};};
  return {art:r(el.querySelector('img')),links:[...el.querySelectorAll('nav a')].map(r),caption:r(el.querySelector('.noa-sidebar-signature')),choices:r(el.querySelector('.noa-footer-themes')),buttons:[...el.querySelectorAll('[data-footer-theme]')].map(r)};
 });
 const {art,caption,choices}=geometry;
 const inside=box=>box.x>=art.x-1&&box.y>=art.y-1&&box.x+box.width<=art.x+art.width+1&&box.y+box.height<=art.y+art.height+1;
 assert(inside(caption)&&inside(choices)&&caption.x+caption.width<=choices.x&&caption.y>art.y+art.height/2&&choices.y>art.y+art.height/2,JSON.stringify({width,theme,geometry}));
 assert(caption.x-art.x<=25&&art.x+art.width-choices.x-choices.width<=25,'caption left, theme choices right');
 assert(art.y+art.height-choices.y-choices.height<=25,'theme choices stay at image bottom');
 for(const button of geometry.buttons)assert(button.width>=44&&button.height>=44);
 assert.equal(await scene.locator('[data-footer-theme] svg').count(),3);
 const blocked=await scene.locator('[data-footer-theme]').evaluateAll(buttons=>buttons.flatMap(el=>{const r=el.getBoundingClientRect();return [[r.x+4,r.y+4],[r.right-4,r.bottom-4]].flatMap(([x,y])=>{const hit=document.elementFromPoint(x,y);return el.contains(hit)?[]:[{choice:el.dataset.footerTheme,x,y,hit:hit?.id||hit?.className||hit?.tagName}];});}));
 if(blocked.length)await page.screenshot({path:out+'/blocked-footer-'+width+'.png'});
 assert.deepEqual(blocked,[],'theme choices obstructed: '+JSON.stringify({width,path:page.url(),blocked}));
 assert(await scene.locator('.noa-footer-theme-label').isVisible());
 assert(await scene.locator('.noa-sidebar-signature>span').evaluate(el=>parseFloat(getComputedStyle(el).fontSize)>=18),'theme topic must have a readable hierarchy');
 for(let i=0;i<4;i++){
  const link=links.nth(i),box=geometry.links[i];
  assert(box.width>=44&&box.height>=44&&inside(box)&&box.y<art.y+art.height/3,JSON.stringify({width,theme,geometry}));
  assert(box.y+box.height<Math.min(caption.y,choices.y),'legal links must be above the theme row');
  const href=await link.getAttribute('href');
  if(!href&&i===1)assert.equal(await link.getAttribute('aria-disabled'),'true');
  else assert.equal(href,['/noa-about.php','/noa-world.php','/noa-terms.php','/noa-privacy.php'][i]);
 }
 if(home&&width>=390){await footer.scrollIntoViewIfNeeded();await footer.screenshot({path:out+'/footer-'+theme+'-'+width+'.png'});}
}
try{
 await Promise.all([320,390,1440].map(async width=>{
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block',reducedMotion:'reduce'});
  context.setDefaultTimeout(20000);context.setDefaultNavigationTimeout(30000);
  try{
   if(phase==='candidate')for(const file of ['noa-ui.js','noa-starlight.css','noa-account.js']){
    await context.route('**/'+file+'*',r=>r.fulfill({body:readFileSync('deploy/'+file),contentType:file.endsWith('.css')?'text/css':'application/javascript'}));
   }
   if(phase==='candidate')await context.route('**/noa-assets/drawer-studio-session.jpg',route=>route.fulfill({body:readFileSync('public/drawer/studio-session.jpg'),contentType:'image/jpeg'}));
   const page=await context.newPage();
   const campaign=page.locator('#noa-amt-fan .amt-close');
   await page.addLocatorHandler(campaign,()=>campaign.click());
   page.on('pageerror',error=>console.log('PAGE_ERROR',width,error.message));
   for(const [theme,path] of [['noa-studio','/noa-shop.php'],['noa-ivory','/noa-login.php']]){
    const member=theme==='noa-studio';
    // Use consistent member data for every UI that shares the session. No real credentials.
    if(member){
     const admin=width===1440;
     const caps=JSON.parse(readFileSync(fileURLToPath(new URL('./drawer-'+(admin?'admin':width===390?'eight':'member')+'-access.json',import.meta.url)),'utf8'));
     await page.route('**/noa-shop.php',async route=>{
      const upstream=await route.fetch();
      const html=(await upstream.text()).replace(/(<script[^>]*id="noa-access"[^>]*>)([^<]*)(<\/script>)/,(_m,a,data,b)=>a+JSON.stringify({...JSON.parse(data),...caps})+b);
      await route.fulfill({response:upstream,body:html});
     });
     await page.route('**/noa-bridge/membership.php?action=summary',r=>r.fulfill({json:{ok:true,member:true,balance:width===320?123456789:13700,remainingDays:0,name:caps.name,admin}}));
     await page.route('**/noa-bridge/ui-preferences.php',async r=>{
      const response=await r.fetch();
      await r.fulfill({response,json:{...await response.json(),member:true,displayName:width===320?'아주긴별무리이름테스트':'별무리'}});
     });
     await page.route('**/noa-ainoa.php?action=welcome',r=>r.fulfill({json:{ok:true,member:true,displayName:'별무리',capabilities:caps,accountKey:'drawer-fixture'}}));
    }else await page.unrouteAll({behavior:'wait'});
    const fixtureRole=member?(width===1440?'admin':width===390?'eight':'member'):'guest';
    const fixture=readFileSync(fileURLToPath(new URL('./drawer-'+fixtureRole+'.html',import.meta.url)),'utf8');
    if(phase==='candidate'||member)await page.route('**/noa-sitemap.php?view=mine',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:fixture}));
    await page.goto('https://noastudio.ai.kr'+path,{waitUntil:'domcontentloaded'});
    const drawer=page.locator('#noa-menu-drawer');
    await page.waitForFunction(()=>!document.querySelector('[data-footer-theme]')?.disabled && !!document.querySelector('#noa-menu-drawer #noa-drawer-tools'));
    await page.locator('[data-footer-theme="'+theme+'"]').evaluate(b=>b.click());
    await page.waitForFunction(t=>document.documentElement.dataset.noaTheme===t&&!document.querySelector('#noa-header-language')?.disabled,theme);

    if(await campaign.isVisible())await campaign.click();
    await checkFooter(page,width,theme);
    if(width<1200)await page.locator('#noa-nav-all').click();
    const logo=drawer.locator('.noa-brand-mark');
    await logo.evaluate(img=>img.decode());
    assert.equal(await logo.count(),1);assert((await logo.boundingBox()).width>=36);
    const parts=await drawer.locator(':scope > *').evaluateAll(nodes=>nodes.slice(0,5).map(e=>e.id||e.className));
    assert.deepEqual(parts,['noa-drawer-head','noa-drawer-profile','noa-drawer-search','noa-drawer-tools','noa-menu']);
    const form=drawer.locator('.noa-drawer-login'),entry=drawer.locator('.noa-drawer-my');
    assert(await form.isHidden());assert.equal(await form.getAttribute('method'),'post');assert.equal(await form.getAttribute('action'),'/bbs/login_check.php');
    if(member){
     assert(await entry.isVisible());assert.equal(await entry.getAttribute('href'),'/noa-my.php');
     const actions=drawer.locator('.noa-drawer-links');
     await actions.getByText(width===320?'123,456,789P':'13,700P',{exact:true}).waitFor();
     await drawer.locator('.noa-drawer-id strong').filter({hasText:width===320?'아주긴별무리이름테스트':'별무리'}).waitFor();
     assert.equal(await actions.locator('[data-drawer-action=admin]').isVisible(),width===1440);
     const grid=await actions.locator('a:visible').evaluateAll(links=>links.slice(0,6).map(link=>{const r=link.getBoundingClientRect();return [r.x,r.y,r.height];}));
     for(let i=0;i<6;i++){assert(grid[i][2]>=44);assert.equal(grid[i][0],grid[i%2][0]);assert.equal(grid[i][1],grid[i-i%2][1]);}
    }else{
     const guest=drawer.locator('.noa-drawer-guest');
     assert(await guest.isVisible());assert(await entry.isHidden());
     assert.equal(await guest.getByRole('link',{name:'회원가입'}).getAttribute('href'),'/noa-login.php#noa-login');
     const photo=guest.locator('.noa-drawer-stage img');await photo.evaluate(i=>i.decode());
     assert(await photo.evaluate(i=>i.naturalWidth===1536&&i.naturalHeight===861&&Math.abs(i.offsetWidth/i.offsetHeight-1536/861)<.03));
     if(phase==='live'){
      const image=await page.request.get('https://noastudio.ai.kr/noa-assets/drawer-studio-session.jpg');
      assert.equal(createHash('sha256').update(await image.body()).digest('hex'),createHash('sha256').update(readFileSync('public/drawer/studio-session.jpg')).digest('hex'));
     }
     assert.equal(await page.locator('#noa-login .noa-social-options').count(),1);
     await guest.getByRole('button',{name:'로그인',exact:true}).click();assert(await form.locator('[autocomplete=current-password]').isVisible());
     await guest.locator('[aria-controls=noa-drawer-signin]').click();assert(await form.isHidden());
    }
    const tools=drawer.locator('.noa-info-actions');
    const buttons=tools.locator(':scope > a,:scope > button,#noa-header-language');
    assert.deepEqual(await buttons.allTextContents(),['앱 설치','공유','언어 선택']);
    const boxes=await buttons.evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect(),label=e.querySelector('span').getBoundingClientRect(),svg=e.querySelector('svg').getBoundingClientRect();return [r.x,r.y,r.width,r.height,label.width,label.height,svg.width]}));
    for(const [i,[x,y,w,h,lw,lh,sw]] of boxes.entries()){assert(w>=44&&h>=44&&lw>0&&lh>0&&sw>0);if(i)assert(x>=boxes[i-1][0]+boxes[i-1][2]-1&&Math.abs(y-boxes[0][1])<=1);}
    const map=drawer.locator('.noa-menu'),links=map.locator('[data-drawer-route]');
    await links.first().waitFor();
    const markup=phase==='candidate'||member?fixture:await (await page.request.get('https://noastudio.ai.kr'+minePath)).text();
    assert.equal(await map.locator('.noa-drawer-map-link').getAttribute('href'),minePath);
    const expected=await page.evaluate(({markup,member,admin})=>{
     const t=document.createElement('template');t.innerHTML=markup;
     const shortcuts=new Set(['download','login',...(member?['my','profile','membership',...(admin?['libraryAdmin']:[])]:[])]);
     return [...t.content.querySelectorAll('main[data-noa-member-directory] .noa-site-map')].map(g=>[g.querySelector('h2').id,...[...g.querySelectorAll('[data-noa-route]')].filter(a=>!shortcuts.has(a.dataset.noaRoute)).map(a=>[a.dataset.noaRoute,a.getAttribute('href'),Number(a.dataset.noaAccessRank)>=4?(a.dataset.noaAccessLabel||''):'',Number(a.dataset.noaAccessRank)||0])]).filter(g=>g.length>1);
    },{markup,member,admin:fixtureRole==='admin'});
    assert(expected.length>0);
    const actual=await map.locator('.noa-drawer-category').evaluateAll(gs=>gs.map(g=>[g.dataset.mapGroup,...[...g.querySelectorAll('a')].map(a=>[a.dataset.drawerRoute,a.getAttribute('href'),a.querySelector('.noa-route-level')?.getAttribute('aria-label')||'',Number(a.dataset.accessRank)||0])]));
    assert.deepEqual(actual,expected);
    for(const [, ...routes] of actual){const ranks=routes.map(r=>r[3]);assert.deepEqual(ranks,[...ranks].sort((a,b)=>a-b),'high-grade menus must follow low-grade menus');}
    const badges=await map.locator('.noa-route-level').evaluateAll(nodes=>nodes.map(el=>{
     const box=el.getBoundingClientRect(),row=el.closest('a').getBoundingClientRect(),name=el.closest('a').querySelector('.noa-route-name').getBoundingClientRect(),frame=el.querySelector('.noa-rank-badge'),mark=frame.firstElementChild;
     return {text:el.textContent,role:el.getAttribute('role'),label:el.getAttribute('aria-label'),title:el.title,icon:!!mark.querySelector('svg')||getComputedStyle(mark).backgroundImage!=='none',width:box.width,height:box.height,adjacent:box.left-name.right,aligned:box.right<=row.right+1&&box.left>=row.left&&box.top>=row.top&&box.bottom<=row.bottom+1};
    }));
    for(const b of badges){assert.equal(b.text,'');assert.equal(b.role,'img');assert(b.label&&b.title===b.label&&b.icon&&b.width===22&&b.height===24&&b.aligned&&b.adjacent>=4&&b.adjacent<=9,JSON.stringify(b));}
    assert(await map.locator('.noa-route-name').evaluateAll(names=>names.every(n=>getComputedStyle(n).whiteSpace==='normal'&&n.scrollWidth<=n.clientWidth+1)),'menu names must wrap without clipping');
    for(const group of await map.locator('.noa-drawer-category').all()){
     const icon=group.locator('h3 svg');assert(await icon.isVisible());
     const marker=await icon.boundingBox(),rows=await group.locator('.noa-drawer-secondary a').evaluateAll(anchors=>anchors.map(a=>{
      const r=a.getBoundingClientRect(),style=getComputedStyle(a);return [r.x,r.y,r.height,style.backgroundColor,style.borderTopWidth];
     }));
     for(const [i,[x,y,height,color,border]] of rows.entries()){
      assert(x>=marker.x+marker.width&&Math.abs(x-rows[0][0])<1&&height>=44);
      if(i)assert(y>=rows[i-1][1]+rows[i-1][2]-1,'children must follow one another vertically');
      assert.equal(color,'rgba(0, 0, 0, 0)');assert.equal(border,'0px');
     }
    }
    assert.equal(await map.locator('a[aria-disabled=true],[data-noa-condition]').count(),0);
    for(const key of ['my','profile','membership','download','login','libraryAdmin'])assert.equal(await map.locator('[data-drawer-route='+key+']').count(),0,'shortcut duplicated in categories: '+key);
    const destinations=await links.evaluateAll(xs=>xs.map(a=>a.getAttribute('href')));assert.equal(new Set(destinations).size,destinations.length,'duplicate category destination');
    assert.equal(await map.locator('[data-drawer-route=creatorAI]').count(),['admin','eight'].includes(fixtureRole)?1:0);
    assert.equal(await map.locator('a[data-access-rank="0"] .noa-route-level,a[data-access-rank="1"] .noa-route-level,a[data-access-rank="2"] .noa-route-level,a[data-access-rank="3"] .noa-route-level').count(),0,'levels 3 and below have no grade icon');
    assert.equal(await drawer.locator('footer .noa-sidebar-legal,footer a[href="/noa-world.php"]').count(),0);
    assert(await drawer.locator('footer .noa-sidebar-visitors').isVisible());
    const index=map.getByRole('combobox',{name:'분류 바로가기'});assert.equal(await index.locator('option').count(),expected.length+1);
    const choices=map.locator('.noa-drawer-category').nth(1);await index.selectOption({index:2});
    assert(await choices.locator('h3').evaluate(el=>el===document.activeElement));
    const search=drawer.locator('#noa-drawer-search');
    await search.fill('앱 설치');const choice=drawer.locator('#noa-nav-install');assert(await choice.isVisible());assert(await map.locator('[data-drawer-route=giftBox]').isHidden());
    await drawer.locator('.noa-drawer-search button').click();assert(await choice.evaluate(e=>e===document.activeElement));
    await search.fill('없는메뉴xyz');assert(await drawer.locator('.noa-menu-empty').isVisible());await search.fill('');
    await drawer.locator('#noa-header-language').click();assert(await drawer.locator('#noa-language-options').isVisible());await drawer.locator('#noa-language-options button[data-language=ko]').click();
    if(width===390){await map.scrollIntoViewIfNeeded();await map.locator('h2').evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/directory-'+theme+'.png'});}
    if(width===390&&member){const account=map.locator('[data-map-group=map-account]');await account.evaluate(e=>e.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:out+'/grade-order-'+theme+'.png'});}
    assert.equal(await drawer.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
    if(width===390){await drawer.evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/menu-'+theme+'.png'});}
    console.log('DRAWER_LAYOUT_OK',phase,width,theme,path);
   }
   await page.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded'});
   await page.locator('.noa-mobile-footer').waitFor({state:'attached'});
   for(const theme of ['noa-studio','noa-ivory']){
    const pick=page.locator('[data-footer-theme="'+theme+'"]');
    await pick.click();await page.waitForFunction(t=>document.documentElement.dataset.noaTheme===t,theme);
    await checkFooter(page,width,theme,true);
   }
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   const homeDrawer=page.locator('#noa-menu-drawer');
   if(width<1200){if(await campaign.isVisible())await campaign.click();await page.locator('#noa-nav-all').click();}
   const counts=await page.locator('#noa-visitor-counts').textContent();
   const panel=homeDrawer.locator('footer .noa-sidebar-visitors');assert(await panel.isVisible());
   assert.equal(await page.locator('.noa-mobile-footer .noa-sidebar-visitors').count(),0);
   const current=JSON.parse(counts);for(const key of ['today','yesterday','total'])assert.equal((await panel.locator('[data-visit='+key+']').textContent()).replaceAll(',',''),String(current[key]));
   await homeDrawer.locator('.noa-drawer-groups [data-drawer-route]').first().waitFor();
   await panel.evaluate(el=>el.scrollIntoView({block:'end',behavior:'instant'}));
   assert(await panel.evaluate(el=>{const box=el.getBoundingClientRect(),rail=el.closest('dialog').getBoundingClientRect();return box.top>=rail.top-1&&box.bottom<=rail.bottom+1;}));
   if(width===390)await panel.screenshot({path:out+'/visitor-panel.png'});
   console.log('DRAWER_HOME_COUNTER_OK',phase,width);
   if(width===390)for(const path of ['/noa-about.php','/noa-lounge.php','/noa-vip.php','/bbs/login.php']){
    await page.goto('https://noastudio.ai.kr'+path,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!document.querySelector('.noa-footer-heading')&&!document.querySelector('[data-footer-theme]')?.disabled);
    await checkFooter(page,width,await page.locator('html').getAttribute('data-noa-theme'));
    console.log('DRAWER_ALL_PAGE_FOOTER_OK',phase,path);
   }
  }catch(error){
   const page=context.pages()[0];if(page)console.error('DRAWER_STATE',width,await page.evaluate(()=>({url:location.pathname,theme:document.documentElement.dataset.noaTheme,controls:[...document.querySelectorAll('.noa-drawer-head,#noa-drawer-tools,#noa-header-language,[data-footer-theme]')].map(e=>[e.id||e.className,e.disabled,e.parentElement?.id]),query:document.querySelector('#noa-drawer-search')?.value,rows:[...document.querySelectorAll('.noa-menu a')].map(e=>[e.textContent,e.hidden,getComputedStyle(e).display])})));
   throw error;
  }finally{await context.close();}
 }));
}finally{await browser.close();}
