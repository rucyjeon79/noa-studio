import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const assetNames=['noa-ui.js','noa-member-surfaces.css','noa-member-surfaces.js','noa-starlight.css','noa-ainoa.js','noa-ainoa.css','noa-voice.js','noa-listening.js','noa-music-vinyl.css'];
const design=JSON.parse(readFileSync('deploy/noa-design.json','utf8'));
export async function verifyExperience(browser,phase,out,report){
 if(phase==='live')for(const name of assetNames){const response=await fetch('https://noastudio.ai.kr/'+name+'?experience='+process.env.GITHUB_SHA,{signal:AbortSignal.timeout(25000)});assert(response.ok);assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),createHash('sha256').update(readFileSync('deploy/'+name)).digest('hex'),'operating asset differs: '+name);}
 const source=readFileSync('deploy/noa-ui.js','utf8'),registry=source.slice(source.indexOf('const icons='),source.indexOf('let access=')),decorators=source.slice(source.indexOf('function icon(key)'),source.indexOf('function navItem('));
 for(const width of [320,390,768,1440])for(const theme of design.themes){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block'});context.setDefaultTimeout(10000);
  const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  const state={member:true,weatherVip:true,canPlay:true,genres:{'kpop-original':'K-POP'},theme:{personal:false,mood:'calm',rankedMoods:['calm'],localDate:'2026-11-05',period:'day',notice:'추천 기준'},profile:null,popular:{},library:[],revision:1,csrf:'fixture'};
  await context.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(req.method()!=='GET'){writes.push(u.pathname);return r.abort();}if(u.origin!=='https://experience.fixture')return r.abort();
   const json=data=>r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
   if(u.pathname==='/noa-bridge/listening.php')return json(state);
   if(u.pathname==='/noa-bridge/listening-weather.php')return json({source:'studio-edition',weather:{sun:['☀','맑음',[['차분하게 쉬기','오늘은 서두르지 말고 편안한 리듬을 따라가요.',['calm','comfort','sleep']]]]}});
   if(u.pathname==='/noa-ainoa.php')return json({ok:true,member:true,accountKey:'experience-fixture',conversation:false,capabilities:{member:true,music:true},balance:1234});
   if(existsSync('deploy'+u.pathname)&&/\.(js|css|png|webp)$/.test(u.pathname))return r.fulfill({body:readFileSync('deploy'+u.pathname),contentType:u.pathname.endsWith('.js')?'text/javascript':u.pathname.endsWith('.css')?'text/css':u.pathname.endsWith('.png')?'image/png':'image/webp'});
   return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
  });
  await page.goto('https://experience.fixture/');
  const tokens=Object.entries(theme.tokens).map(([k,v])=>'--noa-'+k+':'+v).join(';');
  // Reuse the signed-in MY template. Only its server-side authorization and description are fixture values.
  const template=readFileSync('deploy/noa-my.php','utf8');let activity=template.match(/<section class="noa-section" id="noa-my-activity">[\s\S]*?<\/section>/)[0];activity=activity.replace(/<\?[\s\S]*?\?>/g,m=>m.startsWith('<?=')?'새 글과 댓글·답글, 반응을 확인하세요.':'');
  await page.setContent(`<!doctype html><html lang="ko" class="noa-member-ui noa-shell-wide" data-noa-style="starlight" data-noa-precision="1" data-noa-theme="${theme.id}" style="${tokens}"><head><meta name="viewport" content="width=device-width,initial-scale=1">${['noa-ui.css','noa-starlight.css','noa-listening.css','noa-notifications.css','noa-music-vinyl.css','noa-ainoa.css','noa-member-surfaces.css'].map(n=>'<link rel="stylesheet" href="/'+n+'">').join('')}</head><body class="noa-page"><main class="noa-main">${activity}<section data-noa-listening="music" id="noa-listening"></section><audio id="sound-player"></audio></main></body></html>`);
  await page.addScriptTag({content:'(()=>{const root=document.documentElement,g5=false;'+registry+decorators+';decorate();})();'});
  const activityBox=await page.locator('#noa-my-activity').evaluate(e=>{const a=e.querySelector('nav').getBoundingClientRect(),b=e.querySelector('.nnt-entry').getBoundingClientRect();return {gap:b.top-a.bottom,icon:e.querySelector('.nnt-entry svg')?.dataset.noaSymbol,direct:!!e.querySelector('.nnt-entry>.nnt-entry-copy')};});
  assert.equal(activityBox.icon,'bell');assert(activityBox.direct);assert.equal(activityBox.gap,16);
  await page.locator('#noa-my-activity').screenshot({path:out+'/my-activity-'+width+'-'+theme.id+'.png'});
  await page.addScriptTag({content:readFileSync('deploy/noa-ainoa.js','utf8')});
  await page.addScriptTag({content:readFileSync('deploy/noa-voice.js','utf8')});
  await page.addScriptTag({content:readFileSync('deploy/noa-listening-model.js','utf8')});
  await page.evaluate(()=>{
   window.testCatalog=Array.from({length:130},(_,i)=>({key:'track-'+i,title:'마음을 쉬게 하는 곡 '+(i+1),genre:'kpop-original',audio:'/fixture-'+i+'.mp3',audioSha:'sha-'+i,moodTags:['calm'],moodScores:{calm:4},ep:String(i+1)}));
   window.playCalls=[];window.selection=null;window.rejectPlayback=false;
   window.NoaMusic={catalog:()=>testCatalog,listeningSelection:()=>selection,playWeather:(keys,path)=>{playCalls.push({keys,path});if(rejectPlayback)return false;selection={scope:'weather',label:'내 마음 날씨 · '+keys.length+'곡'};return true;}};
  });
  await page.addScriptTag({content:readFileSync('deploy/noa-listening.js','utf8')});
  await page.getByRole('button',{name:'내 마음 날씨 고르기',exact:true}).click();
  const room=page.locator('#ainoa-conversation');await room.getByRole('button',{name:'☀ 맑음',exact:true}).click();await room.getByRole('button',{name:'차분하게 쉬기',exact:true}).click();
  await room.getByRole('button',{name:'100곡 이어 듣기',exact:true}).waitFor();
  assert.equal(await page.locator('#noa-mind-weather .nl-weather-choices').count(),0,'choices belong to the conversation');
  assert.equal(await room.evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  const box=await room.boundingBox();assert(box.x>=11&&box.x+box.width<=width-11&&box.y>=15&&box.y+box.height<=900-15);
  const motion=await room.evaluate(e=>getComputedStyle(e).transitionDuration);assert.notEqual(motion,'0s');
  await page.screenshot({path:out+'/weather-chat-'+width+'-'+theme.id+'.png'});
  await room.getByRole('button',{name:'100곡 이어 듣기',exact:true}).click();
  assert(await room.isVisible(),'queued is not the same as playing');
  assert.equal(await page.evaluate(()=>playCalls.length),1);const queue=await page.evaluate(()=>playCalls[0]);assert.equal(queue.keys.length,100);assert.equal(new Set(queue.keys).size,100);assert.equal(queue.path.length,100);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('noa-media-activity',{detail:{type:'youtube',key:playCalls[0].keys[0]}})));assert(await room.isVisible(),'unrelated playback cannot close the room');
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('noa-media-activity',{detail:{type:'audio',key:playCalls[0].keys[0]}})));
  await page.waitForFunction(()=>document.querySelector('#ainoa-conversation')?.textContent.includes('첫 곡이 재생되고 있어요'));
  await room.waitFor({state:'hidden',timeout:5000});
  // Rejection keeps the conversation open and permits another real user gesture.
  await page.getByRole('button',{name:'내 마음 날씨 고르기',exact:true}).click();await page.evaluate(()=>window.rejectPlayback=true);
  await room.getByRole('button',{name:'100곡 이어 듣기',exact:true}).click();await room.getByRole('button',{name:'다시 재생하기',exact:true}).waitFor();assert(await room.isVisible());
  await room.getByRole('button',{name:'AInoa 대화 닫기',exact:true}).click();
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{const d=document.createElement('dialog');d.id='menu-fixture';d.innerHTML='<h2>전체 메뉴</h2><button>메뉴 닫기</button>';document.body.append(d);d.showModal();NoaVoice.say('저장하지 못했어요. 다시 확인해 주세요.',{priority:true,force:true,requireAcknowledgement:true});});
  const tip=page.locator('#noa-voice-modal .ainoa-tip');await tip.waitFor({state:'visible'});
  assert.equal(await page.locator('#noa-voice-modal .ainoa-notice-portrait').count(),1);
  const anchor=await page.locator('#noa-voice-modal').boundingBox(),bubble=await tip.boundingBox();assert(anchor.y>450&&bubble.y>=0&&bubble.y+bubble.height<=anchor.y-8&&bubble.x>=0&&bubble.x+bubble.width<=width,'speech stays beside AInoa above the bottom controls');
  assert.equal(await tip.evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await page.screenshot({path:out+'/ainoa-menu-notice-'+width+'-'+theme.id+'.png'});
  assert.deepEqual(writes,[],'no account writes or AI calls without explicit consent');assert.deepEqual(errors,[]);
  report.fixtures.push({key:'member-experience',width,theme:theme.id,activityGap:16,queue:100,playingAcknowledged:true,rejectedPlaybackRetained:true,noticeAnchor:true,motionAndReducedMotion:true});await context.close();
 }
 console.log('MEMBER_EXPERIENCE_OK');
}
