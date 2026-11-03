import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const phase=process.env.NOA_THEME_PHASE||'candidate',source=process.env.NOA_SOURCE_ROOT||process.cwd(),out='room-theme-proof/'+phase+'-overlays';
const base='https://noastudio.ai.kr',results=[];mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
function luminance(value){const c=value.match(/[\d.]+/g).slice(0,3).map(v=>{const n=Number(v)/255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
async function contrast(locator,background){const paint=await locator.evaluate((el,bg)=>({foreground:getComputedStyle(el).color,background:getComputedStyle(bg?document.querySelector(bg):el).backgroundColor}),background);const values=[luminance(paint.foreground),luminance(paint.background)].sort((a,b)=>b-a),ratio=(values[0]+.05)/(values[1]+.05);assert(ratio>=4.5,JSON.stringify({paint,ratio}));return ratio;}
try{
 for(const [width,height] of [[320,568],[390,844],[768,600],[1600,900]])for(const mode of ['noa-ivory','noa-studio']){
  const c=await browser.newContext({viewport:{width,height},timezoneId:'Asia/Seoul',serviceWorkers:'block',reducedMotion:'reduce'}),p=await c.newPage(),errors=[],writes=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(r.method()!=='GET'&&new URL(r.url()).origin===base)writes.push(new URL(r.url()).pathname);});
  await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection-v2',JSON.stringify({theme})),mode);
  if(phase==='candidate')for(const name of ['noa-voice.js','noa-ainoa.css','noa-amt-fan.js','noa-amt-fan.css'])await c.route('**/'+name+'*',r=>r.fulfill({body:readFileSync(source+'/deploy/'+name),contentType:name.endsWith('.js')?'text/javascript':'text/css'}));
  // Isolated account facts reproduce the signed-in screenshot without any sign-in or account writes.
  const member=width===390||width===1600;
  await c.route('**/noa-ainoa.php?action=welcome',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,member,accountKey:'overlay-fixture',displayName:member?'검증회원':'방문자',subscription:width===390?'관리자 이용':'일반회원',remainingDays:null,balance:member?1234:null})}));
  await p.clock.install({time:new Date('2026-11-03T12:00:00+09:00')});
  await p.goto(base+'/');
  await p.waitForFunction(mode=>document.documentElement.dataset.noaTheme===mode&&window.NoaVoice?.getAccount()?.accountKey==='overlay-fixture',mode);
  const dialog=p.locator('#noa-amt-fan'),tip=p.locator('.ainoa-tip'),close=dialog.locator('.amt-close');await dialog.waitFor();
  assert(await dialog.evaluate(d=>d.matches(':modal')));
  assert.equal(await p.locator('#noa-ainoa').evaluate(e=>e.parentElement===document.body),true,'the search widget never moves into an unrelated popup');
  assert.equal(await tip.isVisible(),false,'welcome waits until the campaign is closed');
  await p.clock.fastForward(30000);assert.equal(await tip.isVisible(),false,'queued greeting does not appear or expire behind the popup');
  const bounds=await dialog.boundingBox(),button=await close.boundingBox();assert(bounds.x>=15&&bounds.x+bounds.width<=width-15&&bounds.y>=15&&bounds.y+bounds.height<=height-15,JSON.stringify({width,height,bounds}));assert(button.width>=44&&button.height>=44);
  assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth+1),'no horizontal scrolling inside the popup');
  const ratios={body:await contrast(dialog.locator('.amt-copy>p'),'#noa-amt-fan'),heading:await contrast(dialog.locator('h2'),'#noa-amt-fan'),caption:await contrast(dialog.locator('.amt-copy>small').first(),'#noa-amt-fan'),close:await contrast(close),action:await contrast(dialog.locator('.amt-fan-cta'))};
  assert.equal(await dialog.locator('.amt-fan-cta').getAttribute('href'),'https://www.aimusictown.com/competition/2?entryId=353');
  const art=await dialog.locator('.amt-art').evaluate(e=>getComputedStyle(e).backgroundImage);assert(art.includes(mode==='noa-ivory'?'theme-day-journey-v1.webp':'editorial-fans-stars.webp'));
  await p.screenshot({path:out+'/campaign-'+mode+'-'+width+'.png'});
  await dialog.locator('.amt-content').evaluate(e=>e.scrollTop=e.scrollHeight);
  const scrolledButton=await close.boundingBox();assert(Math.abs(button.y-scrolledButton.y)<1,'close stays in place while reading the entire popup');
  await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('#noa-amt-fan')),'focus remains in the modal');
  await close.click();await tip.waitFor({state:'visible'});
  assert((await tip.innerText()).includes(member?'1,234P':'비로그인'),'welcome retains exact account facts after closing');
  ratios.welcome=await contrast(tip.locator('p'),'.ainoa-tip');
  const bubble=await tip.boundingBox(),nav=await p.locator('.noa-mobile-nav').boundingBox();assert(bubble.x>=0&&bubble.x+bubble.width<=width+1&&bubble.y>=0&&bubble.y+bubble.height<=height,'welcome remains within the viewport');if(nav?.height)assert(bubble.y+bubble.height<=nav.y-8,'welcome clears the bottom navigation');
  await p.screenshot({path:out+'/welcome-'+mode+'-'+width+'.png'});
  // Reopening a pre-existing dialog (only its open attribute changes) pauses an already visible greeting.
  await p.locator('[data-noa-display-settings]:visible').first().click();await p.waitForFunction(()=>document.querySelector('.ainoa-tip').hidden);
  await p.clock.fastForward(30000);await p.locator('#noa-settings-dialog .noa-dialog-close').click();await tip.waitFor({state:'visible'});
  assert((await tip.innerText()).includes(member?'1,234P':'비로그인'),'paused greeting survives longer than its original lifetime');
  await tip.locator('.ainoa-message-dismiss').click();
  await p.evaluate(()=>{const d=document.createElement('dialog');d.id='overlay-validation';d.style.cssText='box-sizing:border-box;width:min(420px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;padding:20px';d.innerHTML='<h2>입력 확인</h2><form><label>제목<input aria-label="검증 제목" required></label><button type="submit">저장</button></form>';d.querySelector('form').onsubmit=e=>e.preventDefault();document.body.append(d);d.showModal();});
  await p.locator('#overlay-validation').getByRole('button',{name:'저장',exact:true}).click();await p.locator('#noa-voice-modal .ainoa-message').waitFor();
  assert.equal(await p.locator('#noa-ainoa').evaluate(e=>e.parentElement===document.body),true);
  assert.equal(await p.locator('#noa-voice-modal').evaluate(e=>getComputedStyle(e).position),'relative','required feedback is in the form flow');
  const flow=await p.locator('#overlay-validation').evaluate(d=>({formBottom:d.querySelector('form').getBoundingClientRect().bottom,messageTop:d.querySelector('#noa-voice-modal').getBoundingClientRect().top}));assert(flow.messageTop>=flow.formBottom+15,'feedback does not cover form controls');
  ratios.validation=await contrast(p.locator('#noa-voice-modal .ainoa-message p'),'#noa-voice-modal .ainoa-message');
  await p.getByLabel('검증 제목',{exact:true}).fill('입력 유지 확인');assert.equal(await p.getByLabel('검증 제목',{exact:true}).inputValue(),'입력 유지 확인');
  await p.screenshot({path:out+'/validation-'+mode+'-'+width+'.png'});
  await p.evaluate(()=>document.getElementById('overlay-validation').remove());await p.waitForFunction(()=>document.querySelector('#noa-ainoa .ainoa-message:not([hidden])'));
  await p.locator('.ainoa-message').getByRole('button',{name:'AInoa 말풍선 닫기'}).click();
  assert.equal(await p.locator('#noa-ainoa').count(),1);assert.equal(await p.locator('.ainoa-tip').count(),1);assert.deepEqual(errors,[]);assert.deepEqual(writes,[],'presentation checks do not write account data');
  results.push({phase,width,height,mode,member,ratios,queuedWelcome:true,pauseResume:true,inlineValidation:true});console.log('OVERLAY_READING_AND_ORDER_OK',JSON.stringify(results.at(-1)));await c.close();
 }
}catch(e){console.error('OVERLAY_CHECK_FAILED',e);let i=0;for(const c of browser.contexts())for(const p of c.pages()){try{await p.screenshot({path:out+'/failure-'+i+'.png',fullPage:true,timeout:10000});writeFileSync(out+'/failure-'+i+'.html',await p.content());}catch{}i++;}throw e;}
finally{await browser.close();writeFileSync(out+'/results.json',JSON.stringify(results,null,2));}
