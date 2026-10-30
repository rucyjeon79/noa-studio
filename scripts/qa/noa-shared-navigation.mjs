import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
// Exercise the shipped header and styles without live accounts or external writes.
const server=createServer((req,res)=>{
 if(req.url.startsWith('/noa-bridge/membership.php')){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,member:false}));}
 if(req.url.startsWith('/noa-assets/')){res.writeHead(204);return res.end();}
 if(['/noa-ui.js','/noa-account.js','/noa-account.css','/noa-ui.css','/noa-starlight.css'].includes(req.url)){res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript':'text/css');return res.end(readFileSync('deploy'+req.url));}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="ko" data-noa-style="starlight"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-account.css"><link rel="stylesheet" href="/noa-starlight.css"><body><script type="application/json" id="noa-visitor-counts">{"today":"123","yesterday":"45","total":"123456"}</script><main class="noa-layout" style="padding:24px;min-height:2400px"><h1>이동 검증</h1><a href="/second">다음 화면</a></main><script src="/noa-ui.js"></script><script src="/noa-account.js"></script></body></html>');
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});mkdirSync('starlight-proof',{recursive:true});
try{for(const [width,height] of [[320,900],[390,900],[768,720],[1920,900]]){
 const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');await page.locator('#noa-nav-all').waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 for(const id of ['noa-nav-back','noa-nav-top','noa-nav-all']){const box=await page.locator('#'+id).boundingBox();assert(box.height>=44&&box.width>=44);}
 await page.getByRole('link',{name:'다음 화면',exact:true}).click();assert(page.url().endsWith('/second'));
 await page.locator('#noa-nav-back').click();await page.waitForURL(base+'/');
 await page.evaluate(()=>scrollTo(0,1800));assert((await page.locator('#noa-account-bar').boundingBox()).y===0);
 await page.locator('#noa-nav-top').click();await page.waitForFunction(()=>scrollY===0);
 assert(await page.locator(width<=760?'.noa-mobile-nav':'.noa-sidebar').isVisible());
 if(width>760){
  assert.equal(await page.locator('.noa-sidebar [data-visit="total"]').textContent(),'123,456');
  for(const link of await page.locator('.noa-sidebar .noa-sidebar-legal a').all())assert((await link.boundingBox()).height>=44);
  const sidebar=await page.locator('.noa-sidebar').boundingBox(),footer=await page.locator('.noa-sidebar>.noa-sidebar-bottom').boundingBox();
  assert(footer.y+footer.height<=sidebar.y+sidebar.height);assert(await page.locator('.noa-menu').isVisible());
 }
 if(width<=760){
  await page.locator('.noa-mobile-footer').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.noa-mobile-footer [data-visit="total"]').textContent(),'123,456');
  for(const link of await page.locator('.noa-mobile-footer .noa-sidebar-legal a').all())assert((await link.boundingBox()).height>=44);
  await page.evaluate(()=>scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'}));
  const counter=await page.locator('.noa-mobile-footer .noa-sidebar-visitors').boundingBox(),dock=await page.locator('.noa-mobile-nav').boundingBox();
  assert(counter.y>=56);assert(counter.y+counter.height<=dock.y);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:'starlight-proof/mobile-footer-'+width+'.png'});
 }else assert(!(await page.locator('.noa-mobile-footer').isVisible()));
 await page.locator('#noa-nav-all').click();await page.waitForURL(base+'/noa-sitemap.php');
 await page.screenshot({path:'starlight-proof/navigation-'+width+'.png'});assert.deepEqual(errors,[]);await page.close();
 console.log('PASS shared navigation '+width+'x'+height);
}}finally{await browser.close();server.close();}
