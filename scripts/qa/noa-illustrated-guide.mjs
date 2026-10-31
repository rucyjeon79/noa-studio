import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const receipt=JSON.parse(fs.readFileSync('points-proof/receipt.json','utf8'));
const b=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 for(const width of [390,1280]){
  const p=await b.newPage({viewport:{width,height:880}});
  await p.goto('https://noastudio.ai.kr/noa-lounge.php?board=notice&nativePost=1');
  const guide=p.locator('.noa-welcome-guide:visible');await guide.waitFor();
  const imgs=guide.locator('img');assert.equal(await imgs.count(),6);
  await imgs.evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  assert(await guide.getByText('포인트 모으는 방법',{exact:true}).getAttribute('href')==='/noa-lounge.php?post='+receipt.id);
  await guide.scrollIntoViewIfNeeded();await p.screenshot({path:'points-proof/guide-'+width+'.png'});
  await p.goto(receipt.url);await p.getByRole('heading',{name:'별무리 포인트 모으기 · 첫 활동 네 번으로 1,900P'}).waitFor();
  const image=p.locator('.ec-detail .ec-gallery img').first();await image.waitFor();await image.evaluate(async i=>{await i.decode();if(i.naturalWidth!==960)throw Error('wrong_chart');});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await p.close();
 }
 console.log('LIVE_ILLUSTRATIONS_AND_PUBLISHED_POINTS_ARTICLE_VERIFIED');
}finally{await b.close();}
