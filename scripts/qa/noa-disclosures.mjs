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
const server=createServer((req,res)=>{const path=req.url.split('?')[0];if(path==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);}try{if(/\.(jpg|png|webp)$/.test(path)){res.setHeader('Content-Type','image/jpeg');return res.end(readFileSync('public/splash/rain-g2-c.jpg'));}res.setHeader('Content-Type',path.endsWith('.js')?'text/javascript':'text/css');res.end(readFileSync('deploy'+path));}catch{res.statusCode=404;res.end();}});
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
  const row=await page.locator('.nl-listen-row').boundingBox();assert(play.y+play.height<=row.y+row.height,'play control stays inside its row');
  assert.equal((await page.locator('#initial>summary').evaluate(cue)).animation,'none');
  await page.evaluate(()=>document.querySelector('main').insertAdjacentHTML('beforeend','<details id="dynamic"><summary>새로 생성된 수정 이력</summary><p>내용</p></details>'));
  assert.match((await page.locator('#dynamic>summary').evaluate(cue)).mask,/svg/);
  await page.locator('#dynamic>summary').focus();await page.keyboard.press('Enter');assert(await page.locator('#dynamic').evaluate(e=>e.open));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
  await page.waitForTimeout(240);
  await page.screenshot({path:`starlight-proof/disclosures-${width}-dark.png`,fullPage:true});
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const summary of await page.locator('details>summary').all())assert.equal((await summary.evaluate(cue)).animation,'none');
  const design=JSON.parse(readFileSync('deploy/noa-design.json','utf8')),light=design.themes.find(t=>t.id==='noa-ivory');
  await page.evaluate(tokens=>{for(const [key,value]of Object.entries(tokens))document.documentElement.style.setProperty('--noa-'+key,value,'important');},light.tokens);
  await page.screenshot({path:`starlight-proof/disclosures-${width}-light.png`,fullPage:true});
  console.log('PASS disclosure arrow click, keyboard, dynamic content, duplicate arrows, reduced motion, layout:',width);
  await page.close();
 }
 await verifyCollectionArrows(browser,`http://127.0.0.1:${server.address().port}`);
}finally{await browser.close();await new Promise(r=>server.close(r));}


// Exercise the actual ACT renderer and editor controls, not a reconstructed summary.
async function verifyCollectionArrows(browser,base){
 const musicStyles=[...readFileSync('deploy/noa-music.php','utf8').matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const themes=JSON.parse(readFileSync('deploy/noa-design.json','utf8')).themes;
 const css=['noa-music','noa-ui','noa-policy-20261024','noa-starlight','noa-listening','noa-engagement','noa-support','noa-music-vinyl','noa-member-surfaces'];
 for(const width of [320,390,1280])for(const theme of themes){
  const page=await browser.newPage({viewport:{width,height:1000},serviceWorkers:'block'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?group=original&genre=pop-original');
  const tokens=Object.entries(theme.tokens).map(([k,v])=>'--noa-'+k+':'+v+' !important').join(';');
  await page.setContent(`<!doctype html><html lang="ko" class="noa-member-ui noa-shell-wide" data-noa-style="starlight" data-noa-precision="1" data-noa-theme="${theme.id}" style="${tokens}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${musicStyles}</style>${css.map(f=>'<link rel="stylesheet" href="/'+f+'.css">').join('')}</head><body class="noa-page noa-sound-page"><main><section id="music-browse"></section><audio id="sound-player"></audio><div hidden><img id="dock-cover"><span id="dock-cover-empty">♫</span></div></main></body></html>`);
  await page.addScriptTag({url:'/noa-browse.js'});
  await page.evaluate(()=>{
   window.records=Array.from({length:34},(_,i)=>({key:'act-song-'+i,title:'별무리의 노래 '+(i+1),genre:'pop-original',ep:i+1,thumb:'/cover.jpg'}));
   let tree;tree=NoaBrowse.mount({host:document.querySelector('#music-browse'),rows:records,onChange:()=>tree.apply([]),onSelect:()=>{}});tree.apply([]);
  });
  for(const file of ['noa-music-vinyl.js','noa-browse-edit.js'])await page.addScriptTag({url:'/'+file});
  await page.evaluate(()=>NoaBrowseEdit.mount({host:document.querySelector('#music-browse'),rows:records}));
  const acts=page.locator('.noa-inline-act[data-act-number]');assert.equal(await acts.count(),4);
  const first=acts.first(),toggle=first.locator('.noa-list-toggle'),arrow=toggle.locator('svg'),edit=first.locator('.noa-act-edit');
  const closed=await arrow.evaluate(e=>{const c=getComputedStyle(e);return{border:c.borderTopWidth,radius:c.borderRadius,color:c.color,animation:c.animationName,transform:c.transform,width:c.width};});
  assert.equal(closed.width,'28px');assert.equal(closed.border,'1px');assert.equal(closed.radius,'50%');assert.equal(closed.animation,'noa-disclosure-hint');
  assert.equal(await edit.locator('svg').evaluate(e=>getComputedStyle(e).animationName),'none','edit pencil must not pulse');
  const a=await toggle.boundingBox(),b=await edit.boundingBox();assert(a.width>=44&&a.height>=44);assert(a.x+a.width<=b.x+.5,'arrow and pencil remain separate');
  assert(await first.locator('[data-browse-level="4"]').isHidden());
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert(await first.locator('[data-browse-level="4"]').isVisible());await page.waitForTimeout(240);
  const opened=await arrow.evaluate(e=>({animation:getComputedStyle(e).animationName,transform:getComputedStyle(e).transform}));assert.equal(opened.animation,'none');assert.notEqual(opened.transform,closed.transform);
  await first.screenshot({path:`starlight-proof/act-open-${width}-${theme.id}.png`});
  await toggle.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(await first.locator('[data-browse-level="4"]').isHidden());
  await toggle.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  // Opening another ACT must return the first arrow to its collapsed state.
  await acts.nth(1).locator('.noa-list-toggle').click();assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await acts.nth(1).locator('.noa-list-toggle').click();await page.waitForTimeout(240);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'actual ACT screen must not overflow');
  await page.locator('[data-browse-level="3"]').screenshot({path:`starlight-proof/act-closed-${width}-${theme.id}.png`});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await arrow.evaluate(e=>getComputedStyle(e).animationName),'none');assert.equal(await arrow.evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  await toggle.click();assert(await first.locator('[data-browse-level="4"]').isVisible(),'reduced motion keeps expansion working');
  assert.deepEqual(errors,[]);console.log('PASS actual ACT renderer: static cue, open/close, keyboard, sibling collapse, pencil separation, reduced motion',width,theme.id);await page.close();
 }
}
