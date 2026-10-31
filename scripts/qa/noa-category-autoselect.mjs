import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const source=readFileSync('deploy/noa-browse.js','utf8');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><meta charset="utf-8"><div id="browse"></div>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true});
try{for(const width of [390,1280])for(const mode of ['act','custom','multiple','loose','mixed','empty','video']){
 const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const playlists=['custom','mixed','video'].includes(mode)?[{id:'only',group:'story',title:'Only bundle',keys:['one']}]:[];
 await page.route('**/noa-category-order.php',async route=>{await new Promise(r=>setTimeout(r,100));await route.fulfill({json:{playlists}});});
 await page.goto('http://127.0.0.1:'+server.address().port);await page.addScriptTag({content:source});
 await page.evaluate(({mode})=>{
  const rows=mode==='empty'?[]:[{key:'one',kind:'single',genre:'your-story',title:'one',act:['act','multiple'].includes(mode)?1:0},...(['multiple','mixed'].includes(mode)?[{key:'two',kind:'single',genre:'your-story',title:'two',act:mode==='multiple'?2:0}]:[])];
  window.played=0;let browse;const change=()=>browse?.apply(rows);browse=NoaBrowse.mount({host:document.getElementById('browse'),rows,onChange:change,onSelect:()=>{played++;return true;},adminControls:false,kind:mode==='video'?'영상':'곡'});window.redraw=change;change();
 },{mode});
 await page.locator('[data-browse-level="1"] .noa-browse-card').nth(2).click();
 await page.waitForFunction(()=>document.querySelector('[data-browse-level="3"]'));
 await page.waitForTimeout(200);
 assert.match(page.url(),/genre=your-story/);
 const details=page.locator('[data-browse-level="3"] [data-browse-level="4"]:not([hidden])');
 if(['act','custom','loose','video'].includes(mode))assert.equal(await details.count(),1,mode);
 if(mode==='multiple')assert.equal(await details.count(),0);
 if(mode==='mixed'){assert.equal(await page.locator('.noa-user-playlist [data-browse-level="4"]:not([hidden])').count(),0);}
 assert.equal(await page.evaluate(()=>played),0,'automatic descent must not play media');
 if(['act','custom'].includes(mode)){await page.locator('.noa-list-toggle').click();await page.evaluate(()=>redraw());assert.equal(await details.count(),0,'manual collapse stays closed');}
 assert.deepEqual(errors,[]);await page.close();
}console.log('CATEGORY_AUTO_DESCENT_MOBILE_DESKTOP_ACT_CUSTOM_BRANCH_LOOSE_EMPTY_NO_AUTOPLAY_OK');}
finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
