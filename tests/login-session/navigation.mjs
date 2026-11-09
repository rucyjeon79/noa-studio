import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1280])for(const provider of ['google','kakao']){
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
  await context.route('https://noastudio.ai.kr/**',route=>{
   const p=new URL(route.request().url()).pathname;
   const html=p==='/frame'?readFileSync('login-proof/fixture/drawer-ready.html','utf8'):p==='/bbs/login.php'?'<h1>Provider redirect fixture</h1>':'<iframe src="/frame" title="app content"></iframe>';
   return route.fulfill({contentType:'text/html',body:html});
  });
  await page.goto('https://noastudio.ai.kr/');
  await page.frameLocator('iframe').locator('.noa-social-'+provider).click();
  await page.waitForURL('**/bbs/login.php?*');
  assert.equal(context.pages().length,1);assert.equal(page.frames().length,1);
  assert.equal(new URL(page.url()).searchParams.get('provider').toLowerCase(),provider);
  await context.close();
 }
 console.log('LOGIN_MOBILE_DESKTOP_GOOGLE_KAKAO_EXIT_IFRAME_WITHOUT_NEW_WINDOW_OK');
}finally{await browser.close();}
