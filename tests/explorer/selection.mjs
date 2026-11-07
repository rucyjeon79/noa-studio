import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync('explorer-proof/candidate',{recursive:true});
try{for(const width of [390,1280]){
 const page=await browser.newPage({viewport:{width,height:820}}),errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://explorer.test/**',route=>{
  const path=new URL(route.request().url()).pathname;requests.push(path);
  if(path==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><button id="open">열기</button><div id="search"></div><div id="tree"></div>'});
  if(['/noa-channel-explorer.js','/noa-explorer.css'].includes(path))return route.fulfill({path:'deploy'+path,contentType:path.endsWith('.js')?'text/javascript':'text/css'});
  return route.abort();
 });
 await page.goto('https://explorer.test/');await page.addScriptTag({url:'/noa-channel-explorer.js'});
 await page.evaluate(()=>{
  window.rows=Array.from({length:85},(_,i)=>({key:'song:'+i,title:i<2?'같은 제목':'곡 '+i,ep:i<2?40:i+1,genre:'groovy-airy-pop'}));
  window.result='pending';document.querySelector('#open').onclick=()=>{N80Explorer.choose({records:rows,multiple:true,selected:[rows[1]],title:'수록곡'}).then(value=>window.result=value);};
 });
 await page.locator('#open').click();assert.equal(await page.locator('.n80-results button').count(),40);
 await page.getByRole('button',{name:'더 보기',exact:true}).click();assert.equal(await page.locator('.n80-results button').count(),80);
 await page.getByRole('searchbox',{name:'N80 탐색기 검색'}).fill('EP040 ACT 4');assert.equal(await page.locator('.n80-results button').count(),3);
 await page.locator('[data-n80-key="song:0"]').click();await page.getByRole('searchbox').fill('없음');await page.getByRole('button',{name:'2개 선택 적용',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>result.map(row=>row.key)),['song:1','song:0']);
 await page.locator('#open').click();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>result),null);
 assert(!requests.some(path=>path.includes('bridge')),'provided candidates never read the administrator catalog');
 // A stale remote result, a rejected read and a closed dialog must be safe to retry.
 await page.evaluate(()=>{
  window.pending={};window.controller=N80Explorer.search(document.querySelector('#search'),{minimum:2,load:q=>new Promise((resolve,reject)=>pending[q]={resolve,reject})});
 });
 await page.locator('#search input').fill('먼저');await page.locator('#search button').first().click();
 await page.locator('#search input').fill('나중');await page.locator('#search button').first().click();
 await page.evaluate(()=>{pending['나중'].resolve([rows[1]]);pending['먼저'].resolve([rows[0]]);});
 await page.locator('#search [data-n80-key="song:1"]').waitFor();assert.equal(await page.locator('#search [data-n80-key="song:0"]').count(),0);
 await page.locator('#search input').fill('재시도');await page.locator('#search button').first().click();await page.evaluate(()=>pending['재시도'].reject(Error('일시 오류')));await page.getByText('일시 오류',{exact:true}).waitFor();
 await page.locator('#search button').first().click();await page.evaluate(()=>pending['재시도'].resolve([rows[0]]));await page.locator('#search [data-n80-key="song:0"]').waitFor();
 await page.evaluate(()=>{controller.destroy();const keys=new Set(['song:2']);window.keys=keys;N80Explorer.mount(document.querySelector('#tree'),{records:rows,title:'내 채널',selection:{keys,changed(){}},onEdit(){},onChannel(){},onRules(){}});});
 await page.locator('.creator-tree-search').fill('EP040');assert.equal(await page.locator('.creator-row').count(),3);
 await page.locator('.creator-tree-search').fill('없는 곡');assert.deepEqual(await page.evaluate(()=>[...keys]),['song:2']);
 await page.locator('#open').click();await page.screenshot({path:'explorer-proof/candidate/n80-selection-'+width+'.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 assert.deepEqual(errors,[]);await page.close();
}
 console.log('N80_SELECTION_PAGING_ORDER_SCOPE_RETRY_OK');
}finally{await browser.close();}
