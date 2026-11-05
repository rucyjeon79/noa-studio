import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {verifyFixtures} from './fixtures.mjs';
import {verifyTables} from './tables.mjs';
import {verifyListeningLayout} from './listening-layout.mjs';
import {verifyDrawerPoints} from './drawer-points.mjs';
import {verifyComposer} from './composer.mjs';
import {verifyExperience} from './experience.mjs';
import {verifyRelationships,auditRelationships,verifyFooterClearance,verifyMusicFooter} from './relationships.mjs';
const phase=process.env.NOA_MEMBER_PHASE||'baseline',base='https://noastudio.ai.kr',out='member-surface-proof/'+phase;
mkdirSync(out,{recursive:true});
const paths=[...new Set([...(existsSync('/tmp/noa-member-native/routes.json')?JSON.parse(readFileSync('/tmp/noa-member-native/routes.json','utf8')):[]),'/','/noa-music.php','/noa-youtube.php','/noa-world.php','/noa-lounge.php','/noa-lounge.php?board=free','/noa-creator-lab.php','/noa-shop.php','/noa-youngcart.php','/noa-points.php','/noa-vip.php','/noa-membership.php','/noa-my.php','/noa-creator.php','/noa-gifts.php','/noa-subscription.php','/noa-notifications.php','/noa-settings.php','/noa-login.php','/noa-about.php','/noa-terms.php','/noa-privacy.php','/bbs/login.php?legacy=1','/bbs/register.php','/bbs/password_lost.php','/bbs/search.php','/bbs/faq.php','/bbs/board.php?bo_table=free','/bbs/write.php?bo_table=free','/shop/cart.php','/shop/orderinquiry.php','/shop/orderform.php'])];
const chosen=new Set(['/','/noa-my.php','/noa-youngcart.php','/noa-shop.php','/noa-lounge.php','/noa-login.php','/bbs/register.php','/bbs/password_lost.php','/shop/cart.php','/shop/orderinquiry.php','/bbs/search.php']);
const report={phase,public:[],fixtures:[],errors:[],writes:0,fontMode:'installed official Noto Sans KR; network fonts disabled'};
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});

