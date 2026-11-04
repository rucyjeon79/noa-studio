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
   assert.equal(await browse.locator('[data-browse-level="1"] .noa-browse-card').count(),4);assert(!await page.locator('#noa-listening').isVisible());assert(await page.locator('.nl-listen-row>.nl-primary').isVisible());
   await page.screenshot({path:out+'/categories-'+width+'.png'});
   await browse.locator('[data-browse-level="1"] .noa-browse-card').first().click();assert.equal(await browse.locator('[data-browse-level="2"] .noa-browse-card').count(),4);
   await browse.locator('[data-browse-level="2"] .noa-browse-card').first().click();await browse.locator('[data-browse-level="4"] .noa-inline-song').first().waitFor();
   assert.equal(await browse.locator('[data-browse-level="4"] .noa-inline-song').count(),3);
   await browse.locator('[data-browse-level="4"] .noa-inline-song').first().click();await page.waitForFunction(()=>!document.getElementById('sound-player').paused&&document.getElementById('sound-player').currentTime>0);
   const before=await page.locator('#sound-player').evaluate(a=>({src:a.getAttribute('src'),time:a.currentTime}));await browse.locator('.noa-browse-crumbs button').first().click();
   assert.equal(await browse.locator('[data-browse-level="1"] .noa-browse-card').count(),4);assert(await page.locator('#sound-player').evaluate((a,b)=>!a.paused&&a.getAttribute('src')===b.src&&a.currentTime>=b.time,before));
   for(const [index,expectedGenre] of [[1,'groovy-airy-pop'],[2,'your-story'],[3,'cover-reborn']]){
    await browse.locator('[data-browse-level="1"] .noa-browse-card').nth(index).click();
    if(index===1){await browse.locator('[data-browse-level="2"] .noa-browse-card').nth(2).click();assert.equal(await browse.locator('[data-act-number]').count(),2);await browse.locator('[data-act-number="1"]>.noa-browse-card').click();}
    await browse.locator('[data-browse-level="4"] .noa-inline-song').first().click();await page.waitForFunction(()=>!document.getElementById('sound-player').paused);
    assert.equal(await page.locator('.song.selected').getAttribute('data-genre'),expectedGenre);await browse.locator('.noa-browse-crumbs button').first().click();
   }
   report.categoryBrowsing??=[];report.categoryBrowsing.push({width,defaultCategories:4,genreCards:4,actTracks:3,allFourCategoriesPlayable:true,browsingKeepsAudio:true});
   await page.locator('.nl-music-discovery>summary').click();
  }
  await page.locator('.nl-primary').waitFor();await page.waitForFunction(()=>document.querySelector('.nl-primary')?.disabled===false);await page.locator('#noa-listening').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#nl-lane-whole').innerText(),'오늘의 공감 추천');
  assert.equal(await page.locator('#nl-lane-manual').innerText(),'지금 내 기분');
  const overflow=await page.evaluate(()=>{const width=document.documentElement.scrollWidth;if(width<=innerWidth+1)return null;
   return {width,viewport:innerWidth,scrollX,edges:[...document.querySelectorAll('body *')].filter(e=>!e.closest('.nl-moods,.nl-tabs')&&e.getBoundingClientRect().right+scrollX>innerWidth+1).map(e=>[e.tagName,e.id,e.className?.toString().slice(0,70),Math.round(e.getBoundingClientRect().right+scrollX)]).slice(-30)};});assert.equal(overflow,null,JSON.stringify(overflow));
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
   assert(await page.locator('[data-manual-play]').isDisabled());await page.locator('.nl-genres').selectOption('kpop-original');assert(await page.locator('[data-manual-play]').isDisabled());await page.locator('[data-mood=calm]').click();await page.locator('[data-manual-play]').click();await page.waitForFunction(()=>{const a=document.getElementById('sound-player');return a&&!a.paused&&a.currentTime>0;});
   const playing=await page.evaluate(()=>({key:document.querySelector('.song.selected')?.dataset.key,src:document.getElementById('sound-player').getAttribute('src')}));assert(playing.key.startsWith('single:kpop-original:'));report.cases.push({width,...playing,oneClickActualAudio:true});
   assert.equal(await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);
   const beforeBrowse=await page.locator('#sound-player').evaluate(a=>a.currentTime);await page.locator('#noa-listening .nl-catalog').click();
   assert(!await page.locator('#noa-listening').isVisible());assert(await page.locator('.nl-listen-row>.nl-primary').isVisible());assert.equal(await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);
   assert(await page.locator('#sound-player').evaluate((a,t)=>!a.paused&&a.currentTime>=t,beforeBrowse));assert.equal(await page.locator('.song.selected').getAttribute('data-key'),playing.key);
   await page.locator('#next').click();assert.equal(await page.locator('.song.selected').getAttribute('data-genre'),'kpop-original');
   await page.reload();await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').first().waitFor();assert.equal(await page.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);assert(!await page.locator('#noa-listening').isVisible());assert(await page.locator('.nl-listen-row>.nl-primary').isVisible());
   await page.locator('.nl-music-discovery>summary').click();await page.waitForFunction(()=>!document.querySelector('.nl-primary').disabled);
   report.categoryBrowsing.at(-1).recommendationKeepsCategories=true;report.categoryBrowsing.at(-1).reloadKeepsCategories=true;
   await page.evaluate(()=>document.getElementById('sound-player').pause());await page.locator('[data-mode=albums]').click();await page.locator('.nl-album').first().click();await page.waitForFunction(()=>document.querySelector('.song.selected')?.dataset.ep==='1');
   await page.locator('#next').click();assert.equal(await page.locator('.song.selected').getAttribute('data-ep'),'2');await page.evaluate(()=>document.getElementById('sound-player').pause());
   await page.locator('[data-mode=now]').click();
  }else{
   const mix=page.locator('[data-all-genre-mix]');assert((await mix.innerText()).includes('로그인하고 추천받기'));
   await page.waitForFunction(()=>window.NoaUI?.getState());
   for(const theme of ['noa-ivory','noa-studio']){
    await page.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);
    const painted=await mix.evaluate(button=>{
     const probe=button.cloneNode(true);probe.setAttribute('aria-pressed','true');button.after(probe);
     const color=key=>{const i=document.createElement('i');i.style.color='var('+key+')';probe.after(i);const v=getComputedStyle(i).color;i.remove();return v;};
     const css=getComputedStyle(probe);const match=css.backgroundColor===color('--noa-accent')&&css.color===color('--noa-accentText')&&css.opacity==='1';probe.remove();return match;
    });
    assert(painted,'selected play action keeps full contrast: '+theme);
   }
   assert(await page.locator('[data-manual-play]').isDisabled());
   assert.equal(await page.locator('.nl-genres option:checked').innerText(),'전체 장르');
   assert(await page.locator('[data-listening-lane=manual]').innerText().then(s=>s.includes('최대 100곡')));
   report.cases.push({width,guestGate:true,buttonColorsInBothThemes:true});
  }
  await page.locator('#noa-listening').screenshot({path:out+'/listening-'+width+'.png'});await c.close();
 }
 if(!live){
  const c=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'}),page=await c.newPage();activePage=page;page.setDefaultTimeout(20000);
  await page.goto(base);assert.equal(await page.locator('.nl-catalog').getAttribute('href'),'/noa-music.php#music-browse');
  await page.waitForFunction(()=>!document.querySelector('.nl-primary').disabled&&document.querySelector('.nl-play-shell')?.contentWindow?.NoaMusic);
  await page.getByRole('link',{name:'내 음악 바로 듣기',exact:true}).click();
  const f=page.frames().find(frame=>frame.url().includes('listenHost'));assert(f);
  await f.waitForFunction(()=>!document.querySelector('audio').paused&&document.querySelector('audio').currentTime>0);
  const before=await f.evaluate(()=>{window.testAudio=document.querySelector('audio');return {time:testAudio.currentTime,keys:queue().map(b=>b.dataset.key)};});
  assert.equal(await f.locator('#music-browse [data-browse-level="1"] .noa-browse-card').count(),4);await page.screenshot({path:out+'/home-one-click.png'});
  const checkPlaying=async()=>{
   await f.waitForFunction(t=>document.querySelector('audio')===window.testAudio&&!testAudio.paused&&testAudio.currentTime>t,before.time);
   assert.deepEqual(await f.evaluate(()=>queue().map(b=>b.dataset.key)),before.keys);
   assert(await f.locator('.noa-two-line').isVisible());
  };
  await page.goBack();await page.waitForURL(base+'/');await checkPlaying();
  assert(await page.locator('.nl-play-shell').evaluate(el=>getComputedStyle(el).clipPath!=='none'),'real dock stays above the original home');
  await page.getByRole('link',{name:'내 음악 바로 듣기',exact:true}).click();
  await f.locator('.noa-mobile-nav a[data-noa-nav=community]').click();await page.waitForURL(base+'/noa-lounge.php');await checkPlaying();
  await f.locator('.noa-mobile-nav a[data-noa-nav=home]').click();await page.waitForURL(base+'/');await checkPlaying();
  await page.goBack();await page.waitForURL(base+'/noa-lounge.php');await checkPlaying();
  await page.goForward();await page.waitForURL(base+'/');await checkPlaying();
  await f.locator('#dock-close').click();await page.locator('.nl-play-shell').waitFor({state:'hidden'});assert(await f.evaluate(()=>testAudio.paused));
  report.homeOneClickActualAudio=true;report.homeDockAcrossMenusBackForwardAndClose=true;await c.close();
 }

 if(!live){
  // The studio sign-in flow can return to the plain homepage. Restore only this tab's setup intent.
  const setupContext=await browser.newContext({viewport:{width:390,height:900},extraHTTPHeaders:{'X-QA-User':'guest'}});
  const setupPage=await setupContext.newPage();
  await setupPage.route('**/bbs/login.php?*',r=>r.fulfill({contentType:'text/html',body:'<title>Sign in</title>'}));
  await setupPage.goto(base+'/');await setupPage.getByRole('button',{name:'생년월일 설정하기'}).click();
  await setupPage.waitForURL('**/bbs/login.php?*');
  await setupContext.setExtraHTTPHeaders({'X-QA-User':'returning-member'});await setupPage.goto(base+'/');
  await setupPage.getByRole('dialog',{name:'개인 추천 설정'}).waitFor();
  await setupPage.getByRole('button',{name:'닫기',exact:true}).click();await setupPage.reload();
  await setupPage.getByRole('button',{name:'생년월일 설정하기'}).waitFor();assert.equal(await setupPage.locator('.nl-dialog').count(),0);
  await setupContext.close();report.fortuneSetupSurvivesHomeLoginReturn=true;
  for(const width of [390,1280]){
   const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',extraHTTPHeaders:{'X-QA-User':'fortuneuser'}}),page=await c.newPage();activePage=page;page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base);const card=page.locator('#noa-daily-fortune');
   await page.waitForFunction(()=>document.querySelector('.nl-primary')?.disabled===false);assert(await card.isVisible());assert(await card.getByRole('button',{name:'생년월일 설정하기'}).isVisible());
   await page.locator('.nl-genres').selectOption('your-story');await page.locator('[data-mood=focus]').click();assert((await page.locator('[data-listening-lane=manual] .nl-preview').innerText()).includes('분위기의 곡이 부족해'));
   for(const mood of ['comfort','calm']){await page.locator('[data-mood='+mood+']').click();assert(!(await page.locator('[data-listening-lane=manual] .nl-preview').innerText()).includes('분위기의 곡이 부족해'));assert.match(await page.locator('[data-listening-lane=manual] .nl-preview').innerText(),/당신의 하루/);}await page.locator('[data-manual-play]').click();
   const player=page.frames().find(f=>f.url().includes('listenHost'));await player.waitForFunction(()=>document.querySelector('.song.selected')?.dataset.genre==='your-story'&&!document.getElementById('sound-player').paused&&document.getElementById('sound-player').currentTime>0);await page.goBack();
   await page.locator('.nl-genres').selectOption('thai-original');assert(await page.locator('[data-manual-play]').isDisabled());await page.locator('.nl-genres').selectOption('kpop-original');await page.locator('[data-manual-play]').click();await player.waitForFunction(()=>document.querySelector('.song.selected')?.dataset.genre==='kpop-original'&&!document.getElementById('sound-player').paused);await page.goBack();
   await card.getByRole('button',{name:'생년월일 설정하기'}).click();await page.getByRole('dialog').getByRole('button',{name:'닫기',exact:true}).click();await page.locator('[data-mood=auto]').click();await page.locator('.nl-consent input').check();await page.locator('[name=birthDate]').fill('19900615');await page.locator('[name=fortuneAlerts]').check();await page.getByRole('button',{name:'저장',exact:true}).click();await card.getByRole('link',{name:'이 기기 알림 연결'}).waitFor();
   const saju=(await (await c.request.get(base+'/noa-bridge/listening.php')).json()).theme;
   assert(saju.personal&&saju.rankedMoods.length===2);assert(await page.locator('[data-listening-lane=whole] .nl-preview-track').count()>0);
   await page.locator('[data-mood=focus]').click();assert.equal(await page.locator('[data-mood=focus]').getAttribute('aria-pressed'),'true');await page.locator('[data-mood=auto]').click();
   await player.waitForFunction(()=>!document.getElementById('sound-player').paused&&document.getElementById('sound-player').currentTime>0);
   const whole=await player.evaluate(()=>queue().map(b=>b.dataset.genre));assert(new Set(whole).size>1);
   await player.locator('#next').click();assert.equal(await player.locator('.song.selected').getAttribute('data-genre'),whole[1]);await page.goBack();
   assert.equal(await page.locator('[data-mood=auto]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.nl-genres').inputValue(),'kpop-original');
   assert(await page.locator('[data-all-genre-mix]').isVisible());
   const choices=page.locator('[data-genre-choice]');assert.equal(await choices.count(),3);
   const offered=await choices.evaluateAll(nodes=>nodes.map(n=>n.dataset.genreChoice));assert.equal(new Set(offered).size,3);
   await page.locator('[data-listening-lane=suggested]').screenshot({path:out+'/saju-genre-choices-'+width+'.png'});
   for(const genre of offered){
    const choice=page.locator('[data-genre-choice="'+genre+'"]');const firstTitle=await choice.locator('..').locator('.nl-preview-track .nl-track-title').first().innerText();
    await choice.click();await player.waitForFunction(g=>{
     const active=document.querySelector('.song.selected'),audio=document.querySelector('#sound-player');
     return active?.dataset.genre===g&&!audio.paused&&audio.currentTime>0;
    },genre);
    assert(firstTitle.endsWith(await player.locator('.song.selected').getAttribute('data-title')));
    const keys=await player.evaluate(()=>queue().map(b=>[b.dataset.key,b.dataset.genre]));
    assert(keys.length&&keys.every(([,g])=>g===genre));await page.goBack();
   }
   await page.locator('.nl-genres').selectOption('your-story');await page.locator('[data-mood=calm]').click();await page.locator('[data-manual-play]').click();
   await player.waitForFunction(()=>document.querySelector('.song.selected')?.dataset.genre==='your-story'&&!document.getElementById('sound-player').paused);
   assert(await player.evaluate(()=>queue().every(b=>b.dataset.genre==='your-story')));await page.goBack();
   await page.locator('[data-all-genre-mix]').click();await player.waitForFunction(()=>!document.getElementById('sound-player').paused);
   assert(await player.evaluate(()=>new Set(queue().map(b=>b.dataset.genre)).size>1));await page.goBack();
   report.allCatalogAndManualPlayback=true;
   report.sajuGenreSelectors??=[];report.sajuGenreSelectors.push({width,distinct:offered.length,allThreeStartMatchingAudio:true});
   assert(await card.evaluate(n=>n.previousElementSibling.id==='noa-listening'));assert(await card.getByRole('link',{name:'이 기기 알림 연결'}).isVisible());await card.scrollIntoViewIfNeeded();await card.screenshot({path:out+'/fortune-'+width+'.png'});
   const headline=await card.locator('h3').innerText();await page.reload();await card.waitFor();assert.equal(await card.locator('h3').innerText(),headline);await card.getByRole('button').click();await page.locator('.nl-consent input').uncheck();await page.getByRole('button',{name:'저장',exact:true}).click();await card.getByRole('button',{name:'생년월일 설정하기'}).waitFor();assert.equal(await page.locator('[data-listening-lane=whole] .nl-preview-track').count(),0);await c.close();
  }report.fortuneAndMoodFallback=true;
 }
 if(!live){
  const c=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block',extraHTTPHeaders:{'X-QA-User':'queue-count','X-QA-Catalog':'large'}});
  // A listener without birth settings can start six cross-genre queues with a single tap.
  const noChart=await c.newPage();activePage=noChart;await noChart.goto(base+'/noa-music.php');
  await noChart.locator('.nl-music-discovery>summary').click();
  await noChart.locator('.nl-genres option[value="kpop-original"]').waitFor({state:'attached'});
  assert.equal(await noChart.locator('.nl-genres').inputValue(),'');
  const moodOrders=[];
  for(const [mood,label] of Object.entries({calm:'휴식',focus:'집중',comfort:'위로',energy:'활동',drive:'운전',walk:'산책'})){
   await noChart.locator('[data-mood='+mood+']').click();
   await noChart.waitForFunction(m=>NoaMusic.listeningSelection()?.mood===m&&queue().length===100&&!player.paused&&player.currentTime>0,mood);
   const keys=await noChart.evaluate(()=>queue().map(b=>b.dataset.key));assert.equal(new Set(keys).size,100);
   assert((await noChart.locator('#dock-listening-source').innerText()).includes('전체 장르 · '+label+' · 100곡'));
   assert(await noChart.evaluate(()=>new Set(queue().map(b=>b.dataset.genre)).size>1));
   assert.equal(await noChart.locator('[data-manual-play]').innerText(),label+' 100곡 듣기');
   await noChart.locator('#next').click();assert.equal(await noChart.locator('.song.selected').getAttribute('data-key'),keys[1]);
   moodOrders.push(keys.join(','));
  }
  assert.equal(new Set(moodOrders).size,6);await noChart.close();
  const before=await(await c.request.get(base+'/noa-bridge/listening.php')).json();
  const save=await c.request.post(base+'/noa-bridge/listening.php',{headers:{Origin:base,'X-NOA-CSRF':before.csrf},data:{revision:before.revision,profile:{genre:'kpop-original',timezone:'Asia/Seoul',consent:true,birthDate:'1990-06-15'}}});assert.equal(save.status(),200);
  const page=await c.newPage();activePage=page;await page.goto(base);await page.locator('[data-listening-lane=whole] .nl-preview-track').nth(9).waitFor();await page.getByRole('button',{name:'추천 100곡 듣기',exact:true}).click();
  const player=page.frames().find(f=>f.url().includes('listenHost'));assert(player);await player.waitForFunction(()=>queue().length===100&&!player.paused&&player.currentTime>0);
  const readQueue=()=>player.evaluate(()=>({keys:queue().map(b=>b.dataset.key),source:document.getElementById('dock-listening-source').textContent,src:player.getAttribute('src'),selected:selected.dataset.key}));
  const themeConfig=JSON.parse(await (await c.request.get(base+'/noa-design.json')).text());
  for(const theme of themeConfig.themes){
   const paint=await page.locator('[data-all-genre-mix]').evaluate((button,theme)=>{
    const root=document.documentElement;root.dataset.noaTheme=theme.id;
    for(const [name,value] of Object.entries(theme.tokens))root.style.setProperty('--noa-'+name,value);
    const color=value=>{const node=document.createElement('i');node.style.color=value;document.body.append(node);const rgb=getComputedStyle(node).color;node.remove();return rgb;};
    const css=getComputedStyle(button);return [button.disabled,css.backgroundColor===color(theme.tokens.accent),css.color===color(theme.tokens.accentText),css.opacity];
   },theme);
   assert.deepEqual(paint,[false,true,true,'1'],'enabled mix uses solid theme colors: '+theme.id);
  }
  const genresByTrack=await player.evaluate(()=>queue().slice(0,10).map(b=>NoaBrowse.genreName(b.dataset.genre)));
  const wholeQueue=await readQueue();assert.match(wholeQueue.source,/오늘의 공감 추천 · 100곡/);
  assert.equal(new URL(wholeQueue.src,base).searchParams.get('record'),wholeQueue.keys[0]);
  const heads=new Map();
  const stats=await player.evaluate(()=>({unique:new Set(queue().map(b=>b.dataset.key)).size,genres:new Set(queue().map(b=>b.dataset.genre)).size}));assert.equal(stats.unique,100);assert(stats.genres>1);
  await player.evaluate(()=>player.pause());await Promise.all([player.waitForNavigation({waitUntil:'domcontentloaded'}),player.evaluate(()=>location.reload())]);
  await player.waitForFunction(()=>queue().length===100&&recommendationQueue?.length===100);
  assert.deepEqual((await readQueue()).keys,wholeQueue.keys);assert.equal((await readQueue()).source,wholeQueue.source);
  await player.evaluate(()=>{select(queue()[98],true);move(1,true);});assert(await player.evaluate(()=>selected===queue()[99]));await player.evaluate(()=>move(1,true));assert(await player.evaluate(()=>selected===queue()[99]));
  await page.goBack();const cards=page.locator('[data-genre-choice]');assert.equal(await cards.count(),3);
  const previews=page.locator('[data-listening-lane=whole] .nl-track-genre');
  assert.deepEqual(await previews.allTextContents(),genresByTrack);
  assert(await previews.evaluateAll(nodes=>nodes.every(n=>getComputedStyle(n).fontSize==='12px'&&n.getBoundingClientRect().top>=n.previousElementSibling.getBoundingClientRect().bottom-1)));
  const offered=await cards.evaluateAll(nodes=>nodes.map(b=>b.dataset.genreChoice));
  for(const genre of offered){
   const card=page.locator('[data-genre-choice="'+genre+'"]');assert.match(await card.getAttribute('aria-label'),/10곡 듣기/);await card.click();
   await player.waitForFunction(g=>queue().length===10&&queue().every(b=>b.dataset.genre===g)&&!player.paused&&player.currentTime>0,genre);
   const recommended=await readQueue();assert.match(recommended.source,/추천 장르 · 10곡/);assert.notEqual(recommended.src,wholeQueue.src);heads.set(genre,recommended.src);
   assert.equal(new URL(recommended.src,base).searchParams.get('record'),recommended.keys[0]);
   await player.locator('.nl-music-discovery>summary').click();
   assert.equal(await player.locator('[data-genre-choice="'+genre+'"]').getAttribute('aria-pressed'),'true');
   assert.equal(await player.locator('.nl-listen-row>.nl-primary').innerText(),'공감 추천 듣기');await player.locator('.nl-listen-row>.nl-primary').click();assert.deepEqual((await readQueue()).keys,wholeQueue.keys);await player.locator('[data-genre-choice="'+genre+'"]').click();assert.deepEqual((await readQueue()).keys,recommended.keys);
   await player.locator('.nl-music-discovery>summary').click();await player.locator('#next').click();
   assert.equal((await readQueue()).selected,recommended.keys[1]);
   assert.equal(await player.evaluate(()=>new Set(queue().map(b=>b.dataset.key)).size),10);
   await player.evaluate(()=>{select(queue()[9],true);move(1,true);});assert(await player.evaluate(()=>selected===queue()[9]));await page.goBack();
  }
  for(const genre of offered){
   await page.locator('.nl-genres').selectOption(genre);await page.locator('[data-mood=calm]').click();await page.locator('[data-manual-play]').click();
   await player.waitForFunction(g=>queue().length===42&&queue().every(b=>b.dataset.genre===g)&&!player.paused&&player.currentTime>0,genre);
   const manual=await readQueue();assert.match(manual.source,/직접 선택 · 42곡/);assert.equal(manual.keys[0],'single:'+genre+':1');
   assert.equal(new URL(manual.src,base).searchParams.get('record'),manual.keys[0]);
   assert.notEqual(manual.src,wholeQueue.src);assert.notEqual(manual.src,heads.get(genre));
   await player.locator('#next').click();assert.equal((await readQueue()).selected,manual.keys[1]);await page.goBack();
  }
  await page.locator('.nl-genres').selectOption('');await page.locator('[data-mood=focus]').click();
  await player.waitForFunction(()=>NoaMusic.listeningSelection()?.scope==='catalogMood'&&queue().length===100&&!player.paused&&player.currentTime>0);
  assert.match((await readQueue()).source,/전체 장르 · 집중 · 100곡/);
  report.catalogMood={withoutBirthSettings:true,moods:4,unique:100,homeAfterClearingGenre:true};
  report.queueSizes={all:stats.unique,genreCards:offered.length,perGenre:10,manual:42,distinctAudio:true,finite:true,homeAndPlayerInSync:true};await c.close();
 }
 assert.deepEqual(report.errors,[]);report.ok=true;
}catch(error){report.failure=String(error);if(activePage&&!activePage.isClosed()){await activePage.screenshot({path:out+'/failure.png'}).catch(()=>{});writeFileSync(out+'/failure.html',await activePage.content().catch(()=>''));}throw error;}finally{if(server)writeFileSync(out+'/server.log',serverLog);writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close();server?.kill();}console.log('N80_PERSONAL_LISTENING_OK');
