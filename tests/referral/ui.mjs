import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});mkdirSync('referral-proof',{recursive:true});
const live=process.env.LIVE_ONLY==='1',url='https://noastudio.ai.kr/?invite='+'a'.repeat(48);
try{for(const width of [320,390,1280]){
 const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(!live){await p.route('https://noastudio.ai.kr/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/noa-bridge/referral.php')return route.fulfill({json:{ok:true,member:true,url}});if(path.startsWith('/noa-')&&/\.(css|js)$/.test(path))return route.fulfill({body:readFileSync('deploy'+path),contentType:path.endsWith('.css')?'text/css; charset=utf-8':'application/javascript; charset=utf-8'});return route.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-account.css"><link rel="stylesheet" href="/noa-referral.css"><script src="/noa-account.js" defer></script><script src="/noa-referral.js" defer></script><style>body{margin:0;background:#111315;color:white;font-family:Arial}main{padding:80px 20px;max-width:1100px;margin:auto}</style><main><h1>NOA STUDIO</h1><section data-home-section="notices">공지사항</section><a data-home-banner="goods" href="/noa-shop.php">마플샵</a><section data-home-section="world">세계관</section><section data-home-section="recommendations"><h2>추천 음악</h2></section></main>'});});}
 await p.goto('https://noastudio.ai.kr/',{waitUntil:'networkidle'});await p.locator('#noa-referral-banner').waitFor();assert.equal(await p.locator('#noa-referral-share').count(),1);
 assert(await p.evaluate(()=>document.querySelector('[data-home-banner="goods"]').nextElementSibling.matches('[data-home-section="recommendations"]')&&document.querySelector('#noa-referral-banner').previousElementSibling.matches('[data-home-section="notices"]')),'banner_position');
 assert(await p.evaluate(()=>document.querySelector('#noa-referral-share').nextElementSibling.id==='noa-nav-account'),'share_before_account');
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow '+width);
 const geometry=await p.locator('#noa-account-bar').evaluate(bar=>[...bar.querySelectorAll(':scope > :not(.noa-account-shortcuts), .noa-account-shortcuts > *')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({x:x.getBoundingClientRect().x,right:x.getBoundingClientRect().right})));for(let i=1;i<geometry.length;i++)assert(geometry[i].x>=geometry[i-1].right-1,'header_overlap '+width);
 await p.screenshot({path:`referral-proof/${live?'live':'fixture'}-home-${width}.png`,fullPage:false});
 await p.locator('#noa-referral-banner').click();await p.locator('#noa-referral-dialog').waitFor();
 if(live)assert(await p.getByRole('link',{name:'로그인하고 내 초대 링크 받기'}).count());else{assert.equal(await p.locator('#nrf-url').inputValue(),url+'&card=2');await p.addInitScript(()=>{});}
 await p.screenshot({path:`referral-proof/${live?'live':'fixture'}-share-${width}.png`});
 await p.getByRole('button',{name:'초대 창 닫기'}).click();await p.locator('#noa-referral-share').click();await p.locator('#noa-referral-dialog').waitFor();if(!live)assert.equal(await p.locator('#nrf-url').inputValue(),url+'&card=2');
 if(!live){
 await p.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value;}}}));
 await p.getByRole('button',{name:'링크 복사',exact:true}).click();assert.equal(await p.evaluate(()=>window.__copied),url+'&card=2');
 await p.getByRole('button',{name:'초대 창 닫기'}).click();
 await p.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async value=>{window.__shared=value;}}));
 await p.locator('#noa-referral-share').click();assert.equal(await p.evaluate(()=>window.__shared.url),url+'&card=2');assert.equal(await p.locator('#noa-referral-dialog').count(),0);
 await p.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('cancel','AbortError');}}));
 await p.locator('#noa-referral-banner').click();assert.equal(await p.locator('#noa-referral-dialog').count(),0);
 }
 assert.deepEqual(errors,[]);await context.close();
 }console.log(live?'REFERRAL_LIVE_GUEST_LAYOUT_OK':'REFERRAL_SHARED_LINK_HEADER_BANNER_RESPONSIVE_OK');}finally{await browser.close();}
