import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {mkdirSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const live=process.env.NOA_LISTENING_LIVE==='1',base=live?'https://noastudio.ai.kr':'http://127.0.0.1:8137',out='listening-proof/'+(live?'live':'candidate');mkdirSync(out,{recursive:true});
const server=live?null:spawn('php',['-S','127.0.0.1:8137','tests/listening/router.php'],{stdio:['ignore','ignore','pipe'],env:process.env});
let serverLog='';server?.stderr.on('data',chunk=>{serverLog+=chunk.toString();});
if(server)for(let i=0;i<60;i++){try{await fetch(base);break;}catch{await new Promise(r=>setTimeout(r,100));}}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report={live,cases:[],errors:[]};let activePage=null;
try{
 if(!live){
  const request=await browser.newContext({extraHTTPHeaders:{'X-QA-User':'alice'}});let r=await request.request.get(base+'/noa-bridge/listening.php'),s=await r.json();assert(s.member&&s.canPlay);assert.equal(s.library.length,1);assert.equal(s.library[0].title,'내 음악');
  const profile={genre:'jpop-original',timezone:'Asia/Seoul',consent:true,birthDate:'1990-06-15',calendar:'solar',birthTime:'09:30',birthTimezone:'Asia/Seoul'};const body={revision:s.revision,profile};
  assert.equal((await request.request.post(base+'/noa-bridge/listening.php',{data:body})).status(),403);
  const headers={'Origin':base,'X-NOA-CSRF':s.csrf};
  assert.equal((await request.request.post(base+'/noa-bridge/listening.php',{headers:{...headers,Origin:'https://untrusted.example'},data:body})).status(),403);
  r=await request.request.post(base+'/noa-bridge/listening.php',{headers,data:body});assert.equal(r.status(),200);s=await r.json();assert.equal(s.profile.birthDate,profile.birthDate);assert.equal(Object.keys(s.theme.pillars).length,4);
  assert.equal((await request.request.post(base+'/noa-bridge/listening.php',{headers,data:body})).status(),409);
  const bob=await browser.newContext({extraHTTPHeaders:{'X-QA-User':'bob'}});assert.equal((await(await bob.request.get(base+'/noa-bridge/listening.php')).json()).profile,null);await bob.close();
  r=await request.request.delete(base+'/noa-bridge/listening.php',{headers,data:{revision:s.revision}});assert.equal(r.status(),200);assert.equal((await r.json()).profile,null);assert.equal((await(await request.request.get(base+'/noa-bridge/listening.php')).json()).profile,null);await request.close();report.profileIsolationAndConsentDeletion=true;
 }
 for(const width of [320,390,1280]){
  const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),page=await c.newPage();activePage=page;page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(base+(live?'/':'/noa-music.php'),{waitUntil:'domcontentloaded',timeout:90000});await page.locator('#noa-listening .nl-primary').waitFor();await page.waitForFunction(()=>document.querySelector('#noa-listening .nl-primary')?.disabled===false);await page.locator('#noa-listening').scrollIntoViewIfNeeded();
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
  if(!live){
   await page.getByRole('button',{name:'추천 설정',exact:true}).click();assert(await page.getByRole('dialog').isVisible());await page.locator('.nl-consent input').uncheck();assert(!await page.locator('.nl-birth').isVisible());await page.locator('.nl-consent input').check();await page.locator('[name=birthDate]').fill('1990-06-15');await page.locator('[name=birthTime]').fill('09:30');await page.screenshot({path:out+'/settings-'+width+'.png'});await page.getByRole('button',{name:'저장',exact:true}).click();await page.getByRole('dialog').waitFor({state:'detached'});
   await page.locator('.nl-primary').click();await page.waitForFunction(()=>{const a=document.getElementById('sound-player');return a&&!a.paused&&a.currentTime>0;});
   const playing=await page.evaluate(()=>({key:document.querySelector('.song.selected')?.dataset.key,src:document.getElementById('sound-player').getAttribute('src')}));assert(playing.key.startsWith('single:kpop-original:'));report.cases.push({width,...playing,oneClickActualAudio:true});
   await page.evaluate(()=>document.getElementById('sound-player').pause());await page.locator('[data-mode=albums]').click();await page.locator('.nl-album').first().click();await page.waitForFunction(()=>document.querySelector('.song.selected')?.dataset.ep==='1');
   await page.locator('#next').click();assert.equal(await page.locator('.song.selected').getAttribute('data-ep'),'2');await page.evaluate(()=>document.getElementById('sound-player').pause());
   await page.locator('[data-mode=now]').click();
  }else{assert((await page.locator('.nl-primary').innerText()).includes('로그인하고 듣기'));report.cases.push({width,guestGate:true});}
  await page.locator('#noa-listening').screenshot({path:out+'/listening-'+width+'.png'});await c.close();
 }
 if(!live){const c=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await c.newPage();activePage=page;page.setDefaultTimeout(20000);await page.goto(base);await page.waitForFunction(()=>!document.querySelector('.nl-primary').disabled);await page.getByRole('link',{name:'내 음악 바로 듣기',exact:true}).click();const f=page.frames().find(f=>f.url().includes('listenHost'));assert(f);await f.waitForFunction(()=>!document.getElementById('sound-player').paused&&document.getElementById('sound-player').currentTime>0);assert.equal(await page.locator('.nl-play-shell').isVisible(),true);await page.screenshot({path:out+'/home-one-click.png'});await page.goBack();assert(!await page.locator('.nl-play-shell').isVisible());report.homeOneClickActualAudio=true;await page.getByRole('link',{name:'내 음악 바로 듣기',exact:true}).click();await f.locator('.noa-mobile-nav a[data-noa-nav=home]').click();await page.waitForURL(base+'/');assert.equal(new URL(page.url()).pathname,'/');report.homeNavigationLeavesPlayer=true;await c.close();}
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=String(error);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:out+'/failure.png'}).catch(()=>{});writeFileSync(out+'/failure.html',await activePage.content().catch(()=>''));}throw error;}finally{if(server)writeFileSync(out+'/server.log',serverLog);writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();server?.kill();}console.log('N80_PERSONAL_LISTENING_OK');
