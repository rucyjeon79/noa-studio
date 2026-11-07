import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const output=process.env.N80_ORBIT_PROOF||'n80-orbit-proof';mkdirSync(output,{recursive:true});
const files=['noa-ui.js','noa-ui.css','noa-starlight.css','noa-account.js','noa-account.css','noa-design.json','noa-ui-words.json','noa-interface-labels.json'];
let requests=0;
const server=createServer((req,res)=>{
 requests++;const path=new URL(req.url,'http://local').pathname;
 if(files.includes(path.slice(1))){res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':path.endsWith('.css')?'text/css':'application/json');return res.end(readFileSync('deploy'+path));}
 if(path==='/noa-bridge/ui-preferences.php'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,member:true,revision:1,settings:{theme:'noa-studio',language:'ko'},displayName:'NOA'}));}
 if(path.startsWith('/noa-bridge/')||path==='/noa-sitemap.php'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({ok:true,member:true}));}
 if(path==='/noa-assets/papa-logo.png'){res.setHeader('Content-Type','image/png');return res.end(readFileSync('public/papa-logo.png'));}
 if(path.startsWith('/noa-assets/')){res.writeHead(204);return res.end();}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="ko" data-noa-style="starlight"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-account.css"><link rel="stylesheet" href="/noa-starlight.css"><body><script id="noa-access" type="application/json">{"home":true,"member":true,"music":true,"admin":false}</script><main class="noa-layout" style="padding:24px;min-height:600px"><h1>NOA STUDIO</h1><p>N80 Engine · 작업 상태</p><a href="/second">다음 화면</a></main><script src="/noa-ui.js"></script><script src="/noa-account.js"></script></body></html>`);
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({...(process.env.N80_CHROME?{executablePath:process.env.N80_CHROME}:existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{channel:'chrome'}),headless:true,args:['--no-sandbox']});
try{
 for(const width of [320,390,1440]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/second');const home=page.locator(width>760?'#noa-account-bar .noa-account-brand':'.noa-mobile-nav [data-noa-nav=home]');await home.waitFor();
  await page.waitForTimeout(300);
  await page.evaluate(()=>N80Activity.clear());
  assert.equal(await home.getAttribute('data-n80-state'),'idle');
  // Old failures/results are history, not new running work or completion pulses.
  await page.evaluate(()=>N80Activity.snapshot('audio',[{id:1,status:'failed'},{id:2,status:'ready'},{id:4,status:'awaiting_audio'}]));
  assert.equal(await home.getAttribute('data-n80-state'),'idle');
  await page.evaluate(()=>N80Activity.snapshot('audio',[{id:3,status:'processing'}]));
  assert.equal(await home.getAttribute('data-n80-state'),'running');
  const orbit=home.locator('.n80-home-orbit');
  const a=await orbit.evaluate(e=>getComputedStyle(e).transform);await page.waitForTimeout(180);const b=await orbit.evaluate(e=>getComputedStyle(e).transform);assert.notEqual(a,b,'rotation actually advances');
  assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationName),'n80-home-clockwise');
  const frame=await orbit.evaluate(e=>e.getAnimations()[0].effect.getKeyframes());assert.equal(frame.at(-1).transform,'rotate(360deg)','positive angle is clockwise');
  assert.equal(await orbit.evaluate(e=>getComputedStyle(e,'::before').opacity),'0.9','visible trailing arc');
  assert.equal(await home.evaluate(e=>getComputedStyle(e).overflow),'visible','sphere is not clipped');
  assert((await home.boundingBox()).width>=44);assert.equal(await orbit.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  await page.screenshot({path:output+'/running-'+width+'.png'});
  // Concurrent completion does not stop another running task.
  await page.evaluate(()=>{N80Activity.set('ai','a','queued');N80Activity.set('ai','a','saved');});
  assert.equal(await home.getAttribute('data-n80-state'),'running');
  await page.evaluate(()=>N80Activity.snapshot('audio',[{id:3,status:'ready'}]));
  assert.equal(await home.getAttribute('data-n80-state'),'complete');
  await page.waitForTimeout(2300);assert.equal(await home.getAttribute('data-n80-state'),'idle');
  await page.evaluate(()=>N80Activity.snapshot('audio',[{id:3,status:'ready'}]));assert.equal(await home.getAttribute('data-n80-state'),'idle','old completion does not repeat');
  await page.evaluate(()=>N80Activity.set('ai','b','waiting'));
  assert.equal(await home.getAttribute('data-n80-state'),'waiting');
  assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationDuration),'3.4s');
  await page.screenshot({path:output+'/waiting-'+width+'.png'});
  await page.evaluate(()=>N80Activity.set('ai','b','failed'));assert.equal(await home.getAttribute('data-n80-state'),'error');
  assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationName),'n80-home-warning');
  await page.evaluate(()=>{N80Activity.clear();N80Activity.set('audio','stale','processing',{ttl:1000});});
  await page.waitForTimeout(1150);assert.equal(await home.getAttribute('data-n80-state'),'stale','missing receipt is not endless green');
  await page.evaluate(()=>N80Activity.set('audio','stale','cancelled'));assert.equal(await home.getAttribute('data-n80-state'),'idle');
  await page.evaluate(()=>N80Activity.set('audio','retry','processing'));
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationName),'none');await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  assert.equal(await orbit.evaluate(e=>getComputedStyle(e).animationPlayState),'paused');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  // Navigation rebuilds the home control without duplicate decoration; receipts survive same-tab navigation.
  await page.evaluate(()=>window.dispatchEvent(new HashChangeEvent('hashchange')));assert.equal(await home.locator('.n80-home-orbit').count(),1);
  await home.click();await page.waitForURL(base+'/');assert.equal(await home.getAttribute('data-n80-state'),'running');
  await page.evaluate(()=>N80Activity.clear());await page.waitForTimeout(400);const before=requests;
  await page.waitForTimeout(1200);assert.equal(requests,before,'indicator adds no polling requests');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  assert.deepEqual(errors,[]);await page.close();console.log('PASS orbit lifecycle/navigation/motion '+width);
 }
}finally{await browser.close();server.close();}
