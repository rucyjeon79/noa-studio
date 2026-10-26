import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.env.NOA_MEMBERSHIP_PHASE||'candidate',out='membership-proof/'+phase;
mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
try{
 for(const width of [360,390,430])for(const theme of ['noa-studio','noa-ivory']){
  const context=await browser.newContext({viewport:{width,height:844},locale:'ko-KR',timezoneId:'Asia/Seoul',serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
  if(phase==='candidate')for(const path of ['noa-account.js','noa-account.css','noa-membership.js'])await context.route('**/'+path+'*',r=>r.fulfill({path:'deploy/'+path,contentType:path.endsWith('.css')?'text/css':'text/javascript'}));
  let data={ok:true,member:false};let purchases=0,autos=0;
  if(phase==='candidate'){
   for(const path of ['noa-membership.php','noa-login.php'])await context.route('**/'+path+'*',r=>r.fulfill({path:'membership-proof/'+path+'.html',contentType:'text/html; charset=utf-8'}));
   await context.route('**/noa-bridge/membership.php*',async r=>{if(r.request().method()==='GET')return r.fulfill({json:structuredClone(data)});const action=new URL(r.request().url()).searchParams.get('action'),b=r.request().postDataJSON();assert.equal(r.request().headers()['x-noa-csrf'],'fixture-csrf');
    if(action==='vip'){assert.equal(b.quotedPoints,3000);assert.equal(b.durationDays,30);assert.equal(b.confirmed,true);purchases++;await new Promise(resolve=>setTimeout(resolve,300));data.balance-=3000;data.level=4;data.grant={status:'active',until:Math.floor(Date.now()/1000)+2592000};data.remainingDays=30;}
    else if(action==='auto'){assert.equal(b.enabled,true);autos++;data.autoRenew={revision:1,values:{enabled:true}};}else throw Error('unexpected_action');return r.fulfill({json:{ok:true}});
   });
  }
  await page.goto('https://noastudio.ai.kr/noa-login.php',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'음악으로 이어지는 순간'}).waitFor();await page.locator('#noa-account-bar').waitFor();
  assert.equal(await page.locator('.noa-social-options button:disabled').count(),2);assert.equal(await page.locator('.noa-social-options').getByText('로그인 연결 준비 중',{exact:false}).count(),2);
  await page.getByText('기존 계정 · 관리자 로그인',{exact:true}).click();assert(await page.getByRole('link',{name:'기존 아이디로 로그인'}).isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:out+'/login-'+theme+'-'+width+'.png',fullPage:true});
  if(phase==='candidate'){
   data={ok:true,member:true,admin:false,enabled:true,csrf:'fixture-csrf',name:'정회원',level:3,balance:6200,grant:null,remainingDays:0,pendingLogin:100,autoRenew:{revision:0,values:{enabled:false}},policyRevision:2,vipPoints:3000,durationDays:30,payment:{enabled:false,provider:'',instructions:''},ledger:[{po_content:'첫 댓글 · 로그인 보너스',po_point:130,po_datetime:'2026-10-26 18:00:00'}],topups:[]};
   await page.goto('https://noastudio.ai.kr/noa-membership.php',{waitUntil:'domcontentloaded'});await page.getByText('잔액과 이용 기간을 확인하세요.',{exact:true}).waitFor();await page.locator('#noa-account-bar').getByText('6,200P · 내역',{exact:true}).waitFor();
   assert(await page.locator('#membership-buy').isDisabled());assert(await page.locator('#membership-topup-submit').isDisabled());assert((await page.locator('#membership-pending').innerText()).includes('100P 대기'));
   await page.locator('#membership-confirm').check();await page.locator('#membership-buy').click();assert(await page.locator('#membership-buy').isDisabled());await page.getByText('VIP 30일 이용권을 적용했습니다.',{exact:true}).waitFor();await page.locator('#noa-account-bar').getByText('3,200P · 내역',{exact:true}).waitFor();assert.equal(purchases,1);
   await page.locator('#membership-auto').check();await page.getByText('자동연장을 켰습니다.',{exact:false}).waitFor();assert.equal(autos,1);await page.locator('#noa-account-bar').getByText('구독 중 · 30일 남음',{exact:true}).waitFor();
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.evaluate(()=>scrollTo(0,500));assert(Math.abs((await page.locator('#noa-account-bar').boundingBox()).y)<2);
   await page.waitForFunction(()=>!document.querySelector('#membership-auto').disabled);
   const heights=await page.evaluate(()=>['#membership-buy','#noa-account-bar a:first-child'].map(s=>document.querySelector(s).getBoundingClientRect().height));assert(heights.every(h=>h>=44));
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/membership-'+theme+'-'+width+'.png',fullPage:true});
  }else{
   const api=await context.request.get('https://noastudio.ai.kr/noa-bridge/membership.php');assert.equal(api.status(),200);assert.equal((await api.json()).member,false);
   for(const p of ['/bbs/register.php','/bbs/register_form.php']){const res=await context.request.get('https://noastudio.ai.kr'+p,{maxRedirects:0});assert.equal(res.status(),302);assert(res.headers().location.startsWith('/noa-login.php'));}
   const direct=await context.request.post('https://noastudio.ai.kr/bbs/register_form_update.php',{form:{w:'',provider:'Google'},maxRedirects:0});assert.equal(direct.status(),403);
   const fakeSocial=await context.request.post('https://noastudio.ai.kr/plugin/social/register_member_update.php',{form:{provider:'Google'},maxRedirects:0});assert.equal(fakeSocial.status(),403);
   const legacy=await context.request.get('https://noastudio.ai.kr/bbs/login.php?legacy=1');assert.equal(legacy.status(),200);assert((await legacy.text()).includes('login_fs'));
  }
  assert.deepEqual(errors,[]);report.push({width,theme,phase,noOverflow:true,legacyLoginPreserved:true,socialOnlyServerGuards:phase==='live',unconfiguredProvidersVisible:true,accountBarVisible:true,simulatedVipFlow:phase==='candidate'});await context.close();
 }
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2));console.log('MEMBERSHIP_SOCIAL_MOBILE_BROWSER_OK',phase,report.length);
}finally{await browser.close();}
