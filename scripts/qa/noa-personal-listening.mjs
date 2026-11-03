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
  await page.goto(base+(live?'/':'/noa-music.php'),{waitUntil:'domcontentloaded',timeout:90000});
  if(!live){
   const browse=page.locator('#music-browse');await browse.locator('[data-browse-level="1"] .noa-browse-card').first().waitFor();
   assert.equal(await browse.locator('[data-browse-level="1"] .noa-browse-card').count(),4);assert(!await page.locator('#noa-listening').isVisible());
   await page.screenshot({path:out+'/categories-'+width+'.png'});
   await browse.locator('[data-browse-level="1"] .noa-browse-card').first().click();assert.equal(await browse.locator('[data-browse-level="2"] .noa-browse-card').count(),4);
   await browse.locator('[data-browse-level="2"] .noa-browse-card').first().click();await browse.locator('[data-browse-level="4"] .noa-inline-song').first().waitFor();
   assert.equal(await browse.locator('[data-browse-level="4"] .noa-inline-song').count(),3);
   await browse.locator('[data-browse-level="4"] .noa-inline-song').first().click();await page.waitForFunction(()=>!document.getElementById('sound-player').paused&&document.getElementById('sound-player').currentTime>0);
   const before=await page.locator('#sound-player').evaluate(a=>({src:a.getAttribute('src'),time:a.currentTime}));await browse.locator('.noa-browse-crumbs button').first().click();
   assert.equal(await browse.locator('[data-browse-level="1"] .noa-browse-card').count(),4);assert(await page.locator('#sound-player').evaluate((a,b)=>!a.paused&&a.getAttribute('src')===b.src&&a.currentTime>=b.time,before));
   report.categoryBrowsing??=[];report.categoryBrowsing.push({width,defaultCategories:4,genreCards:4,actTracks:3,browsingKeepsAudio:true});
   await page.locator('.nl-music-discovery>summary').click();
  }
  await page.locator('#noa-listening .nl-primary').waitFor();await page.waitForFunction(()=>document.querySelector('#noa-listening .nl-primary')?.disabled===false);await page.locator('#noa-listening').scrollIntoViewIfNeeded();
  assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
  if(!live){
   const birthCases=[
    {calendar:'solar',raw:'19900615',expected:'1990-06-15',time:'09:30',leap:'no'},
    {calendar:'lunar',raw:'19900615',expected:'1990-06-15',time:'',leap:'no'},
    {calendar:'lunar',raw:'20240230',expected:'2024-02-30',time:'11:45',leap:'no'},
    {calendar:'lunar',raw:'2023.2.1',expected:'2023-02-01',time:'16:30',leap:'yes'},
   ];
   report.birthInputs??=[];
   for(const input of birthCases){
    await page.getByRole('button',{name:'추천 설정',exact:true}).click();
    const dialog=page.getByRole('dialog');assert(await dialog.isVisible());await page.locator('.nl-consent input').uncheck();assert(!await page.locator('.nl-birth').isVisible());await page.locator('.nl-consent input').check();
    await page.locator('[name=calendar]').selectOption(input.calendar);if(input.calendar==='lunar')await page.locator('[name=leap]').selectOption(input.leap);
    await page.locator('[name=birthDate]').fill(input.raw);await page.locator('[name=birthTime]').fill(input.time);
    if(input.raw==='20240230')await page.screenshot({path:out+'/settings-'+width+'.png'});
    const saved=page.waitForResponse(r=>r.url()===base+'/noa-bridge/listening.php'&&r.request().method()==='POST');
    await page.getByRole('button',{name:'저장',exact:true}).click();const response=await saved;assert.equal(response.status(),200);const savedState=await response.json();
    assert.equal(savedState.profile.birthDate,input.expected);assert.equal(savedState.profile.calendar,input.calendar);assert.equal(savedState.profile.birthTime,input.time);assert.equal(savedState.profile.leap,input.leap==='yes');
    await dialog.waitFor({state:'detached'});
    await page.getByRole('button',{name:'추천 설정',exact:true}).click();assert.equal(await page.locator('[name=birthDate]').inputValue(),input.expected);assert.equal(await page.locator('[name=birthTime]').inputValue(),input.time);await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();
    report.birthInputs.push({width,calendar:input.calendar,input:input.raw,stored:input.expected,reopened:true});
   }
   if(width===390){
    await page.getByRole('button',{name:'추천 설정',exact:true}).click();await page.locator('[name=birthDate]').fill('1990xx0615');await page.getByRole('button',{name:'저장',exact:true}).click();
    assert((await page.locator('[name=birthDate]').evaluate(input=>input.validationMessage)).includes('숫자 8자리'));
    for(const calendar of ['solar','lunar']){
     await page.locator('[name=calendar]').selectOption(calendar);if(calendar==='lunar')await page.locator('[name=leap]').selectOption('no');await page.locator('[name=birthDate]').fill('20240231');
     const rejected=page.waitForResponse(r=>r.url()===base+'/noa-bridge/listening.php'&&r.request().method()==='POST');await page.getByRole('button',{name:'저장',exact:true}).click();assert.equal((await rejected).status(),400);assert(await page.getByRole('dialog').isVisible());
    }
    await page.locator('[name=birthDate]').fill('invalid');await page.locator('.nl-consent input').uncheck();const removed=page.waitForResponse(r=>r.url()===base+'/noa-bridge/listening.php'&&r.request().method()==='POST');await page.getByRole('button',{name:'저장',exact:true}).click();const response=await removed;assert.equal(response.status(),200);const cleared=(await response.json()).profile;assert.equal(cleared.consent,false);assert(!Object.hasOwn(cleared,'birthDate'));await page.getByRole('dialog').waitFor({state:'detached'});report.invalidDatesRejectedAndConsentCleared=true;
   }
   await page.locator('.nl-primary').click();await page.waitForFunction(()=>{const a=document.getElementById('sound-player');return a&&!a.paused&&a.currentTime>0;});
   const playing=await page.evaluate(()=>({key:document.querySelector('.song.selected')?.dataset.key,src:document.getElementById('sound-player').getAttribute('src')}));assert(playing.key.startsWith('single:kpop-original:'));report.cases.push({width,...playing,oneClickActualAudio:true});
   assert.equal(await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);
   const beforeBrowse=await page.locator('#sound-player').evaluate(a=>a.currentTime);await page.locator('#noa-listening .nl-catalog').click();
   assert(!await page.locator('#noa-listening').isVisible());assert.equal(await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);
   assert(await page.locator('#sound-player').evaluate((a,t)=>!a.paused&&a.currentTime>=t,beforeBrowse));assert.equal(await page.locator('.song.selected').getAttribute('data-key'),playing.key);
   await page.locator('#next').click();assert.equal(await page.locator('.song.selected').getAttribute('data-genre'),'kpop-original');
   await page.reload();await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').first().waitFor();assert.equal(await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);assert(!await page.locator('#noa-listening').isVisible());
   await page.locator('.nl-music-discovery>summary').click();await page.waitForFunction(()=>!document.querySelector('.nl-primary').disabled);
   report.categoryBrowsing.at(-1).recommendationKeepsCategories=true;report.categoryBrowsing.at(-1).reloadKeepsCategories=true;
   await page.evaluate(()=>document.getElementById('sound-player').pause());await page.locator('[data-mode=albums]').click();await page.locator('.nl-album').first().click();await page.waitForFunction(()=>document.querySelector('.song.selected')?.dataset.ep==='1');
   await page.locator('#next').click();assert.equal(await page.locator('.song.selected').getAttribute('data-ep'),'2');await page.evaluate(()=>document.getElementById('sound-player').pause());
   await page.locator('[data-mode=now]').click();
  }else{assert((await page.locator('.nl-primary').innerText()).includes('로그인하고 듣기'));report.cases.push({width,guestGate:true});}
  await page.locator('#noa-listening').screenshot({path:out+'/listening-'+width+'.png'});await c.close();
 }
 if(!live){const c=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await c.newPage();activePage=page;page.setDefaultTimeout(20000);await page.goto(base);assert.equal(await page.locator('.nl-catalog').getAttribute('href'),'/noa-music.php#music-browse');await page.waitForFunction(()=>!document.querySelector('.nl-primary').disabled);await page.getByRole('link',{name:'내 음악 바로 듣기',exact:true}).click();const f=page.frames().find(f=>f.url().includes('listenHost'));assert(f);await f.waitForFunction(()=>!document.getElementById('sound-player').paused&&document.getElementById('sound-player').currentTime>0);assert.equal(await f.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);assert.equal(await page.locator('.nl-play-shell').isVisible(),true);await page.screenshot({path:out+'/home-one-click.png'});await page.goBack();assert(!await page.locator('.nl-play-shell').isVisible());report.homeOneClickActualAudio=true;await page.getByRole('link',{name:'내 음악 바로 듣기',exact:true}).click();await f.locator('.noa-mobile-nav a[data-noa-nav=home]').click();await page.waitForURL(base+'/');assert.equal(new URL(page.url()).pathname,'/');report.homeNavigationLeavesPlayer=true;await c.close();}
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=String(error);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:out+'/failure.png'}).catch(()=>{});writeFileSync(out+'/failure.html',await activePage.content().catch(()=>''));}throw error;}finally{if(server)writeFileSync(out+'/server.log',serverLog);writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();server?.kill();}console.log('N80_PERSONAL_LISTENING_OK');
