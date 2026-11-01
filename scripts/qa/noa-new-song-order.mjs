import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const source=readFileSync('deploy/noa-browse.js','utf8');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<!doctype html><div id="browse"></div>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch();
try{
 for(const [group,genre] of [['story','your-story'],['cover','cover-reborn']]){
 const page=await browser.newPage();
 await page.route('**/noa-category-order.php',route=>route.fulfill({json:{[group]:['manual-b','manual-a'],playlists:[]}}));
 await page.goto('http://127.0.0.1:'+server.address().port+'/');await page.addScriptTag({content:source});
 await page.evaluate(({genre})=>{
 const rows=[['manual-a',10],['first-new',100],['manual-b',20],['latest-new',200]].map(([key,registeredAt])=>({key,registeredAt,genre,title:key,kind:'single'}));
 let browse;const redraw=()=>browse?.apply(rows);browse=NoaBrowse.mount({host:document.getElementById('browse'),rows,onChange:redraw,adminControls:false});redraw();
 },{genre});
 await page.locator('[data-browse-level="1"] .noa-browse-card').nth(group==='story'?2:3).click();
 await page.waitForFunction(()=>document.querySelector('.noa-inline-song:last-child')!==null||document.querySelectorAll('.noa-inline-song').length===4);
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.noa-inline-song'),b=>b.dataset.inlineKey).join(',')==='latest-new,first-new,manual-b,manual-a');
 assert.equal(await page.locator('.noa-inline-song').count(),4);await page.close();
 }
 console.log('NEW_STORY_AND_COVER_FIRST_WITH_SAVED_RELATIVE_ORDER_OK');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
