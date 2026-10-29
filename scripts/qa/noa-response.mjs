import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const server=spawn('php',['-S','127.0.0.1:8079','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'});let browser;mkdirSync('response-proof',{recursive:true});
try{browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});let summaries=0,welcome=0,statuses=0,homeCalls=0;
 await page.route('**/noa-bridge/home.php',r=>{homeCalls++;return r.fulfill({json:{ok:true,ep:[],stories:[],covers:[],playlists:[],featured:[],genreFeatured:{}}});});
 await page.route('**/noa-bridge/membership.php*',async r=>{summaries++;assert.equal(new URL(r.request().url()).searchParams.get('action'),'summary');await new Promise(s=>setTimeout(s,250));await r.fulfill({json:{ok:true,member:false}});});
 await page.route('**/noa-ainoa.php*',async r=>{const a=new URL(r.request().url()).searchParams.get('action');if(a==='welcome'){welcome++;return welcome===1?r.fulfill({status:503,json:{ok:false}}):r.fulfill({json:{ok:true,member:false,accountKey:'guest',capabilities:{member:false}}});}statuses++;await new Promise(s=>setTimeout(s,250));return r.fulfill({json:{ok:true,member:false,csrf:'fixture'}});});
 await page.goto('http://127.0.0.1:8079/');await page.waitForFunction(()=>window.NoaVoice?.getAccount());assert.equal(welcome,2);assert.equal(summaries,1);await page.waitForFunction(()=>document.body.dataset.noaHomeReady==='true');assert.equal(homeCalls,1);
 await page.evaluate(()=>{dispatchEvent(new Event('pageshow'));document.dispatchEvent(new Event('visibilitychange'));});await page.waitForTimeout(400);assert.equal(summaries,1);
 await page.evaluate(()=>{dispatchEvent(new Event('noa-membership-change'));dispatchEvent(new Event('noa-membership-change'));});await page.waitForTimeout(500);assert.equal(summaries,2);
 await page.evaluate(()=>{const host=document.createElement('div');document.body.append(host);window.NoaAInoa.dock(host);window.NoaAInoa.dock(host);});await page.waitForTimeout(600);assert.equal(statuses,1);
 await page.evaluate(()=>window.NoaVoice.say('등록된 곡의 이야기를 충분히 소개합니다.',{kind:'song',priority:true,force:true}));assert((await page.locator('.ainoa-message p').innerText()).includes('등록된 곡의 이야기'));assert((await page.locator('.ainoa-message p').innerText()).length>45);
 const report={homeRequests:homeCalls,welcomeRetry:welcome,initialSummary:1,forcedSummary:1,statusRequests:statuses,artistSongMessage:true};writeFileSync('response-proof/candidate.json',JSON.stringify(report));console.log('NOA_RESPONSE_CANDIDATE_OK',JSON.stringify(report));
}finally{await browser?.close();server.kill();}
