import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,openSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8077',api=base+'/noa-bridge/muvy.php',out='muvy-proof';mkdirSync(out,{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8077','-t','/tmp/noa-muvy-fixture/html','/tmp/noa-muvy-fixture/html/router.php'],{stdio:['ignore',openSync(out+'/php.log','w'),openSync(out+'/php-error.log','w')]}),browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']}),report={environment:'isolated native session fixture; provider responses deterministic; no paid calls',browser:[]};
try{
 const contexts={};for(const role of ['guest','member','staff','admin']){contexts[role]=await browser.newContext({serviceWorkers:'block'});await contexts[role].addCookies([{name:'qa_role',value:role,url:base}]);}
 let ready=false;for(let i=0;i<50&&!ready;i++){try{ready=(await contexts.guest.request.get(api)).status()===403;}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert(ready);
 for(const role of ['guest','member','staff'])for(const path of ['/noa-ai-lab.php','/noa-bridge/muvy.php','/noa-muvy-panel.php']){const r=await contexts[role].request.get(base+path);const memberLab=role!=='guest'&&path==='/noa-ai-lab.php';assert.equal(r.status(),memberLab?200:403);const html=await r.text();assert(!html.includes('mu-key'));if(memberLab){assert(html.includes('data-n80-hub'));assert(!html.includes('/noa-muvy.js'));};}
 const status=await(await contexts.admin.request.get(api)).json();assert.equal(status.config.configured,false);assert.equal(status.config.enabled,false);const csrf=status.csrf;
 const post=async data=>{const r=await contexts.admin.request.post(api,{headers:{Origin:base,'X-NOA-CSRF':csrf},data});return{status:r.status(),body:await r.json()};};
 assert.equal((await contexts.admin.request.post(api,{data:{action:'save'}})).status(),403);assert.equal((await contexts.admin.request.post(api,{headers:{Origin:'https://other.example','X-NOA-CSRF':csrf},data:{action:'save'}})).status(),403);
 const page=await contexts.admin.newPage(),errors=[];let catalogReads=0;page.on('request',r=>{if(r.url().includes('view=labChoices'))catalogReads++;});page.on('pageerror',e=>{errors.push(e.message);console.log('MUVY_BROWSER_ERROR',e.stack);});page.on('dialog',()=>{throw Error('untrusted_markup_executed');});await page.goto(base+'/noa-ai-lab.php#lab-muvy');try{await page.waitForFunction(()=>document.querySelector('#mu-connection')?.textContent.includes('AI 서비스 연결 필요'));}catch(error){writeFileSync(out+'/failure.html',await page.content());console.log('MUVY_INITIAL_STATE',page.url(),await page.locator('body').innerText());throw error;}assert.equal(new URL(page.url()).searchParams.get('tool'),'muvy');
 assert(await page.getByRole('link',{name:'뮤비 대본·프롬프트',exact:true}).isVisible());await page.locator('#mu-ep').fill('EP.12');await page.locator('#mu-title').fill('빛이 닿는 순간');await page.locator('#mu-lyrics').fill('밤을 따라 걸어가던 작은 마음이 빛을 만나는 순간, 우리는 다시 웃어요.');await page.locator('#mu-save').click();await page.waitForFunction(()=>document.querySelector('#mu-save-state').textContent.includes('저장됨')&&document.querySelector('#mu-project').value!=='');const firstId=await page.locator('#mu-project').inputValue();assert(firstId);
 await page.reload();await page.waitForFunction(()=>document.querySelectorAll('#mu-project option').length===2);await page.locator('#mu-project').selectOption(firstId);await page.waitForFunction(()=>document.querySelector('#mu-title').value==='빛이 닿는 순간');assert(await page.locator('[data-mu-step=script]').isDisabled());
 await page.locator('.mu-settings summary').click();await page.locator('#mu-key').fill('test-xai-key-not-real');await page.locator('#mu-enabled').check();await page.locator('#mu-config-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#mu-connection').textContent.includes('사용 중'));assert.equal(await page.locator('#mu-key').inputValue(),'');
 for(const stage of ['script','c1','c2','c3','publish']){await page.locator('[data-mu-step='+stage+']').click();await page.waitForFunction(stage=>document.querySelector('[data-mu-step='+stage+']').textContent.startsWith('✓'),stage);}
 assert.equal(await page.locator('.mu-cut').count(),30);assert.equal(await page.locator('.mu-publish textarea').count(),4);await page.locator('[data-mu-extra="1"]').click();await page.waitForFunction(()=>document.querySelectorAll('.mu-cut').length===32);
 const snapshot=await(await contexts.admin.request.get(api+'?id='+firstId)).json();assert.equal(snapshot.project.pack.cuts.length,30);assert(snapshot.project.pack.cuts.every(c=>c.gemini&&c.grok));assert.equal(snapshot.project.pack.extras[1].length,2);assert(!JSON.stringify(snapshot).includes('test-xai-key-not-real'));assert(snapshot.project.pack.publish.youtubeTitle.includes('빛이 닿는 순간'));
 const download=page.waitForEvent('download');await page.locator('#mu-export').click();const file=await download;assert(file.suggestedFilename().endsWith('.json'));const exported=JSON.parse(readFileSync(await file.path(),'utf8'));assert.deepEqual(exported.pack,snapshot.project.pack);
 await page.locator('#mu-import-file').setInputFiles({name:'original-grok-pack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({state:{pack:exported.pack}}))});await page.waitForFunction(id=>document.querySelector('#mu-project').value!==id,firstId);assert.equal(await page.locator('.mu-cut').count(),32);
 // A malformed import may never replace saved work or quietly reorder cuts.
 const bad=structuredClone(exported.pack);bad.cuts[4].n=4;const rejected=await post({action:'save',id:'f'.repeat(32),expectedRevision:0,pack:bad});assert.equal(rejected.status,400);assert.equal(rejected.body.error,'cut_sequence');
 const calls=JSON.parse(readFileSync('/tmp/noa-muvy-fixture/provider-calls.json','utf8'));assert.equal(calls.length,9);assert.equal(calls.filter(c=>c.stage==='c1').length,2);assert.equal(snapshot.callsToday,9);
 // Enforce configured daily limit before invoking the provider again.
 const liveConfig=(await(await contexts.admin.request.get(api)).json()).config;assert.equal((await post({action:'config',expectedRevision:liveConfig.revision,model:'grok-4.5',dailyCalls:1,enabled:true})).status,200);const denied=await post({action:'generate',id:firstId,expectedRevision:snapshot.project.revision,requestId:'e'.repeat(32),stage:'extra2'});assert.equal(denied.body.error,'daily_limit');assert.equal(JSON.parse(readFileSync('/tmp/noa-muvy-fixture/provider-calls.json','utf8')).length,9);
 assert.equal((await post({action:'config',expectedRevision:liveConfig.revision+1,model:'grok-4.5',dailyCalls:20,enabled:true})).status,200);
 for(const width of [360,768,1440])for(const theme of ['noa-studio','noa-ivory']){
  const c=await browser.newContext({viewport:{width,height:1000},serviceWorkers:'block',reducedMotion:'reduce'});await c.addCookies([{name:'qa_role',value:'admin',url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);const p=await c.newPage();await p.goto(base+'/noa-ai-lab.php#lab-muvy');await p.waitForFunction(()=>document.querySelectorAll('#mu-project option').length===3);await p.locator('#mu-project').selectOption(firstId);await p.locator('.mu-cut').first().waitFor();await p.locator('.mu-cut summary').first().click();assert(await p.locator('.mu-cut summary').first().evaluate(e=>e.getBoundingClientRect().width>=e.parentElement.getBoundingClientRect().width*.9),'cut summaries remain full-width title rows');assert.equal(await p.locator('.mu-cut summary.noa-action').count(),0);await p.locator('#mu-heading').scrollIntoViewIfNeeded();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await p.locator('.mu-cut').count(),32);for(const id of ['mu-new','mu-import','mu-export','mu-text-export'])assert(await p.locator('#'+id).evaluate(e=>e.getBoundingClientRect().height<=56&&e.scrollWidth<=e.clientWidth+1),'toolbar labels fit on one row');await p.screenshot({path:out+'/'+theme+'-'+width+'.png'});report.browser.push({width,theme,orderedCuts:true,storedProjectResumed:true,noOverflow:true});await c.close();
 }
 // Search and folder navigation incur no paid calls. Only picking a leaf starts production.
 assert.equal(catalogReads,0);
 assert.equal(await page.locator('script[src*="noa-ai-lab.js"]').count(),0,'MUVY does not boot the other production runtime');
 await page.locator('#mu-picker summary').click();
 await page.waitForFunction(()=>!document.querySelector('#mu-picker-fields').disabled);
 assert.equal(catalogReads,1);
 await page.locator('#mu-search').fill('Groovy');
 assert.equal(await page.locator('#mu-song option[value=original],#mu-song option[value=playlist]').count(),0);
 await page.locator('#mu-song').selectOption('missing');
 await page.waitForFunction(()=>document.querySelector('#mu-status').textContent.includes('가사가 10자 미만'));
 assert.equal(JSON.parse(readFileSync('/tmp/noa-muvy-fixture/provider-calls.json')).length,9);
 const setLimit=async dailyCalls=>{
  const cfg=(await(await contexts.admin.request.get(api)).json()).config;
  assert.equal((await post({action:'config',expectedRevision:cfg.revision,model:cfg.model,dailyCalls,enabled:true})).status,200);
 };
 await setLimit(10);
 await page.locator('#mu-song').selectOption('edition');
 await page.waitForFunction(()=>document.querySelector('#mu-status').textContent.includes('한도에 도달'));
 assert.equal(await page.locator('#mu-lyrics').inputValue(),'선택한 장르의 노랫말을 기억해');
 assert.equal(await page.locator('.mu-cut').count(),30);
 const songId=await page.locator('#mu-project').inputValue();
 await setLimit(20);
 await page.locator('#mu-song').selectOption('edition');
 await page.waitForFunction(()=>document.querySelector('#mu-status').textContent.includes('모두 저장'));
 assert.equal(await page.locator('#mu-project').inputValue(),songId);
 const songCalls=()=>JSON.parse(readFileSync('/tmp/noa-muvy-fixture/provider-calls.json')).slice(9);
 assert.deepEqual(songCalls().map(c=>c.stage),['script','c1','c1','c2','c2','c3','c3','publish']);
 assert(songCalls().every(c=>c.user.includes('groovy-airy-pop')&&c.user.includes('여성 솔로')&&!c.user.includes('원곡 가사')));
 assert(songCalls()[0].user.includes('선택한 장르의 노랫말'));
 await page.locator('#mu-song').selectOption('edition');
 await page.waitForFunction(()=>!document.querySelector('#mu-picker-fields').disabled);
 assert.equal(songCalls().length,8);
 // Launch from the actual song form; a video catalog key must resolve to its saved song edition.
 await setLimit(40);
 const editor=await contexts.admin.newPage();
 await editor.setViewportSize({width:390,height:844});
 await editor.route('**/fixture-song-editor',r=>r.fulfill({contentType:'text/html',body:'<meta charset=utf-8><main class="noa-page"></main>'}));
 await editor.route('**/noa-inline-edit.php?*',r=>r.fulfill({json:{ok:true,kind:'single',packageType:'original',
  writeKey:'original',fields:{title:'같은 제목',mvUrl:''},context:{}}}));
 await editor.goto(base+'/fixture-song-editor');
 for(const name of ['noa-browse','noa-record-form','noa-browse-edit'])await editor.addScriptTag({path:'deploy/'+name+'.js'});
 await editor.evaluate(()=>NoaBrowseEdit.mount({host:document.querySelector('main'),standalone:true})
  .openRecord({type:'song',source:'youtube',key:'abcdefghijk'}));
 const field=editor.locator('[data-record-field="mvUrl"]');
 const launch=field.getByRole('button',{name:'이 곡으로 뮤비 생성기 열기'});
 assert(await launch.evaluate(e=>e.previousElementSibling?.getAttribute('aria-label')==='뮤직비디오 주소 수정'));
 const requests=[];
 contexts.admin.on('request',r=>{if(r.url()===api&&r.method()==='POST')requests.push(r.postDataJSON());});
 const [movie]=await Promise.all([editor.waitForEvent('popup'),launch.click()]);
 await movie.waitForFunction(()=>document.querySelector('#mu-status')?.textContent.includes('모두 저장'));
 assert.equal(await movie.locator('#mu-lyrics').inputValue(),'원곡 가사 원곡 가사 원곡 가사');
 assert.deepEqual(requests.filter(r=>r.action==='selectSong').map(r=>r.key),['original']);
 assert.equal(requests.filter(r=>r.action==='generate').length,8);
 assert.equal(await movie.evaluate(()=>window.opener===null),true);
 assert.equal(await field.getByRole('button',{name:'뮤직비디오 주소 수정'}).count(),1);
 await movie.reload();
 await movie.waitForFunction(()=>document.querySelector('#mu-status')?.textContent.includes('새 뮤비'));
 assert.equal(requests.filter(r=>r.action==='selectSong').length,1);
 assert.equal(requests.filter(r=>r.action==='generate').length,8);
 report.editorShortcut=true;
 report.selectSongAutoGeneration=true;report.partialJobResumed=true;report.completedSelectionReused=true;
 assert.deepEqual(errors,[]);report.highestAdminOnly=true;report.csrfAndOriginEnforced=true;report.durableReload=true;report.originalPackImport=true;report.fullThirtyCutFlow=true;report.encryptedKeysNotReturned=true;report.dailyQuotaBeforeProvider=true;report.providerFixtureCalls=calls.length;
}finally{writeFileSync(out+'/browser-regression.json',JSON.stringify(report,null,2));await browser.close();server.kill();}
console.log('MUVY_NATIVE_WORKROOM_BROWSER_OK',report.browser.length);
