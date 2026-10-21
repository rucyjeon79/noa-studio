import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
const source=JSON.parse(await fs.readFile('quality-home/candidate.json','utf8'));
const server=spawn('php',['-S','127.0.0.1:8097','-t','deploy','tests/home/router.php'],{stdio:'ignore'});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 let ready=false;for(let i=0;i<40&&!ready;i++){try{ready=(await page.request.get('http://127.0.0.1:8097/')).ok();}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert.ok(ready);
 let baseline;const reports=[];
 for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});await page.goto('http://127.0.0.1:8097/',{waitUntil:'domcontentloaded'});await page.locator('body[data-noa-home-ready="true"]').waitFor();
  const rendered={};for(const [section,id]of [['stories','noa-stories'],['covers','noa-covers'],['playlists','noa-acts']]){
   const cards=page.locator('#'+id+' a.noa-music-card');assert.equal(await cards.count(),source[section].length);
   rendered[section]=await cards.evaluateAll(cs=>cs.map(c=>({video:c.dataset.video,playlist:c.dataset.playlist??null,href:c.getAttribute('href'),title:c.querySelector('strong').textContent,note:c.querySelector('small').textContent})));
   for(let i=0;i<source[section].length;i++){const s=source[section][i],r=rendered[section][i];assert.equal(r.video,s.videoId);assert.equal(r.title,s.title);assert.equal(r.href,s.href);assert.equal(r.playlist,s.playlistId??null);assert.doesNotMatch(r.note,/NaN|undefined|null/);if(section==='playlists')assert.match(r.note,s.contentType==='video'?/連続|연속듣기 영상 조회/:/수록 영상 조회수 합계/);}
  }
  if(baseline)assert.deepEqual(rendered,baseline);baseline=rendered;
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
  // Lazy images outside the first viewport need a scroll before visual QA.
  for(const id of ['noa-stories','noa-covers','noa-acts']){
   await page.locator('#'+id+' .noa-music-card').first().scrollIntoViewIfNeeded();
   await page.locator('#'+id+' .noa-music-card').last().scrollIntoViewIfNeeded();
   await page.waitForFunction(id=>[...document.querySelectorAll('#'+id+' .noa-art img')].every(img=>img.complete&&img.naturalWidth>0),id,{timeout:30000});
  }
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:'quality-home/home-'+width+'.jpg',type:'jpeg',quality:75,fullPage:true});reports.push({width,counts:Object.fromEntries(Object.entries(rendered).map(([s,rs])=>[s,rs.length]))});
 }
 for(const s of ['stories','covers','playlists']){const row=source[s][0];const image=await page.request.get('https://noastudio.ai.kr'+row.thumbnail);assert.ok(image.ok());assert.match(image.headers()['content-type'],/^image\//);const link=await page.request.get('https://noastudio.ai.kr'+row.href);assert.ok(link.ok());}
 assert.deepEqual(errors,[]);await fs.writeFile('quality-home/render-report.json',JSON.stringify({ok:true,environment:'isolated candidate render, not deployed',sameDesktopMobileRows:true,allRankedThumbnailsLoaded:true,topItemThumbnailAndDestinationHttpVerified:true,reports},null,2));console.log('PASS NOA HOME desktop/mobile equal rows, titles, links, metrics, responsive layout and top thumbnails');
}finally{await browser.close();server.kill();}