try{
 if(phase!=='baseline'){await verifyListeningLayout(browser,out,report);await verifyTables(browser,out,report);await verifyDrawerPoints(browser,out,report);await verifyMusicFooter(browser,out,report);await verifyExperience(browser,phase,out,report);await verifyFixtures(browser,phase,out,report);await verifyComposer(browser,out,report);await verifyRelationships(browser,out,report);}
 await Promise.all([390,1440].map(async width=>{
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block',reducedMotion:'reduce'});
  context.setDefaultTimeout(15000);context.setDefaultNavigationTimeout(30000);
  await context.route('**/*',async r=>{
   const req=r.request(),u=new URL(req.url());
   if(!['GET','HEAD'].includes(req.method()))return r.abort();
   // The runner installs the pinned official Noto Sans KR face before this step.
   // Avoid stalled third-party font downloads delaying every screenshot.
   if(req.resourceType()==='font')return r.abort();
   if(phase==='candidate'&&u.origin===base&&['/noa-member-surfaces.css','/noa-member-surfaces.js','/noa-ui.js','/noa-starlight.css','/noa-ainoa.js','/noa-ainoa.css','/noa-voice.js','/noa-listening.js','/noa-music-vinyl.css'].includes(u.pathname))return r.fulfill({body:readFileSync('deploy'+u.pathname),contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript'});
   if(phase==='candidate'&&u.origin===base&&req.isNavigationRequest()){
    let res;try{res=await r.fetch({maxRedirects:0,timeout:25000,maxRetries:2});}catch{return r.abort('failed');}if(res.status()>=300&&res.status()<400)return r.fulfill({response:res});
    let html=await res.text();if(html.includes('</head>'))html=html.replace('</head>','<link rel="stylesheet" href="/noa-member-surfaces.css"><script defer src="/noa-member-surfaces.js"></script></head>');return r.fulfill({response:res,body:html});
   }
   return r.continue();
  });
  const page=await context.newPage();let pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));page.on('dialog',d=>d.dismiss());
  const close=page.locator('#noa-amt-fan .amt-close');
  for(const path of paths){
   try{
    pageErrors=[];const response=await page.goto(base+path,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.NoaUI?.getState(),null,{timeout:10000}).catch(()=>{});
    if(phase==='candidate'&&!await page.locator('[src*="noa-member-surfaces.js"]').count()){
     await page.addStyleTag({content:readFileSync('deploy/noa-member-surfaces.css','utf8')});
     await page.addScriptTag({content:readFileSync('deploy/noa-member-surfaces.js','utf8')});
    }
    if(await page.locator('#ec-content').count())await page.waitForFunction(()=>{const e=document.querySelector('#ec-content');return e.childElementCount>0&&!e.textContent.includes('불러오는 중입니다.');},null,{timeout:15000});
    for(const theme of ['noa-studio','noa-ivory']){
     await page.evaluate(t=>{if(window.NoaUI)window.NoaUI.apply({...window.NoaUI.getState(),theme:t});},theme);
     await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
     if(await close.isVisible())await close.click();
     const audit=await page.evaluate(()=>{
      const visible=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(e).visibility!=='hidden'};
      const scope=document.querySelector('main,#container,.mbskin,.new_win')||document.body;
      const overflow=[...scope.querySelectorAll('*')].filter(e=>visible(e)&&!e.closest('dialog:not([open]),#noa-menu-drawer,#noa-ainoa')&&e.getBoundingClientRect().right>innerWidth+2).slice(0,12).map(e=>({tag:e.tagName,id:e.id,class:e.className,right:Math.round(e.getBoundingClientRect().right)}));
      const fields=[...scope.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea')].filter(visible).map(e=>({id:e.id,name:e.name,kind:e.type,h:e.getBoundingClientRect().height,font:getComputedStyle(e).fontSize,radius:getComputedStyle(e).borderRadius}));
      return{title:document.title,theme:document.documentElement.dataset.noaTheme,heading:scope.querySelector('h1,h2,#container_title')?.textContent.trim(),documentOverflow:document.documentElement.scrollWidth>innerWidth+1,overflow,fields,forms:[...scope.querySelectorAll('form')].map(f=>({action:f.getAttribute('action'),method:f.method,fields:[...f.elements].map(e=>[e.name,e.type])})),memberAssets:!!window.NoaMemberSurfaces,captcha:document.querySelector('#captcha')?.outerHTML,text:scope.innerText.slice(0,180)};
     });
     report.public.push({requestedTheme:theme,path,actual:new URL(page.url()).pathname,width,status:response?.status(),theme,...audit,pageErrors:[...pageErrors]});
     if(phase!=='baseline'){await auditRelationships(page,{path,width,theme},report);if(['/noa-music.php','/noa-lounge.php','/noa-shop.php'].includes(path))await verifyFooterClearance(page,{path,width,theme},report);}
     if(path==='/'&&await page.locator('#noa-listening').isVisible())await page.locator('#noa-listening').screenshot({path:out+'/listening-'+width+'-'+theme+'.jpg',type:'jpeg',quality:85});
     if(chosen.has(path))await page.screenshot({path:out+'/'+width+'-'+theme+'-'+path.replace(/[^a-z0-9]/gi,'_')+'.jpg',type:'jpeg',quality:82});
     if(['/','/noa-music.php','/noa-youtube.php','/noa-lounge.php','/noa-shop.php'].includes(path)&&await page.locator('.noa-footer-scene').isVisible()){
      const greeting=page.locator('#noa-ainoa .ainoa-message-dismiss');if(await greeting.isVisible())await greeting.click();
      await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
      await page.waitForFunction(()=>{const img=document.querySelector('.noa-footer-landscape');return !img||(img.complete&&img.naturalWidth>0);});
      const blocked=await page.locator('.noa-footer-scene [data-footer-theme]').evaluateAll(nodes=>nodes.flatMap(e=>{const r=e.getBoundingClientRect();return [[r.left+4,r.top+4],[r.right-4,r.bottom-4]].filter(([x,y])=>!e.contains(document.elementFromPoint(x,y))).map(([x,y])=>({choice:e.dataset.footerTheme,x,y}));}));
      assert.deepEqual(blocked,[],'footer choices obstructed: '+JSON.stringify({path,width,theme,blocked}));
      await page.screenshot({path:out+'/footer-'+width+'-'+theme+'-'+path.replace(/[^a-z0-9]/gi,'_')+'.jpg',type:'jpeg',quality:85});
      await page.evaluate(()=>window.scrollTo(0,0));
     }
    }
    console.log('MEMBER_SURFACE_OBSERVED',width,path,new URL(page.url()).pathname);
   }catch(e){report.errors.push({path,width,error:String(e)});}
  }
  await context.close();
 }));
}finally{
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();
}
console.log('MEMBER_SURFACE_RESULT',JSON.stringify({phase,cases:report.public.length,errors:report.errors,overflow:report.public.filter(x=>x.documentOverflow).map(x=>[x.width,x.path,x.overflow])}));
if(phase!=='baseline'){assert.equal(report.errors.length,0);assert.deepEqual(report.public.filter(x=>x.status>=400).map(x=>[x.path,x.status]),[],'member route HTTP errors');assert.equal(report.public.filter(x=>x.documentOverflow).length,0);assert.equal(report.public.filter(x=>!x.memberAssets).length,0,'shared member assets missing');assert.equal(report.public.filter(x=>x.pageErrors.length).length,0,'browser runtime errors');}
