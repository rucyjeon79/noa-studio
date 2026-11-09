import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=mkdtempSync(tmpdir()+'/n80-browser-ui-'),base='http://127.0.0.1:8086';
execFileSync('python',['tests/browser-relay/fixture.py',root]);mkdirSync('muvy-proof',{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8086','-t',root+'/html'],{stdio:'ignore'});
let browser;
try{
 browser=await chromium.launch({channel:'chrome',headless:true,chromiumSandbox:true});
 for(const theme of ['noa-ivory','noa-studio'])for(const width of [360,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies([{name:'qa_role',value:'admin',url:base}]);
  await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection-v2',JSON.stringify({theme,language:'ko'})),theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Only disposable fixtures. No production account or Google data is requested.
  await page.route('**/noa-bridge/**',r=>r.fulfill({json:{ok:true,member:true,admin:true,balance:0,remainingDays:0,groups:[]}}));
  await page.route('**/noa-login.php?*',r=>r.fulfill({contentType:'text/html',body:'<p>테스트 계정</p>'}));
  await page.route('**/noa-sitemap.php?*',r=>r.fulfill({json:{ok:true,groups:[]}}));
  let view={state:'disconnected'},sent,failRead=false,failPost=false,posts=0;
  await page.route('**/noa-browser-connect.php?api=1',async r=>{
   if(r.request().method()==='POST'){posts++;sent=r.request().postDataJSON();return r.fulfill({status:failPost?409:200,json:failPost?{error:'browser_frame_changed'}:{ok:true}});}
   return r.fulfill({status:failRead?503:200,json:failRead?{error:'unavailable'}:{ok:true,...view}});
  });
  failRead=width===360;
  await page.goto(base+'/noa-browser-connect.php');
  if(failRead){
   await page.getByText('연결 상태 확인 필요',{exact:true}).waitFor();
   assert.equal(await page.locator('#browser-stage').getAttribute('aria-busy'),'false');
   assert(!await page.locator('#browser-open').isEnabled());
   failRead=false;await page.locator('#browser-refresh').click();
  }
  await page.getByText('연결 화면을 열어 Google 로그인을 진행하세요.',{exact:true}).waitFor();
  await page.waitForFunction(()=>document.documentElement.classList.contains('noa-shell-wide')&&document.querySelector('#noa-account-bar'));
  assert(await page.getByRole('heading',{name:'Gemini·Flow 연결',exact:true}).isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  const nav=await page.locator('#noa-account-bar .noa-navigation-bar').boundingBox();
  const brand=await page.locator('#noa-account-bar .noa-account-brand').boundingBox();
  const shortcuts=await page.locator('#noa-account-bar .noa-account-shortcuts').boundingBox();
  assert(nav.height<=80,'header wraps into two rows');
  assert(Math.abs((brand.y+brand.height/2)-(shortcuts.y+shortcuts.height/2))<8,'header controls split');
  assert((await page.locator('#browser-open').boundingBox()).height>=44);
  assert(!await page.locator('#browser-interaction').isVisible());assert(!await page.locator('#browser-save').isVisible());
  await page.screenshot({path:`muvy-proof/browser-idle-${theme}-${width}.png`,fullPage:true});
  view={state:'queued',id:'fixture',expiresAt:Math.floor(Date.now()/1000)+900};
  await page.locator('#browser-open').click();
  await page.getByText('연결 준비 지연',{exact:true}).waitFor();
  assert(!await page.locator('#browser-interaction').isVisible());assert(await page.getByRole('button',{name:'연결 취소',exact:true}).isEnabled());
  await page.screenshot({path:`muvy-proof/browser-queued-${theme}-${width}.png`,fullPage:true});
  // A lease alone is not a visible browser. Keep controls hidden until a frame arrives.
  view={state:'active',id:'fixture',frameSeq:7,inputReady:true};
  await page.locator('#browser-refresh').click();
  await page.getByText('첫 화면을 불러오는 중',{exact:true}).waitFor();
  assert(!await page.locator('#browser-interaction').isVisible());
  const frame=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=1280;c.height=900;const x=c.getContext('2d');x.fillStyle='#fafafa';x.fillRect(0,0,1280,900);x.fillStyle='#333';x.font='32px sans-serif';x.fillText('ISOLATED BROWSER FIXTURE',60,100);return c.toDataURL('image/jpeg');});
  view={...view,frame,url:'https://accounts.google.com/'};
  await page.locator('#browser-interaction').waitFor({state:'visible'});
  await page.locator('#browser-text').fill('DUMMY_ONLY');
  const posted=page.waitForRequest(r=>r.url().includes('?api=1')&&r.method()==='POST');
  await page.locator('#browser-type button').click();sent=(await posted).postDataJSON();
  await page.waitForFunction(()=>document.querySelector('#browser-text').value==='');
  assert.equal(sent.event.text,'DUMMY_ONLY');assert.equal(sent.frameSeq,7);
  await page.locator('.browser-tools summary').click();
  assert(await page.getByRole('button',{name:'다음 입력란',exact:true}).isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'active overflow');
  await page.screenshot({path:`muvy-proof/browser-active-${theme}-${width}.png`,fullPage:true});
  failPost=true;await page.locator('[data-key=Tab]').click();
  await page.getByText('화면이 바뀌었습니다. 새 화면에서 다시 눌러 주세요.',{exact:true}).waitFor();
  failPost=false;failRead=true;await page.locator('#browser-save').click();
  await page.getByText('연결 상태를 불러오지 못했습니다. 상태 다시 확인을 눌러 주세요.',{exact:true}).waitFor();
  assert(!await page.locator('#browser-text').isEnabled());
  failRead=false;view={state:'saved'};const before=posts;await page.locator('#browser-refresh').click();
  await page.getByText('연결 저장 완료',{exact:true}).waitFor();assert.equal(posts,before,'refresh must not open a new session');
  assert(!await page.locator('#browser-screen').isVisible());assert(await page.locator('#browser-open').isEnabled());
  assert.equal(errors.length,0,errors.join('\n'));await context.close();
 }
 console.log('N80_BROWSER_UI_OK real-shell light dark mobile desktop idle queued frameless active retry input-cleared no-overflow');
}finally{await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});}
