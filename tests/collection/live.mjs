import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('collection-proof',{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:880},serviceWorkers:'block'});
  await page.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded'});
  const library=page.locator('.noa-record-library');
  await library.scrollIntoViewIfNeeded();
  const sleeves=library.locator('.record-sleeve');
  assert.equal(await sleeves.count(),4);
  for(const [i,id] of ['original','ep','story','cover'].entries()){
   const sleeve=sleeves.nth(i);
   assert.equal(await sleeve.getAttribute('data-collection'),id);
   const url=new URL(await sleeve.getAttribute('href'),page.url());
   assert.equal(url.pathname,'/noa-login.php');
   assert.equal(url.searchParams.get('url'),'/noa-music.php?group='+id);
   await sleeve.locator('img').evaluate(img=>img.decode());
  }
  const cells=await sleeves.evaluateAll(items=>items.map(e=>({x:e.offsetLeft,y:e.offsetTop})));
  assert.equal(cells[0].y,cells[1].y);
  if(width===1280)assert.equal(cells[0].y,cells[3].y);else assert(cells[2].y>cells[0].y);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await library.screenshot({path:'collection-proof/library-'+width+'.png'});
  await sleeves.first().click();
  assert.equal(new URL(page.url()).searchParams.get('url'),'/noa-music.php?group=original');
  await page.close();
 }
 console.log('LIVE_RECORD_LIBRARY_VERIFIED');
}finally{await browser.close();}
