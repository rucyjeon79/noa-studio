import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
const html=readFileSync(process.argv[2],'utf8');
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.pathname==='/noa-music.php'&&route.request().isNavigationRequest())return route.fulfill({contentType:'text/html',body:html});
  if(u.origin==='https://noastudio.ai.kr'&&/\.(js|css)$/.test(u.pathname))return route.continue();
  return route.abort();
 });
 await page.goto('https://noastudio.ai.kr/noa-music.php?genre=kpop-original&act=4',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.noa-inline-song-row button[aria-label$=" 재생"]>span',{state:'attached'});
 const sample=()=>page.locator('.noa-inline-song-row').evaluateAll(rows=>rows.filter(r=>r.getClientRects().length).map(r=>({title:r.querySelector('.noa-track-name')?.textContent,count:r.querySelector('button[aria-label$=" 재생"]>span')?.textContent})));
 await page.waitForFunction(()=>[...document.querySelectorAll('.noa-inline-song-row button[aria-label$=" 재생"]>span')].some(x=>/^\d+$/.test(x.textContent)));
 console.log('VISIBLE_ACT4',JSON.stringify(await sample()));
 const target=await page.evaluate(()=>{const counts=JSON.parse(document.querySelector('#noa-track-counts').textContent);return records.find(r=>r.title==='난 다시 살아가'&&counts.plays[r.key]>0&&+r.ep>0)||records.find(r=>counts.plays[r.key]>0&&+r.ep>0);});
 if(!target)throw Error('positive EP missing');
 await page.goto('https://noastudio.ai.kr/noa-music.php?genre='+encodeURIComponent(target.genre)+'&act='+Math.ceil(target.ep/10),{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.noa-inline-song-row button[aria-label$=" 재생"]>span',{state:'attached'});
 await page.waitForFunction(()=>[...document.querySelectorAll('.noa-inline-song-row button[aria-label$=" 재생"]>span')].some(x=>/^\d+$/.test(x.textContent)));
 const view=await sample();console.log('VISIBLE_COUNT_CHECK',JSON.stringify({target:[target.title,target.genre,target.ep],view}));
 if(!view.some(r=>r.title?.includes(target.title)&&Number(r.count)>0))throw Error('positive song count not visible');
}finally{await browser.close();}
