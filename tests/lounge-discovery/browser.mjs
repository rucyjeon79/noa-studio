import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const live=process.env.NOA_DISCOVERY_LIVE==='1', base=live?'https://noastudio.ai.kr':'http://127.0.0.1:8174';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const page=await browser.newPage({viewport:{width,height:900}});const response=await page.goto(base+'/noa-lounge-discovery.php?view=week');
  assert.equal(response.status(),200);await page.getByRole('heading',{name:'주간 인기글',exact:true}).waitFor();
  for(const [view,label] of [['month','월간 인기글'],['likes','공감 많은 글'],['comments','최근 댓글'],['new','새 글']]){
   await page.getByRole('link',{name:label,exact:true}).click();
   assert.equal(new URL(page.url()).searchParams.get('view'),view);await page.getByRole('heading',{name:label,exact:true}).waitFor();
   if(!live){const first=page.locator('.nld-list a').first();assert.match(await first.getAttribute('href'),/^\/noa-lounge\.php\?/);}
  }
  if(!live){
   await page.getByRole('link',{name:'최근 댓글',exact:true}).click();await page.getByLabel('검색 범위').selectOption('body');await page.getByLabel('검색어',{exact:true}).fill('따뜻한');
   await page.getByRole('button',{name:'검색',exact:true}).click();assert.equal(await page.locator('.nld-list li').count(),1);assert.match(await page.locator('.nld-list').innerText(),/따뜻한 노래/);
   await page.getByRole('link',{name:'검색 해제'}).click();assert.equal(await page.locator('.nld-list li').count(),3);
  }
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.goto(base+'/noa-lounge-discovery.php?view=replies');await page.getByRole('link',{name:'로그인하고 보기'}).waitFor();assert.equal(await page.locator('.nld-list li').count(),0);
  await page.close();
 }
}finally{await browser.close();}
console.log('NOA_LOUNGE_DISCOVERY_BROWSER_OK');
