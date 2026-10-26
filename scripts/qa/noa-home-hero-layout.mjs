import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const base='https://noastudio.ai.kr',phase=process.env.NOA_HERO_PHASE||'candidate',out='hero-layout-proof/'+phase;
mkdirSync(out,{recursive:true});
const candidate=phase==='candidate'?execFileSync('php',['-r',"define('_GNUBOARD_',true);$is_member=false;include 'deploy/noa-app/home.php';"],{encoding:'utf8'}):null;
const runtime=readFileSync('deploy/noa-hero.js','utf8'),browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']}),report=[];
const near=(a,b,label)=>assert(Math.abs(a-b)<2,label+': '+a+' vs '+b);
async function context(options={},genreRoll=0){
 const c=await browser.newContext({serviceWorkers:'block',...options});
 await c.addInitScript(roll=>{let call=0;Math.random=()=>call++?0:roll;},genreRoll);
 if(candidate){await c.route(base+'/',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:candidate}));await c.route('**/noa-hero.js*',r=>r.fulfill({contentType:'application/javascript',body:runtime}));}
 return c;
}
try{
 for(const theme of ['noa-studio','noa-ivory'])for(const[width,height]of [[360,800],[390,844],[430,932],[768,1024],[1024,1366],[568,320],[844,390],[1280,800],[1920,1080]]){
  const c=await context({viewport:{width,height},isMobile:width<800,hasTouch:width<800,reducedMotion:'reduce'});
  await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/',{waitUntil:'domcontentloaded'});
  await p.waitForFunction(theme=>document.documentElement.dataset.noaTheme===theme&&document.documentElement.hasAttribute('data-noa-precision'),theme);
  await p.waitForFunction(()=>{const v=document.getElementById('noa-hero-video');return v.currentTime>0&&!v.hidden;});
  const s=await p.evaluate(()=>{
   const h=document.querySelector('[data-home-section=hero]'),m=h.querySelector('.noa-hero-art'),copy=h.querySelector('.noa-hero-copy'),v=h.querySelector('video');
   const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   const picks=[...h.querySelectorAll('.noa-hero-pick')].filter(a=>!a.hidden&&a.getBoundingClientRect().height>0);
   return{hero:rect(h),media:rect(m),copy:rect(copy),actionWidth:h.querySelector('.noa-hero-actions').getBoundingClientRect().width,buttons:[...h.querySelectorAll('.noa-hero-actions a')].map(a=>({href:new URL(a.href).pathname,direction:getComputedStyle(a).flexDirection,overflow:a.scrollWidth>a.clientWidth+1,...rect(a)})),overflow:document.documentElement.scrollWidth>innerWidth+1,copyOverflow:copy.scrollHeight>copy.clientHeight+1,noticesFollow:h.nextElementSibling?.dataset.homeSection==='notices',fit:getComputedStyle(v).objectFit,clip:getComputedStyle(m).overflow,backdrop:getComputedStyle(m,'::before').display,genre:m.dataset.genre,label:document.getElementById('noa-hero-genre').textContent,description:document.getElementById('noa-hero-description').textContent,retryHidden:document.getElementById('noa-hero-play').hidden,animation:getComputedStyle(v).animationName,picks:picks.map(a=>({href:a.getAttribute('href'),title:a.querySelector('strong')?.textContent,...rect(a)})),discover:rect(h.querySelector('.noa-hero-discover'))};
  });
  assert(!s.overflow);assert(!s.copyOverflow,'hero supporting content overflows');assert(s.noticesFollow);near(s.hero.height,s.hero.width/(width>height?2:1),'whole card ratio');assert.equal(s.fit,'cover');assert.equal(s.clip,'hidden');assert.equal(s.backdrop,'none');assert.equal(s.genre,'kpop-original');assert.equal(s.label,'K-POP Original');assert(s.description.length>10);assert(s.retryHidden);assert.equal(s.animation,'none','reduced motion disables framing while video still plays');
  near(s.media.x,s.hero.x+1,'media left edge');near(s.media.y,s.hero.y+1,'media top edge');
  if(width>height){near(s.media.right,s.copy.x,'joined panels');near(s.media.height,s.copy.height,'matching panels');if(s.discover.height>=66)assert(s.picks.length>0,'unused supporting area');if(s.picks.length)near(s.picks.at(-1).bottom,s.discover.bottom,'supporting links fill the available area');}else{near(s.media.bottom,s.hero.bottom-1,'full portrait media behind copy');assert(s.copy.y>s.media.y,'copy overlays lower media');near(s.media.width,s.copy.width,'matching stacked widths');}
  if(s.discover.height>=48)assert(s.picks.length>0,'supporting space must contain useful links');near(s.copy.bottom,s.hero.bottom-1,'copy bottom');assert.deepEqual(s.buttons.map(a=>a.href),['/noa-youtube.php','/noa-sitemap.php']);near(s.buttons[0].y,s.buttons[1].y,'actions stay together');for(const b of s.buttons){assert.equal(b.direction,s.actionWidth>=280?'row':'column','responsive icon-label arrangement');assert(!b.overflow,'button label overflows');assert(b.width>=44&&b.height>=44);assert(b.bottom<=s.copy.bottom+1&&b.y>=s.copy.y);}
  assert.deepEqual(errors,[]);await p.screenshot({path:out+'/'+theme+'-'+width+'x'+height+'.jpg',type:'jpeg',quality:84});report.push({theme,width,height,...s});await c.close();
 }
 // Observe a complete original clip and prove framing never exposes an empty edge.
 const c=await context({viewport:{width:390,height:844},reducedMotion:'no-preference'}),p=await c.newPage();await p.goto(base+'/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>document.getElementById('noa-hero-video').currentTime>0);
 const src=await p.locator('#noa-hero-video').getAttribute('src');
 for(const[width,height]of [[390,844],[844,390]]){
  await p.setViewportSize({width,height});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const sample=await p.locator('#noa-hero-video').evaluate(v=>{const a=v.getAnimations()[0];if(!a)throw Error('missing gentle framing');a.pause();const h=v.closest('[data-home-section=hero]'),m=v.closest('.noa-hero-art'),copy=h.querySelector('.noa-hero-copy'),r=m.getBoundingClientRect(),fit=Math.max(r.width/v.videoWidth,r.height/v.videoHeight);const sample=t=>{a.currentTime=t;const z=new DOMMatrixReadOnly(getComputedStyle(v).transform).a;return{z,width:v.videoWidth*fit*z,height:v.videoHeight*fit*z,copyY:copy.getBoundingClientRect().y,cardHeight:h.getBoundingClientRect().height};};return{media:{width:r.width,height:r.height},start:sample(0),middle:sample(3000),end:sample(6000)};});
  for(const s of [sample.start,sample.middle,sample.end]){assert(s.z>=1);assert(s.width>=sample.media.width-1&&s.height>=sample.media.height-1,'exposed media edge');assert.equal(s.copyY,sample.start.copyY);assert.equal(s.cardHeight,sample.start.cardHeight);}assert(sample.middle.z>sample.start.z&&sample.middle.z<sample.end.z);
  await p.screenshot({path:out+'/motion-'+width+'.jpg',type:'jpeg',quality:84});
 }
 await p.waitForFunction(()=>document.getElementById('noa-hero-video').ended,null,{timeout:25000});const end=await p.locator('#noa-hero-video').evaluate(v=>({time:v.currentTime,duration:v.duration,loop:v.loop}));assert(end.time>=end.duration-.1);assert(!end.loop);assert.equal(await p.locator('#noa-hero-video').getAttribute('src'),src);await c.close();
 // Actual browser fallback: reject only the first automatic attempt, then click to play.
 const blocked=await context({viewport:{width:390,height:844}});await blocked.addInitScript(()=>{const play=HTMLMediaElement.prototype.play;let first=true;HTMLMediaElement.prototype.play=function(){if(first){first=false;return Promise.reject(new DOMException('fixture autoplay blocked','NotAllowedError'));}return play.call(this);};});const retry=await blocked.newPage();await retry.goto(base+'/',{waitUntil:'domcontentloaded'});await retry.locator('#noa-hero-play').waitFor({state:'visible'});await retry.screenshot({path:out+'/autoplay-retry.jpg',type:'jpeg',quality:84});await retry.locator('#noa-hero-play').click();await retry.waitForFunction(()=>document.getElementById('noa-hero-video').currentTime>0&&!document.getElementById('noa-hero-video').hidden);assert(await retry.locator('#noa-hero-play').isHidden());await blocked.close();
 const cover=await context({viewport:{width:390,height:844},reducedMotion:'reduce'},.999);const coverPage=await cover.newPage();await coverPage.goto(base+'/',{waitUntil:'domcontentloaded'});await coverPage.waitForFunction(()=>document.querySelector('.noa-hero-art').dataset.genre==='cover-reborn'&&document.getElementById('noa-hero-video').currentTime>0);assert.equal(await coverPage.locator('#noa-hero-genre').textContent(),'AInoa의 유명곡 커버');assert((await coverPage.evaluate(()=>window.NoaBrowse.names['cover-reborn'])).includes('🎤'),'canonical genre name must remain intact');await coverPage.screenshot({path:out+'/cover-clean-390.jpg',type:'jpeg',quality:84});await cover.close();
 writeFileSync(out+'/report.json',JSON.stringify({ok:true,phase,cases:report.length,noMediaGaps:true,genreIdentified:true,completePlayback:true,blockedAutoplayRetry:true,cleanCoverGenre:true,physicalAndroid:false,report},null,2));console.log('NOA_HERO_LAYOUT_OK',report.length,'NO_GAPS GENRE COMPLETE_PLAYBACK RETRY_OK');
}catch(error){for(const c of browser.contexts())for(const p of c.pages())try{await p.screenshot({path:out+'/failure.jpg'});writeFileSync(out+'/failure.html',await p.content());}catch{}throw error;}finally{await browser.close();}
