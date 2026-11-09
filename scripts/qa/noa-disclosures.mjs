import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const styles=['noa-ui','noa-starlight','noa-ai-lab','noa-creative','noa-cinema','noa-listening','noa-muvy'];
const svg='<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
const html=`<!doctype html><html lang="ko" data-noa-style="starlight"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles.map(s=>`<link rel="stylesheet" href="/${s}.css">`).join('')}<style>body{margin:0}main{max-width:760px;margin:auto;padding:24px}h1{font-size:24px}main>details,section{margin:16px 0}summary{line-height:1.5}details>p{padding:8px 0}#noa-menu-drawer{position:static;display:block;width:auto;height:auto;padding:0;background:transparent}#noa-menu-drawer h3{display:flex;margin:0;font-size:16px}.noa-notice strong{overflow-wrap:anywhere}</style></head><body class="noa-page"><main><h1>AI LAB · 펼침 메뉴</h1>
<details class="lab-tool-switch" data-noa-local-disclosure><summary>다른 도구</summary><p>노래 창작하기 · 뮤비 생성기</p></details>
<details class="creative-intent-review"><summary>선택한 내용 보기</summary><p>선택한 장르와 곡의 분위기</p></details>
<section id="creative-record"><details class="creative-ai-original"><summary>현재 내용과 비교하기</summary><p>기존 곡 정보</p></details></section>
<div id="noa-menu-drawer"><details class="noa-drawer-category"><summary><h3>CREATOR LAB</h3></summary><p>작업실 메뉴</p></details></div>
<details class="noa-notice"><summary><span class="noa-notice-summary"><strong>등록 완료된 곡은 24시간 후 창작 목록에서 자동 정리됩니다</strong></span>${svg}</summary><p>등록된 곡은 그대로 보관됩니다.</p></details>
<details class="noa-notice noa-community-post"><summary><strong>노아의 일기</strong><span aria-hidden="true">⌄</span></summary><p>새로운 이야기</p></details>
<details class="wallet-guide"><summary><span>포인트 적립·사용 내역 보기</span>${svg}</summary><p>적립 내역</p></details>
<section id="yt-player"><div class="noa-media-details"><details><summary>가사 펼치기</summary><p>하루의 끝에</p></details></div></section>
<details class="mu-cut"><summary><strong>CUT 01</strong><span>달빛 아래 바닷가를 걷는 장면</span></summary><p>장면 내용</p></details>
<div class="nl-listen-row"><details class="nl-music-discovery"><summary><span class="nl-discovery-title">맞춤 추천으로 듣기</span></summary><p>추천 설정</p></details><button class="nl-primary" type="button">추천 재생</button></div>
<details id="initial" open><summary>이전 작업</summary><p>처음부터 열린 항목</p></details>
</main></body></html>`;
const server=createServer((req,res)=>{const path=req.url.split('?')[0];if(path==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}try{res.setHeader('Content-Type','text/css');res.end(readFileSync('deploy'+path));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({...(process.env.NOA_CHROMIUM?{executablePath:process.env.NOA_CHROMIUM}:{channel:'chrome'}),args:['--no-sandbox']});
mkdirSync('starlight-proof',{recursive:true});
const cue=el=>{const c=getComputedStyle(el,'::after');return{mask:c.maskImage,animation:c.animationName,transform:c.transform,width:c.width,marker:getComputedStyle(el,'::marker').content};};
try{
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.screenshot({path:`starlight-proof/disclosures-${width}-before.png`,fullPage:true});
  // The small arrow region itself must toggle the native details, with no JS handler.
  for(const summary of await page.locator('details:not(#initial)>summary').all()){
   const before=await summary.evaluate(cue);assert.match(before.mask,/svg/);assert.equal(before.animation,'noa-disclosure-hint');assert.equal(before.width,'26px',await summary.innerText());assert.equal(before.marker,'""');
   const box=await summary.boundingBox();assert(box.height>=44);
   await summary.click({position:{x:box.width-16,y:box.height/2}});
   assert(await summary.evaluate(e=>e.parentElement.open));await page.waitForTimeout(240);
   const after=await summary.evaluate(cue);assert.equal(after.animation,'none');assert.notEqual(before.transform,after.transform);
   await summary.press('Space');assert(!(await summary.evaluate(e=>e.parentElement.open)));
  }
  assert.equal(await page.locator('.noa-notice>summary>svg').isVisible(),false);
  assert.equal(await page.locator('.wallet-guide>summary>svg').isVisible(),false);
  assert.equal(await page.locator('.noa-community-post>summary>span[aria-hidden=true]').isVisible(),false);
  assert.equal(await page.locator('.noa-drawer-category h3').evaluate(e=>getComputedStyle(e,'::after').content),'none');
  const title=await page.locator('.nl-discovery-title').boundingBox(),play=await page.locator('.nl-primary').boundingBox();assert(title.width>0&&title.x+title.width<=play.x,'music title stays left of its independent play action');
  assert.equal((await page.locator('#initial>summary').evaluate(cue)).animation,'none');
  await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<details id="dynamic"><summary>새로 생성된 수정 이력</summary><p>내용</p></details>'));
  assert.match((await page.locator('#dynamic>summary').evaluate(cue)).mask,/svg/);
  await page.locator('#dynamic>summary').focus();await page.keyboard.press('Enter');assert(await page.locator('#dynamic').evaluate(e=>e.open));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  await page.screenshot({path:`starlight-proof/disclosures-${width}-dark.png`,fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const summary of await page.locator('details>summary').all())assert.equal((await summary.evaluate(cue)).animation,'none');
  const design=JSON.parse(readFileSync('deploy/noa-design.json','utf8')),light=design.themes.find(t=>t.id==='noa-ivory');
  await page.evaluate(tokens=>{for(const [key,value]of Object.entries(tokens))document.documentElement.style.setProperty('--noa-'+key,value,'important');},light.tokens);
  await page.screenshot({path:`starlight-proof/disclosures-${width}-light.png`,fullPage:true});
  console.log('PASS disclosure arrow click, keyboard, dynamic content, duplicate arrows, reduced motion, layout:',width);
  await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
