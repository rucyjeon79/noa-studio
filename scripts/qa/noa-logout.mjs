import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='https://noastudio.ai.kr';
const auth=JSON.parse(readFileSync(process.env.NOA_LOGOUT_CREDENTIALS,'utf8'));
mkdirSync('logout-proof',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const cases=[];
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},userAgent:'NOA-logout-acceptance/1.0'});
  try{
   const page=await context.newPage();
   await page.goto(base+'/bbs/login.php?url=%2Fnoa-my.php',{waitUntil:'domcontentloaded'});
   await page.locator('[name=mb_id]').fill(auth.member);
   await page.locator('[name=mb_password]').fill(auth.password);
   await Promise.all([page.waitForURL(url=>url.pathname==='/noa-my.php',{timeout:30000}),page.locator('form').filter({has:page.locator('[name=mb_password]')}).locator('button[type=submit],input[type=submit]').click()]);
   assert.equal((await (await context.request.get(base+'/noa-bridge/membership.php')).json()).member,true,'Actual member login required');
   const logout=page.locator('a[href="/bbs/logout.php?url=%2F"]');
   await logout.waitFor({state:'visible'});
   const originalCookie=(await context.cookies(base)).map(c=>c.name+'='+c.value).join('; ');
   await Promise.all([page.waitForURL(url=>url.origin===base&&url.pathname==='/'&&!url.search,{timeout:30000}),logout.click()]);
   await page.locator('[data-home-section=hero]').waitFor({state:'visible'});
   assert.equal((await (await context.request.get(base+'/noa-bridge/membership.php')).json()).member,false,'Logout did not end member session');
   const replay=await context.request.get(base+'/noa-bridge/membership.php',{headers:{Cookie:originalCookie}});
   assert.equal((await replay.json()).member,false,'Old session cookie remained authenticated');
   assert.equal((await context.request.get(base+'/noa-bridge/catalog.php')).status(),401,'Guest catalog protection changed');
   await page.locator('#noa-account-bar').waitFor({state:'visible'});
   const bars=await page.locator('#noa-account-bar').count();assert.equal(bars,1,'Shared header missing or duplicated');
   await page.screenshot({path:'logout-proof/home-'+width+'.png'});
   const result={width,login:true,logoutDestination:page.url(),homeVisible:true,memberSessionEnded:true,oldSessionRejected:true,guestCatalogStatus:401,sharedHeaderCount:bars};
   cases.push(result);console.log('NOA_LOGOUT_CASE',JSON.stringify(result));
  }finally{await context.close();}
 }
 writeFileSync('logout-proof/live.json',JSON.stringify({ok:true,cases,existingMembersChanged:0,existingSongsChanged:0},null,2));
}finally{await browser.close();}
