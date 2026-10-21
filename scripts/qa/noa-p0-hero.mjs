import {chromium} from 'playwright';import fs from 'node:fs/promises';
const origin='https://noastudio.ai.kr',b=await chromium.launch({channel:'chrome'}),c=await b.newContext({reducedMotion:'no-preference'}),p=await c.newPage(),events=[];
await c.route(origin+'/noa-hero.js*',r=>r.fulfill({path:process.cwd()+'/deploy/noa-hero.js',contentType:'application/javascript'}));
p.on('pageerror',e=>events.push({pageError:e.message}));p.on('requestfailed',r=>events.push({failed:r.url(),error:r.failure()?.errorText}));p.on('response',r=>{if(r.url().endsWith('.mp4'))events.push({url:r.url(),status:r.status(),type:r.headers()['content-type'],range:r.headers()['content-range']});});
await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(10000);
const state=()=>p.locator('#noa-hero-video').evaluate(v=>({source:v.currentSrc,ready:v.readyState,network:v.networkState,paused:v.paused,ended:v.ended,time:v.currentTime,duration:v.duration,error:v.error?{code:v.error.code,message:v.error.message}:null,muted:v.muted,hidden:v.hidden,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,visible:document.visibilityState}));
const automatic=await state();await p.locator('#noa-hero-toggle').click();await p.waitForTimeout(10000);const manual=await state();
const src=manual.source||automatic.source;if(src){const r=await p.request.get(src,{headers:{Range:'bytes=0-4095'}});events.push({probe:r.status(),type:r.headers()['content-type'],range:r.headers()['content-range'],bytes:(await r.body()).length});}
await fs.mkdir('hero-proof',{recursive:true});await p.screenshot({path:'hero-proof/hero.jpg'});const result={automatic,manual,events};await fs.writeFile('hero-proof/result.json',JSON.stringify(result,null,2));console.log('P0_HERO '+JSON.stringify(result));await b.close();
