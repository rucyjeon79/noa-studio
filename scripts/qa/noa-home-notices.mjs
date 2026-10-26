import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.env.NOA_MEMBERSHIP_PHASE||'candidate',out='membership-proof/'+phase;mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
async function header(p){
 const bar=p.locator('body>#noa-account-bar');assert.equal(await bar.count(),1,'one shared fixed header');
 assert.equal(await p.locator('.noa-topbar,.noa-g5-top').count(),0,'no duplicate home or native header');
 assert.equal(await bar.getByRole('link',{name:'홈으로',exact:true}).getAttribute('href'),'/');
 assert.equal(await bar.getByRole('link',{name:'사이트맵',exact:true}).getAttribute('href'),'/noa-sitemap.php');
 assert.equal(await bar.locator('.noa-account-shortcuts svg').count(),2);
 await bar.locator('.noa-account-brand img').evaluate(img=>img.decode());
 const boxes=await bar.locator('a').evaluateAll(links=>links.map(a=>{const r=a.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};}));
 assert(boxes.every(b=>b.h>=44&&b.x>=0&&b.right<=p.viewportSize().width+1),'header touch targets and horizontal fit');
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(a.x<b.right-1&&a.right>b.x+1&&a.y<b.bottom-1&&a.bottom>b.y+1),'header links must not overlap');}
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await p.evaluate(()=>scrollTo(0,350));assert(Math.abs((await bar.boundingBox()).y)<2,'header remains visible while scrolling');await p.evaluate(()=>scrollTo(0,0));
}
try{for(const [width,height]of [[360,844],[390,844],[430,844],[844,390],[1280,900]])for(const theme of ['noa-studio','noa-ivory']){
 const c=await browser.newContext({viewport:{width,height},locale:'ko-KR',serviceWorkers:'block'}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
 let account={ok:true,member:false};
 if(phase==='candidate'){
  for(const file of ['noa-ui.js','noa-ui.css','noa-account.js','noa-account.css'])await c.route('**/'+file+'*',r=>r.fulfill({path:'deploy/'+file,contentType:file.endsWith('.js')?'text/javascript':'text/css'}));
  await c.route('https://noastudio.ai.kr/',r=>r.fulfill({path:'membership-proof/home.html',contentType:'text/html; charset=utf-8'}));
  await c.route('**/noa-bridge/membership.php*',r=>r.fulfill({json:structuredClone(account)}));
 }
 await p.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded'});await p.locator('body>#noa-account-bar').waitFor();await p.locator('.noa-hero-services svg').waitFor();
 await p.waitForFunction(()=>document.documentElement.dataset.noaPrecision);
 await header(p);assert.equal(await p.locator('.noa-account-status a[href*="login"]').count(),1);
 assert.equal(await p.locator('[data-home-section=hero]+[data-home-section=notices]').count(),1,'notice directly below hero');
 assert.equal(await p.locator('.noa-hero-services [data-noa-icon=sitemap]').count(),1);
 if(width<height){const geometry=await p.evaluate(()=>{const h=document.querySelector('.noa-hero'),a=h.querySelector('.noa-hero-art'),copy=h.querySelector('.noa-hero-copy');return {h:h.clientHeight,art:a.clientHeight,bg:getComputedStyle(copy).backgroundColor,blur:getComputedStyle(copy).backdropFilter};});assert(geometry.art>=geometry.h-2,'full portrait media');assert(/(?:0\.1(?:0)?|10%)\s*\)$/.test(geometry.bg),'90 percent transparent copy '+geometry.bg);assert.equal(geometry.blur,'none','background image stays sharp');}
 const action=p.locator('.noa-hero-services a');assert.equal(await action.evaluate(e=>getComputedStyle(e).flexDirection),'row','wide hero action horizontal');
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');await p.screenshot({path:out+'/home-'+theme+'-'+width+'.png',fullPage:true});
 if(phase==='candidate'){
  assert.equal(await p.locator('.noa-notice').count(),5);assert.equal(await p.locator('.noa-notice-featured').count(),1);assert.equal(await p.locator('.noa-notice:not(.noa-notice-featured) .noa-notice-excerpt').count(),0);
  await p.locator('#noa-notice-5 summary').click();await p.locator('#noa-disclosure-close').waitFor();await p.evaluate(()=>scrollBy(0,550));const box=await p.locator('#noa-disclosure-close').boundingBox();assert(box.y>=0&&box.y+box.height<=height,'close follows viewport');await p.screenshot({path:out+'/expanded-'+theme+'-'+width+'.png'});await p.locator('#noa-disclosure-close').click();assert.equal(await p.locator('.noa-notice[open]').count(),0);assert(await p.locator('#noa-disclosure-close').isHidden());
  await p.locator('#noa-notice-4 summary').click();assert(await p.locator('#noa-notice-4 .noa-notice-body').isVisible());await p.keyboard.press('Escape');assert.equal(await p.locator('.noa-notice[open]').count(),0);
  account={ok:true,member:true,name:'최고관리자',balance:600,grant:null,remainingDays:0};await p.evaluate(()=>dispatchEvent(new Event('noa-membership-change')));await p.getByText('최고관리자 · MY',{exact:true}).waitFor();await header(p);
  await p.screenshot({path:out+'/home-member-'+theme+'-'+width+'.png',fullPage:true});
  if(width===390){await p.setViewportSize({width:320,height:740});account={...account,name:'이름이 긴 회원의 계정',balance:12345678,grant:{status:'active'},remainingDays:30};await p.evaluate(()=>dispatchEvent(new Event('noa-membership-change')));await p.getByText('구독 중 · 30일 남음',{exact:true}).waitFor();await header(p);await p.screenshot({path:out+'/header-long-'+theme+'-320.png'});await p.setViewportSize({width,height});}
 }else if(width===390&&theme==='noa-studio'){
  await p.locator('#noa-account-bar').getByRole('link',{name:'사이트맵',exact:true}).click();await p.waitForURL('**/noa-login.php?**');assert.equal(new URL(p.url()).searchParams.get('url'),'/noa-sitemap.php','existing members-only sitemap access preserved');assert.equal(await p.locator('form[name=flogin] input[name=url]').inputValue(),'/noa-sitemap.php');await p.locator('#noa-account-bar').waitFor();await header(p);await p.locator('#noa-account-bar').getByRole('link',{name:'홈으로',exact:true}).click();await p.waitForURL('https://noastudio.ai.kr/');await p.locator('#noa-account-bar').waitFor();await header(p);
 }
 assert.deepEqual(errors,[]);report.push({phase,width,height,theme,headerIntegrated:true,headerNavigationVerified:true,memberHeaderFixture:phase==='candidate',portraitTransparency:width<height?90:null,portraitFullMedia:width<height,noticeCount:await p.locator('.noa-notice').count(),fixtureDisclosureVerified:phase==='candidate'});await c.close();
}writeFileSync(out+'/home-report.json',JSON.stringify(report,null,2));console.log('HOME_NOTICE_RESPONSIVE_OK',phase,report.length);
}catch(e){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:out+'/home-failure.png',fullPage:true});writeFileSync(out+'/home-failure.html',await p.content());}catch{}throw e;}finally{await browser.close();}
