import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const themes=JSON.parse(readFileSync('deploy/noa-design.json','utf8')).themes;
const musicStyles=[...readFileSync('deploy/noa-music.php','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');

// Real recommendation renderer, model and page CSS, with isolated catalogue and playback.
// No membership changes, account writes, AI requests or audio transactions.
export async function verifyListeningLayout(browser,out,report){
 for(const width of [320,390,768,1440])for(const theme of themes)for(const surface of ['home','music']){
  const context=await browser.newContext({viewport:{width,height:900},locale:'ko-KR',serviceWorkers:'block'});
  const errors=[],writes=[];const state={member:true,weatherVip:false,canPlay:true,genres:{'kpop-original':'K-POP','your-story':'당신의 이야기, 우리의 음악'},theme:{personal:false,mood:'calm',rankedMoods:['calm'],localDate:'2026-11-05',period:'day'},profile:null,popular:{},library:[],revision:1};
  await context.route('**/*',r=>{const req=r.request(),u=new URL(req.url());if(req.method()!=='GET'){writes.push(u.pathname);return r.abort();}if(u.origin!=='https://listening.fixture')return r.abort();
   if(u.pathname==='/noa-bridge/listening.php')return r.fulfill({contentType:'application/json',body:JSON.stringify(state)});
   if(u.pathname==='/cover.jpg')return r.fulfill({contentType:'image/jpeg',body:readFileSync('public/splash/rain-g2-c.jpg')});
   if(u.pathname==='/missing.jpg')return r.fulfill({status:404,body:''});
   if(/\.(css|js)$/.test(u.pathname))return r.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'text/javascript',body:readFileSync('deploy'+u.pathname)});
   return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('https://listening.fixture/'+(surface==='music'?'noa-music.php':''));
  const tokens=Object.entries(theme.tokens).map(([k,v])=>'--noa-'+k+':'+v).join(';');
  const host='<section id="noa-listening" data-noa-listening="'+surface+'"></section>';
  await page.setContent(`<!doctype html><html lang="ko" class="noa-member-ui noa-shell-wide" data-noa-style="starlight" data-noa-precision="1" data-noa-theme="${theme.id}" style="${tokens}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${surface==='music'?'<style>'+musicStyles+'</style>':''}${['noa-ui.css','noa-starlight.css','noa-listening.css','noa-music-vinyl.css','noa-member-surfaces.css'].map(f=>'<link rel="stylesheet" href="/'+f+'">').join('')}</head><body class="noa-page ${surface==='music'?'noa-sound-page noa-record-room':''}"><main class="${surface==='home'?'noa-main':''}">${surface==='music'?'<details class="nl-music-discovery" open><summary>맞춤으로 추천듣기</summary>'+host+'</details>':host}</main></body></html>`);
  await page.evaluate(()=>{
   window.fixtureRows=Array.from({length:18},(_,i)=>({key:'track-'+i,title:i===0?'당신의 이야기, 우리의 음악 · 길어진 곡 제목도 흐트러짐 없이':i===1?'Midnight Breeze':'별무리의 하루 '+(i+1),genre:'kpop-original',audio:'/fixture-'+i+'.mp3',audioSha:'sha-'+i,moodScores:{calm:4},ep:String(i+1),registeredAt:100-i,thumb:i%3===0?'/cover.jpg':i%3===1?'':'/missing.jpg'}));
   window.playCalls=[];window.fixtureSelection=null;
   const played=(keys,kind,genre)=>{playCalls.push({keys,kind,genre});fixtureSelection={scope:kind,genre,mood:'calm',mode:'now',label:'휴식 '+keys.length+'곡'};return true;};
   window.NoaMusic={catalog:()=>fixtureRows,listeningSelection:()=>fixtureSelection,playMoodMix:(keys)=>played(keys,'catalogMood',''),playQueue:(keys,g)=>played(keys,'genre',g),playRecommendedMix:(keys)=>played(keys,'all',''),showCategories:()=>{}};
  });
  await page.addScriptTag({content:readFileSync('deploy/noa-listening-model.js','utf8')});await page.addScriptTag({content:readFileSync('deploy/noa-listening.js','utf8')});
  try{
   await page.locator('.nl-results .nl-track').first().waitFor();
   await page.locator('.nl-results').evaluate(e=>Promise.all(e.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
   assert(await page.locator('[data-manual-play]').isHidden(),'no unexplained disabled play button before a mood is chosen');assert(await page.locator('.nl-manual-hint').isVisible());
   const geometry=await page.evaluate(()=>{
    const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    const manual=document.querySelector('[data-listening-lane=manual]'),end=[...manual.children].filter(e=>e.getBoundingClientRect().height>0).at(-1);
    const moods=[...document.querySelectorAll('.nl-moods button')].map(e=>({button:box(e),icon:box(e.querySelector('svg'))}));
    const tabs=document.querySelector('.nl-tabs');
    return {tail:box(manual).bottom-box(end).bottom,empty:[...document.querySelectorAll('.nl-preview:empty,.nl-genre-cards:empty')].map(e=>box(e).h),moods,tabs:box(tabs),tabScroll:tabs.scrollWidth,tabButtons:[...tabs.children].map(box),tracks:[...document.querySelectorAll('.nl-track')].map(e=>({button:box(e),art:box(e.querySelector('.nl-track-art')),copy:box(e.querySelector('.nl-track-copy')),play:box(e.lastElementChild)})),overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert(!geometry.overflow,JSON.stringify({surface,width,geometry}));assert(geometry.empty.every(h=>h===0),'empty containers keep grid gaps');assert(geometry.tail>=19&&geometry.tail<=25,'unnecessary space below mood controls '+geometry.tail);
   assert.equal(geometry.moods.length,8);for(const item of geometry.moods){assert(item.button.h>=48);assert(Math.abs(item.icon.x-item.button.x-13)<1,'mood icon column moves by label length');assert(item.icon.right<=item.button.right-10);}
   assert(geometry.tabScroll<=geometry.tabs.w+1,'tab strip requires sideways scrolling');assert.equal(geometry.tabButtons.length,5);assert(geometry.tabButtons.every(b=>b.h>=44&&b.x>=geometry.tabs.x-.5&&b.right<=geometry.tabs.right+.5));assert.equal(new Set(geometry.tabButtons.map(b=>Math.round(b.h))).size,1);
   for(const item of geometry.tracks){assert(item.art.w===48&&item.art.h===48);assert(Math.abs(item.copy.x-item.art.right-12)<1);assert(item.copy.right<=item.play.x-11);assert(item.button.h>=76);}
   if([320,390,1440].includes(width)){await page.locator('[data-listening-lane=manual]').screenshot({path:out+'/listening-manual-'+surface+'-'+width+'-'+theme.id+'.jpg',type:'jpeg',quality:88});await page.locator('[data-listening-lane=browse]').screenshot({path:out+'/listening-browse-'+surface+'-'+width+'-'+theme.id+'.jpg',type:'jpeg',quality:88});}
   await page.locator('.nl-tabs [data-mode=library]').click();assert.match(await page.locator('.nl-results').innerText(),/아직 보관한 곡이 없어요/);assert(await page.locator('.nl-tabs [data-mode=library]').evaluate(e=>document.activeElement===e));
   await page.locator('.nl-tabs [data-mode=latest]').click();await page.locator('.nl-results .nl-track').first().click();assert.equal(await page.evaluate(()=>playCalls.length),1);
   await page.locator('.nl-genres').selectOption('kpop-original');await page.locator('.nl-moods [data-mood=calm]').click();assert.equal(await page.evaluate(()=>playCalls.length),1,'choosing a mood within a genre must wait for play');assert(await page.locator('.nl-manual-hint').isHidden());assert(await page.locator('[data-manual-play]').isEnabled());
   await page.locator('[data-manual-play]').click();assert.equal(await page.evaluate(()=>playCalls.length),2);assert.equal(await page.locator('.nl-moods [data-mood=calm]').getAttribute('aria-pressed'),'true');
   await page.locator('.nl-genres').selectOption('');await page.locator('.nl-moods [data-mood=calm]').click();assert.equal(await page.evaluate(()=>playCalls.length),3,'all-genre mood preserves immediate playback');
   assert.notEqual(await page.locator('.nl-results>*').first().evaluate(e=>getComputedStyle(e).animationName),'none');const motion=await page.locator('.nl-moods button').first().evaluate(e=>getComputedStyle(e).transitionDuration);assert.notEqual(motion,'0s');await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.nl-moods button').first().evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
   assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);report.fixtures.push({key:'listening-layout',surface,width,theme:theme.id,geometry,selectionAndPlayback:true,emptyLibrary:true,reducedMotion:true});
  }catch(error){await page.screenshot({path:out+'/listening-layout-failure-'+surface+'-'+width+'-'+theme.id+'.png',fullPage:true});throw error;}finally{await context.close();}
 }
 console.log('MEMBER_LISTENING_LAYOUT_AND_STATES_OK');
}
