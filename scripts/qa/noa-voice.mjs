import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8079',out='voice-proof',report=[];mkdirSync(out,{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8079','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'});
let browser;
try{for(const engine of ['chromium','webkit']){
 browser=await(engine==='webkit'?webkit.launch():chromium.launch({channel:'chrome',args:['--no-sandbox']}));
 for(const width of engine==='webkit'?[390]:[320,390,1280])for(const theme of ['noa-studio','noa-ivory'])for(const role of ['guest','member','vip','admin']){
 const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});await c.addCookies([{name:'qa_role',value:role,url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),theme);
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/');const bubble=p.locator('.ainoa-message');await bubble.waitFor();await p.waitForFunction(()=>document.querySelector('.ainoa-message p')?.textContent.startsWith('검증회원님')||document.querySelector('.ainoa-message p')?.textContent.startsWith('방문자님'));
 assert.equal(await bubble.getByText('확인했어요',{exact:true}).count(),0);const first=await bubble.innerText();assert(first.includes(role==='guest'?'비로그인':'1,234P'));if(role==='vip')assert(first.includes('12일'));const nav=p.locator(width<=760?'.noa-mobile-nav':'.noa-menu');assert.equal(await nav.locator(':scope > a').count(),5);
 const music=nav.locator('a').nth(3);if(['guest','member'].includes(role)){assert.equal(await music.getAttribute('href'),null);await music.click({force:true});await p.waitForFunction(()=>document.querySelector('.ainoa-message p').textContent.includes('VIP회원'));assert.equal(new URL(p.url()).pathname,'/');}
 if(width===390&&engine==='chromium')await p.screenshot({path:`${out}/${role}-${theme}-mobile.png`});if(width===1280&&role==='vip')await p.screenshot({path:`${out}/${role}-${theme}-desktop.png`});
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const box=await bubble.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1);const button=await bubble.locator('button').boundingBox();assert(button.height>=44);

 const bar=p.locator('#noa-account-bar');assert.equal(await bar.locator('.noa-account-shortcut').count(),4);const brandBox=await bar.locator('.noa-account-brand').boundingBox(),shortBox=await bar.locator('.noa-account-shortcuts').boundingBox();assert(shortBox.x>=brandBox.x+brandBox.width-1);assert((await bar.boundingBox()).height<=64);
 if(width===390&&role==='vip'){
  await p.waitForTimeout(11000);assert(!(await bubble.isVisible()),'ordinary welcome dismisses without acknowledgement');
  await p.evaluate(()=>{Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.qaShared=data;}});Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.qaCopied=text;}}});});
  await bar.getByRole('button',{name:'공유하기',exact:true}).click();const share=p.locator('#noa-share-dialog');await share.waitFor();assert.equal(await share.locator('input').inputValue(),'https://noastudio.ai.kr/noa-install.php');assert((await share.locator('[data-share=sms]').getAttribute('href')).includes(encodeURIComponent('https://noastudio.ai.kr/noa-install.php')));await share.getByRole('button',{name:'링크 복사',exact:true}).click();assert.equal(await p.evaluate(()=>window.qaCopied),'https://noastudio.ai.kr/noa-install.php');await p.screenshot({path:`${out}/share-${engine}-${theme}.png`});await share.getByRole('button',{name:'카카오톡으로 공유',exact:true}).click();assert.equal(await p.evaluate(()=>window.qaShared.url),'https://noastudio.ai.kr/noa-install.php');await p.waitForFunction(()=>!document.getElementById('noa-share-dialog'));
  await p.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));await bar.getByRole('button',{name:'공유하기',exact:true}).click();await p.locator('#noa-share-dialog [data-share=kakao]').click();await p.locator('#noa-share-dialog .ainoa-message').filter({hasText:'링크를 복사해 카카오톡'}).waitFor();await p.getByRole('button',{name:'공유 창 닫기',exact:true}).click();
 }
 await p.goto(base+'/noa-sitemap.php');await p.locator('.noa-site-map-link').first().waitFor();const locked=p.locator('[data-noa-route="music"]');if(['guest','member'].includes(role)){assert.equal(await locked.getAttribute('href'),null);await locked.focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelector('.ainoa-message p')?.textContent.includes('VIP회원'));assert(new URL(p.url()).pathname==='/noa-sitemap.php');}else assert.equal(await locked.getAttribute('href'),'/noa-music.php');
 await p.evaluate(()=>window.NoaVoice.say('저장했습니다. <img src=x onerror=alert(1)>',{priority:true,requireAcknowledgement:true,force:true}));await p.waitForFunction(()=>document.querySelector('.ainoa-message p').textContent.includes('저장했어요'));assert.equal(await bubble.getByText('확인했어요',{exact:true}).count(),1);assert.equal(await bubble.locator('img').count(),0);
 await bubble.locator('button').click();for(let n=0;n<5&&await bubble.isVisible();n++)await bubble.locator('button').click();assert(!(await bubble.isVisible()));
 await p.evaluate(()=>{let el=document.createElement('p');el.setAttribute('role','alert');el.textContent='입력 내용을 확인해 주세요.';document.querySelector('main').append(el);});await p.waitForFunction(()=>document.querySelector('.ainoa-message p')?.textContent.includes('입력 내용'));
 // Notices emitted from a modal must be readable above that modal and survive closing it.
 await p.evaluate(()=>{const d=document.createElement('dialog');d.id='voice-modal';d.innerHTML='<p>댓글</p>';document.body.append(d);d.showModal();window.NoaVoice.say('댓글 저장에 실패했어요.',{priority:true,requireAcknowledgement:true,force:true});});
 assert(await p.locator('#voice-modal .ainoa-message').isVisible());await p.locator('#voice-modal .ainoa-message button').click();await p.evaluate(()=>{document.getElementById('voice-modal').close();});await p.waitForFunction(()=>document.getElementById('noa-ainoa').parentElement===document.body);
 await p.evaluate(()=>alert('이동 전 안내를 보관해요.'));await p.goto(base+'/');await p.waitForFunction(()=>document.querySelector('.ainoa-message p')?.textContent.includes('이동 전 안내'));
 if(role==='admin'){await p.goto(base+'/adm/index.php');await p.getByRole('button',{name:'확인',exact:true}).click();await p.waitForFunction(()=>document.querySelector('.ainoa-message p')?.textContent.includes('설정을 확인해'));assert(await p.locator('#noa-ainoa').isVisible());}
 if(role==='vip'){
  await p.goto(base+'/layout-test.php');await p.locator('.noa-world-chapter summary.noa-action').waitFor();
  const layout=await p.evaluate(()=>{const chapter=document.querySelector('.noa-world-chapter'),summary=chapter.querySelector('summary').getBoundingClientRect(),link=chapter.querySelector(':scope>a').getBoundingClientRect(),buttons=[...chapter.querySelectorAll('.noa-engagement button')].map(x=>x.getBoundingClientRect());return {overflow:document.documentElement.scrollWidth>innerWidth,toolsAligned:Math.abs(summary.y-link.y)<=1,reactionGap:buttons[1].x-buttons[0].right,targets:buttons.every(b=>b.width>=44&&b.height>=44)};});assert(!layout.overflow&&layout.toolsAligned&&layout.reactionGap<=1&&layout.targets,JSON.stringify(layout));await p.screenshot({path:`${out}/world-${engine}-${width}-${theme}.png`});
 }
 assert.deepEqual(errors,[]);report.push({engine,width,theme,role,fiveMenus:true,conditions:true,welcomeFacts:true,escape:true});await c.close();
 }
 await browser.close();browser=null;
}
}finally{if(browser)await browser.close();server.kill();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
console.log('AINOA_VOICE_UI_OK',report.length);
