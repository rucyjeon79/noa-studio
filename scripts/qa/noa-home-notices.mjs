import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.env.NOA_MEMBERSHIP_PHASE||'candidate',out='membership-proof/'+phase;mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
try{for(const [width,height]of [[360,844],[390,844],[430,844],[844,390],[1280,900]])for(const theme of ['noa-studio','noa-ivory']){
 const c=await browser.newContext({viewport:{width,height},locale:'ko-KR',serviceWorkers:'block'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
 if(phase==='candidate'){
  for(const file of ['noa-ui.js','noa-ui.css','noa-account.js','noa-account.css'])await c.route('**/'+file+'*',r=>r.fulfill({path:'deploy/'+file,contentType:file.endsWith('.js')?'text/javascript':'text/css'}));
  await c.route('https://noastudio.ai.kr/',r=>r.fulfill({path:'membership-proof/home.html',contentType:'text/html; charset=utf-8'}));
  await c.route('**/noa-bridge/membership.php*',r=>r.fulfill({json:{ok:true,member:false}}));
 }
 await p.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded'});await p.locator('.noa-topbar #noa-account-bar').waitFor();await p.locator('.noa-hero-services svg').waitFor();
 await p.waitForFunction(()=>document.documentElement.dataset.noaPrecision);
 assert.equal(await p.locator('body>#noa-account-bar').count(),0,'no duplicate header');assert.equal(await p.locator('.noa-topbar a[href*="login"]').count(),1);
 assert.equal(await p.locator('[data-home-section=hero]+[data-home-section=notices]').count(),1,'notice directly below hero');
 assert.equal(await p.locator('.noa-hero-services [data-noa-icon=sitemap]').count(),1);
 if(width<height){const geometry=await p.evaluate(()=>{const h=document.querySelector('.noa-hero'),a=h.querySelector('.noa-hero-art'),copy=h.querySelector('.noa-hero-copy');return {h:h.clientHeight,art:a.clientHeight,bg:getComputedStyle(copy).backgroundColor};});assert(geometry.art>=geometry.h-2,'full portrait media');assert(/0\.74|74%/.test(geometry.bg),'translucent copy '+geometry.bg);}
 const action=p.locator('.noa-hero-services a');assert.equal(await action.evaluate(e=>getComputedStyle(e).flexDirection),'row','wide hero action horizontal');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');await p.screenshot({path:out+'/home-'+theme+'-'+width+'.png',fullPage:true});
 if(phase==='candidate'){
  assert.equal(await p.locator('.noa-notice').count(),5);assert.equal(await p.locator('.noa-notice-featured').count(),1);assert.equal(await p.locator('.noa-notice:not(.noa-notice-featured) .noa-notice-excerpt').count(),0);
  await p.locator('#noa-notice-5 summary').click();await p.locator('#noa-disclosure-close').waitFor();await p.evaluate(()=>scrollBy(0,550));const box=await p.locator('#noa-disclosure-close').boundingBox();assert(box.y>=0&&box.y+box.height<=height,'close follows viewport');await p.screenshot({path:out+'/expanded-'+theme+'-'+width+'.png'});await p.locator('#noa-disclosure-close').click();assert.equal(await p.locator('.noa-notice[open]').count(),0);assert(await p.locator('#noa-disclosure-close').isHidden());
  await p.locator('#noa-notice-4 summary').click();assert(await p.locator('#noa-notice-4 .noa-notice-body').isVisible());await p.keyboard.press('Escape');assert.equal(await p.locator('.noa-notice[open]').count(),0);
 }
 assert.deepEqual(errors,[]);report.push({phase,width,height,theme,headerIntegrated:true,portraitFullMedia:width<height,noticeCount:await p.locator('.noa-notice').count(),fixtureDisclosureVerified:phase==='candidate'});await c.close();
}writeFileSync(out+'/home-report.json',JSON.stringify(report,null,2));console.log('HOME_NOTICE_RESPONSIVE_OK',phase,report.length);
}catch(e){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:out+'/home-failure.png',fullPage:true});writeFileSync(out+'/home-failure.html',await p.content());}catch{}throw e;}finally{await browser.close();}
