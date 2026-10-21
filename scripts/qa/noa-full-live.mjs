import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const width=Number(process.env.NOA_QA_WIDTH||390),origin='https://noastudio.ai.kr',out='full-live-proof';
await fs.mkdir(out,{recursive:true});const b=await chromium.launch(),c=await b.newContext({viewport:{width,height:900}}),p=await c.newPage(),errors=[],report={width,urls:[],home:{},world:{},limits:[]};
p.on('pageerror',e=>errors.push(e.message));
const api=await(await p.request.get(origin+'/noa-bridge/home.php')).json();assert(api.ok);report.home.runId=api.runId;report.home.collectedAt=api.collectedAt;report.home.diagnostics=api.diagnostics;
for(const route of ['/','/index.php','/noa2.php']){const r=await p.goto(origin+route,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);assert(!p.url().includes('noa2.php'));await p.locator('body[data-noa-home-ready="true"]').waitFor();report.urls.push({requested:route,final:p.url(),status:r.status()});}
await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.locator('body[data-noa-home-ready="true"]').waitFor();
for(const [key,id]of [['stories','noa-stories'],['covers','noa-covers'],['playlists','noa-acts']]){
 const cards=p.locator('#'+id+' .noa-music-card');assert.equal(await cards.count(),api[key].length);assert.equal(api[key].length,10);
 const rows=await cards.evaluateAll(es=>es.map(e=>({title:e.querySelector('strong').textContent,href:e.getAttribute('href'),thumbnail:e.querySelector('img').getAttribute('src'),note:e.querySelector('small').textContent})));
 assert.deepEqual(rows.map(r=>r.title),api[key].map(r=>r.title));assert.deepEqual(rows.map(r=>r.href),api[key].map(r=>r.href));
 assert(api[key].every((r,i,a)=>!i||(a[i-1].score??a[i-1].views)>=(r.score??r.views)));
 for(const card of await cards.all()){await card.scrollIntoViewIfNeeded();await card.locator('img').evaluate(i=>i.decode());}
 assert((await cards.locator('img').evaluateAll(es=>es.every(e=>e.complete&&e.naturalWidth>0))));
 report.home[key]={count:rows.length,top:rows[0],allThumbnailsLoaded:true};
 await p.locator('[data-home-section="'+(key==='playlists'?'playlists':key)+'"]').screenshot({path:out+'/home-'+key+'-'+width+'.jpg',type:'jpeg',quality:70});
 const link=await p.request.get(origin+rows[0].href);assert.equal(link.status(),200);
}
assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await p.goto(origin+'/noa-world.php',{waitUntil:'domcontentloaded'});
await p.locator('.world-mv-card').first().waitFor();
const rows=await p.locator('.world-mv-card').evaluateAll(es=>es.map(e=>({ep:Number(e.dataset.ep),video:e.querySelector('[data-video]')?.dataset.video??e.dataset.video,title:e.innerText})));
assert(rows.length>0);assert(rows.every((r,i,a)=>!i||(r.ep||999)>=(a[i-1].ep||999)));
assert.equal(await p.locator('[aria-label="ACT 이야기 목록"] a').count(),4);
assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
const official=p.getByRole('link',{name:'공식 MV 재생목록 ↗',exact:true});
const officialLinks=await p.locator('a[href*="PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY"]').count();assert(officialLinks>0);
report.world={playlistId:'PLEPMKciKgvchOwm5hQfGAP2jDQloI2RVY',displayed:rows.length,epOrder:rows.map(r=>r.ep),actLinks:4,text:(await p.locator('main').innerText()).slice(0,2200)};
await p.screenshot({path:out+'/world-'+width+'.jpg',type:'jpeg',quality:75});
await p.locator('.world-thumbnail').first().click();await p.locator('#world-player').waitFor({state:'visible'});
report.world.embed=await p.locator('#world-frame').getAttribute('src');assert.match(report.world.embed,/^https:\/\/www.youtube.com\/embed\/[A-Za-z0-9_-]{11}/);
await p.getByRole('button',{name:'영상 닫기',exact:true}).click();assert.equal(await p.locator('#world-frame').getAttribute('src'),'about:blank');
report.limits.push('Official iframe opened and closed; audible YouTube streaming not asserted.');
for(const act of [1,2,3,4]){await p.goto(origin+'/noa-world.php?story='+act,{waitUntil:'domcontentloaded'});assert((await p.locator('main').innerText()).includes('ACT.'+act));}
for(const route of ['/noa-youtube.php','/noa-music.php','/bbs/login.php']){const r=await p.goto(origin+route,{waitUntil:'domcontentloaded'});assert.equal(r.status(),200);report.urls.push({requested:route,status:r.status()});}
await p.locator('#login_id').waitFor();assert(await p.locator('#login_pw').isVisible());
for(const path of ['/noa-app/database/','/noa-app/database/core.php','/noa-ai-lab.php','/noa-library.php']){assert.equal((await p.request.get(origin+path)).status(),403);report.urls.push({requested:path,anonymous:403});}
const catalog=await(await p.request.get(origin+'/noa-bridge/catalog.php')).json();report.music={publicRecords:catalog.items.length,ACTs:catalog.items.filter(r=>r.kind==='playlist').length,suno:catalog.items.filter(r=>r.sunoUrl).length,originalAudioFiles:catalog.items.filter(r=>r.audioUrl).length};assert.equal(report.music.ACTs,52);
await p.goto(origin+'/noa-music.php?genre=kpop-original&act=1',{waitUntil:'domcontentloaded'});await p.locator('.song:visible .song-select').first().click();assert((await p.locator('#lyrics').innerText()).length>10);report.music.detail=await p.locator('#detail-title').innerText();report.music.playbackState=await p.locator('#player-status').innerText();
report.errors=errors;assert.deepEqual(errors,[]);await fs.writeFile(out+'/result-'+width+'.json',JSON.stringify(report,null,2));console.log('FULL_LIVE_PROOF '+JSON.stringify(report));await b.close();
