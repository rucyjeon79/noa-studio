import assert from 'node:assert/strict';
import {mkdirSync,readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const phase=process.env.NOA_THEME_PHASE||'candidate';
const out='room-theme-proof/drawer-'+phase;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 await Promise.all([320,390,1440].map(async width=>{
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block',reducedMotion:'reduce'});
  try{
   if(phase==='candidate')for(const file of ['noa-ui.js','noa-starlight.css','noa-account.js']){
    await context.route('**/'+file+'*',r=>r.fulfill({body:readFileSync('deploy/'+file),contentType:file.endsWith('.css')?'text/css':'application/javascript'}));
   }
   const page=await context.newPage();
   const campaign=page.locator('#noa-amt-fan .amt-close');
   await page.addLocatorHandler(campaign,()=>campaign.click());
   page.on('pageerror',error=>console.log('PAGE_ERROR',width,error.message));
   for(const [theme,path] of [['noa-studio','/noa-shop.php'],['noa-ivory','/noa-login.php']]){
    const member=theme==='noa-studio';
    // Use consistent member data for every UI that shares the session. No real credentials.
    if(member){
     const admin=width===1440;
     const caps={member:true,name:admin?'최고 관리자':'별무리 회원',level:admin?10:3,admin};
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
    await page.goto('https://noastudio.ai.kr'+path,{waitUntil:'domcontentloaded'});
    const drawer=page.locator('#noa-menu-drawer');
    await page.waitForFunction(()=>!document.querySelector('[data-footer-theme]')?.disabled && !!document.querySelector('#noa-menu-drawer #noa-drawer-tools'));
    await page.locator('[data-footer-theme="'+theme+'"]').evaluate(b=>b.click());
    await page.waitForFunction(t=>document.documentElement.dataset.noaTheme===t&&!document.querySelector('#noa-header-language')?.disabled,theme);

    if(await campaign.isVisible())await campaign.click();
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
     await guest.locator('img').evaluate(i=>i.decode());
     assert.equal(await page.locator('#noa-login .noa-social-options').count(),1);
     await guest.getByRole('button',{name:'로그인',exact:true}).click();assert(await form.locator('[autocomplete=current-password]').isVisible());
     await guest.locator('[aria-controls=noa-drawer-signin]').click();assert(await form.isHidden());
    }
    const tools=drawer.locator('.noa-info-actions');
    const buttons=tools.locator(':scope > a,:scope > button,#noa-header-language');
    assert.deepEqual(await buttons.allTextContents(),['앱 설치','공유','언어 선택']);
    const boxes=await buttons.evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect(),label=e.querySelector('span').getBoundingClientRect(),svg=e.querySelector('svg').getBoundingClientRect();return [r.x,r.y,r.width,r.height,label.width,label.height,svg.width]}));
    for(const [i,[x,y,w,h,lw,lh,sw]] of boxes.entries()){assert(w>=44&&h>=44&&lw>0&&lh>0&&sw>0);if(i)assert(x>=boxes[i-1][0]+boxes[i-1][2]-1&&Math.abs(y-boxes[0][1])<=1);}
    const world=drawer.locator('.noa-menu [data-noa-nav=world]'),music=drawer.locator('.noa-menu [data-noa-nav=music]');
    const a=await world.boundingBox(),b=await music.boundingBox();assert(a&&b&&Math.abs(a.x-b.x)<1&&Math.abs(a.width-b.width)<1&&Math.abs(a.height-b.height)<2);
    assert.equal(await drawer.locator('.noa-drawer-secondary a[href="/noa-world.php"]').count(),0);
    const legal=await drawer.locator('.noa-sidebar-legal a').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().x));assert(Math.max(...legal)-Math.min(...legal)<1);
    await drawer.locator('#noa-drawer-search').fill('세계관');assert(await world.isVisible());await music.waitFor({state:'hidden',timeout:5000});await drawer.locator('#noa-drawer-search').fill('');
    const search=drawer.locator('#noa-drawer-search');
    await search.fill('사연곡');
    assert(await music.isVisible());assert(await world.isHidden());
    const songRequest=drawer.locator('.noa-drawer-secondary a:visible');assert.equal(await songRequest.count(),1);
    await drawer.locator('.noa-drawer-search button').click();assert(await songRequest.evaluate(e=>e===document.activeElement));
    await search.fill('없는메뉴xyz');assert(await drawer.locator('.noa-menu-empty').isVisible());await search.fill('');
    assert(await drawer.locator('.noa-menu h2').isVisible());
    const group=music.locator('..'),branch=group.locator('.noa-drawer-secondary');
    assert((await branch.boundingBox()).x>(await music.boundingBox()).x);
    await drawer.locator('#noa-header-language').click();assert(await drawer.locator('#noa-language-options').isVisible());await drawer.locator('#noa-language-options button[data-language=ko]').click();
    if(member)assert.equal(await world.getAttribute('href'),'/noa-world.php');
    assert.equal(await drawer.evaluate(e=>e.scrollWidth>e.clientWidth+1),false);
    if(width===390){await drawer.evaluate(e=>e.scrollTop=0);await page.screenshot({path:out+'/menu-'+theme+'.png'});}
    console.log('DRAWER_LAYOUT_OK',phase,width,theme,path);
   }
  }catch(error){
   const page=context.pages()[0];if(page)console.error('DRAWER_STATE',width,await page.evaluate(()=>({url:location.pathname,theme:document.documentElement.dataset.noaTheme,controls:[...document.querySelectorAll('.noa-drawer-head,#noa-drawer-tools,#noa-header-language,[data-footer-theme]')].map(e=>[e.id||e.className,e.disabled,e.parentElement?.id]),query:document.querySelector('#noa-drawer-search')?.value,rows:[...document.querySelectorAll('.noa-menu a')].map(e=>[e.textContent,e.hidden,getComputedStyle(e).display])})));
   throw error;
  }finally{await context.close();}
 }));
}finally{await browser.close();}
