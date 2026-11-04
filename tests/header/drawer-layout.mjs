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
   page.on('pageerror',error=>console.log('PAGE_ERROR',width,error.message));
   for(const [theme,path] of [['noa-studio','/noa-shop.php'],['noa-ivory','/noa-login.php']]){
    await page.goto('https://noastudio.ai.kr'+path,{waitUntil:'domcontentloaded'});
    const drawer=page.locator('#noa-menu-drawer');
    await page.waitForFunction(()=>!document.querySelector('[data-footer-theme]')?.disabled && !!document.querySelector('#noa-menu-drawer #noa-drawer-tools'));
    await page.locator('[data-footer-theme="'+theme+'"]').evaluate(b=>b.click());
    await page.waitForFunction(t=>document.documentElement.dataset.noaTheme===t&&!document.querySelector('#noa-header-language')?.disabled,theme);

    if(width<1200)await page.locator('#noa-nav-all').click();
    const logo=drawer.locator('.noa-brand-mark');
    await logo.evaluate(img=>img.decode());
    assert.equal(await logo.count(),1);assert((await logo.boundingBox()).width>=36);
    const parts=await drawer.locator(':scope > *').evaluateAll(nodes=>nodes.slice(0,5).map(e=>e.id||e.className));
    assert.deepEqual(parts,['noa-drawer-head','noa-drawer-profile','noa-drawer-search','noa-drawer-tools','noa-menu']);
    const form=drawer.locator('.noa-drawer-login'),entry=drawer.locator('.noa-drawer-my');
    assert(await form.isVisible());assert.equal(await form.getAttribute('method'),'post');assert.equal(await form.getAttribute('action'),'/bbs/login_check.php');
    assert(await form.locator('[autocomplete=current-password]').isVisible());assert(await entry.isHidden());
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
    await drawer.locator('#noa-header-language').click();assert(await drawer.locator('#noa-language-options').isVisible());await drawer.locator('#noa-language-options button[data-language=ko]').click();
    // Exercise the signed-in view without a real login or account changes.
    await page.evaluate(()=>window.dispatchEvent(new CustomEvent('noa-membership-status',{detail:{member:true}})));
    assert(await form.isHidden());assert(await entry.isVisible());assert.equal(await entry.getAttribute('href'),'/noa-my.php');assert.equal(await world.getAttribute('href'),'/noa-world.php');
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
