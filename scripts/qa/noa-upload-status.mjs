import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const phase=process.env.NOA_UPLOAD_PHASE||'candidate',base='https://noastudio.ai.kr',out='upload-status-proof/'+phase;
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});
const key='single:fixture:05',uploadId='a'.repeat(32),otherKey='single:fixture:unrelated',report=[];
const job=(status)=>({id:83,upload_id:uploadId,song_key:key,status,title:'너와의 모든 순간',position:status==='queued'?1:null});
const saved={id:'saved-upload',key,title:'너와의 모든 순간',filename:'authorized.wav',ep:'05',uploadId,owner:'closed-tab',fingerprint:'original',state:'uploaded',serverComplete:true};
const card=k=>'<article data-jukebox-key="'+k+'" data-jukebox-status="queued" data-title="너와의 모든 순간" data-ep="05" data-genre="kpop-original"><div class="jukebox-actions"></div><p class="jukebox-state"></p></article>';
const html='<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="noa-jukebox-csrf" content="fixture"><style>[hidden]{display:none!important}body{margin:12px;font:16px sans-serif;background:#14161b;color:#eee}button{padding:12px}pre{white-space:pre-wrap;word-break:break-all}#jukebox-transfer-dock{padding:12px;border:1px solid #59616c}progress{width:100%}</style><main>'+card(otherKey)+card(key)+'</main></html>';
try{
 for(const width of [360,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  let queueMode='queued',statusMode='queued',posts=0,queueCalls=0,otherCalls=0,releaseOther;
  const otherGate=new Promise(r=>releaseOther=r);
  const jsonStatus=()=>({key,status:statusMode,ready:statusMode==='ready',audio:statusMode==='ready'?'/fixture.mp3':'',audio_sha256:'b'.repeat(64),audio_bytes:2048,download:'/fixture.mp3',upload:{id:uploadId},job:queueMode==='empty'?null:job(statusMode)});
  await context.addInitScript(value=>{if(!localStorage.getItem('noa-jukebox-reservations-v1'))localStorage.setItem('noa-jukebox-reservations-v1',JSON.stringify([value]));},saved);
  await context.route('**/noa-upload-status-fixture',r=>r.fulfill({contentType:'text/html',body:html}));
  await context.route('**/noa-app/jukebox/upload.php*',async r=>{
   const req=r.request(),url=new URL(req.url());if(req.method()!=='GET'){posts++;return r.fulfill({status:500,json:{error:'unexpected_mutation'}});}
   if(url.searchParams.get('action')==='queue'){
    queueCalls++;if(queueMode==='offline')return r.abort('internetdisconnected');
    return r.fulfill({json:{rows:queueMode==='empty'?[]:[{id:1,upload_id:'c'.repeat(32),song_key:otherKey,status:'ready',title:'다른 곡'},job(queueMode)],counts:{},current_counts:{},health:{can_upload:true},total_uploads:2}});
   }
   if(url.searchParams.get('key')===otherKey){otherCalls++;await otherGate;try{return await r.abort('failed');}catch{return;}}
   if(statusMode==='offline')return r.abort('internetdisconnected');
   return r.fulfill({json:jsonStatus()});
  });
  const code={};for(const name of ['upload-transport.js','upload.js'])code[name]=phase==='candidate'?readFileSync('deploy/noa-app/jukebox/'+name,'utf8'):await(await context.request.get(base+'/noa-app/jukebox/'+name+'?qa='+Date.now())).text();
  const mount=async()=>{await page.goto(base+'/noa-upload-status-fixture');for(const name of Object.keys(code))await page.addScriptTag({content:code[name]});};
  const check=page.locator('.jukebox-transfer-check'),dock=page.locator('#jukebox-transfer-dock');
  await mount();await page.locator('.jukebox-transfer-expand').click();
  await page.waitForFunction(()=>document.querySelector('.jukebox-reservations').textContent.includes('대기 1번'));
  assert.equal(await page.locator('.jukebox-transfer-pause').isVisible(),false);assert.equal(await page.locator('.jukebox-transfer-resume').isVisible(),false);
  // The unrelated status request remains in flight while queue snapshots work.
  queueMode='ready';statusMode='ready';await check.click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1'))[0].state==='ready',{},{timeout:3000});
  await page.waitForFunction(()=>document.querySelector('[data-jukebox-key="single:fixture:05"]').dataset.jukeboxStatus==='ready');
  assert.equal(await dock.isVisible(),false);assert(otherCalls>0);assert(queueCalls>=2);
  releaseOther();
  // Reproduce the reported stale queue across failed queue/status requests.
  await page.evaluate(value=>localStorage.setItem('noa-jukebox-reservations-v1',JSON.stringify([value])),saved);queueMode='queued';statusMode='queued';
  await mount();await page.locator('.jukebox-transfer-expand').click();await page.waitForFunction(()=>document.querySelector('.jukebox-reservations').textContent.includes('대기 1번'));
  queueMode='offline';statusMode='offline';await check.click();
  await page.waitForFunction(()=>document.querySelector('.jukebox-transfer-connection').textContent.includes('확인하지 못했습니다'));
  assert(!await page.locator('.jukebox-reservations').textContent().then(x=>x.includes('대기 1번')));
  assert.equal(await dock.locator('progress').isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1'))[0].state),'uploaded');
  await page.screenshot({path:out+'/disconnected-'+width+'.jpg'});
  // A per-song status read can recover even if the queue endpoint is unavailable.
  statusMode='ready';await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1'))[0].state==='ready');
  assert.equal(await dock.isVisible(),false);await mount();assert.equal(await dock.isVisible(),false);
  // Identical-source reuse completes without a new queue job.
  await page.evaluate(value=>localStorage.setItem('noa-jukebox-reservations-v1',JSON.stringify([value])),saved);queueMode='empty';statusMode='ready';await mount();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1'))[0].state==='ready');assert.equal(await dock.isVisible(),false);
  assert.equal(posts,0);assert.deepEqual(errors,[]);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  report.push({width,phase,unrelatedFailureIsolated:true,stalePositionRemoved:true,recoveredWithoutQueue:true,completionSurvivesReload:true,noJobReuseRecovered:true,posts,fixtureData:true});
  // Reopened phone: stale capacity error + persisted open circuit, no File object.
  await page.evaluate(value=>{localStorage.setItem('noa-jukebox-reservations-v1',JSON.stringify([{...value,uploadId:null,serverComplete:false,state:'waiting',error:'temporary_storage_quota_reached'}]));localStorage.setItem('noa-jukebox-circuit-v1',JSON.stringify({open:true}));},saved);
  let initCalls=0,chunkCalls=0,finishCalls=0;
  await context.route('**/noa-app/jukebox/upload.php*',async r=>{
   const action=new URL(r.request().url()).searchParams.get('action');
   if(action==='health')return r.fulfill({json:{can_upload:true,can_resume:true}});
   if(action==='queue')return r.fulfill({json:{rows:[],counts:{},health:{can_upload:true}}});
   if(action==='init'){initCalls++;return r.fulfill({json:{id:uploadId,chunks:[],status:'uploading',chunkSize:524288}});}
   if(action==='chunk'){chunkCalls++;return r.fulfill({json:{index:0,sha256:'b'.repeat(64)}});}
   if(action==='finish'){finishCalls++;return r.fulfill({json:{key,status:'ready',ready:true,audio:'/fixture.mp3',audio_sha256:'b'.repeat(64),audio_bytes:2048,download:'/fixture.mp3',upload:{id:uploadId}}});}
   return r.fulfill({json:{recorded:true}});
  });
  await page.goto(base+'/noa-upload-status-fixture');
  await page.addScriptTag({content:readFileSync('deploy/noa-premium.js','utf8')});
  for(const name of Object.keys(code))await page.addScriptTag({content:code[name]});
  const sourceActions=page.locator('.jukebox-source-actions');
  await sourceActions.getByRole('button',{name:'파일 다시 선택',exact:true}).waitFor();
  assert(!(await page.locator('.noa-track-progress').allTextContents()).join('').includes('임시 저장 공간이 가득'));
  await page.screenshot({path:out+'/reselect-'+width+'.jpg'});
  const chooser=page.waitForEvent('filechooser');await sourceActions.getByRole('button',{name:'파일 다시 선택',exact:true}).click();
  await(await chooser).setFiles({name:'authorized.wav',mimeType:'audio/wav',buffer:Buffer.alloc(2048,1)});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1')).some(r=>r.state==='ready'));
  assert.equal(initCalls,1);assert.equal(chunkCalls,1);assert.equal(finishCalls,1);
  assert.deepEqual(errors,[]);
  report.push({width,reselectionAfterCapacityError:true,initCalls,chunkCalls,finishCalls,fixtureData:true});
  // Reproduce the real song grid: cancellation must not occupy the 56px cover column.
  const mediaCss=phase==='candidate'?readFileSync('deploy/noa-app/p0-media.css','utf8'):await(await context.request.get(base+'/noa-app/p0-media.css?qa='+Date.now())).text();
  await page.setContent('<!doctype html><html data-noa-precision><meta name="viewport" content="width=device-width,initial-scale=1"><body class="noa-page"><main id="layout-fixture" style="max-width:700px;margin:12px"></main></body></html>');
  for(const path of ['noa-ui.css','noa-policy-20261024.css','noa-engagement.css','noa-app/jukebox/upload.css'])await page.addStyleTag({content:readFileSync('deploy/'+path,'utf8')});
  await page.addStyleTag({content:mediaCss});
  await page.evaluate(()=>{
   document.body.classList.add('noa-page');
   const row=document.createElement('article');row.id='cancel-layout-check';row.className='noa-inline-song-row';
   row.style.cssText='display:grid;grid-template-columns:56px minmax(88px,1fr) repeat(3,44px);gap:0 8px';
   row.innerHTML='<div style="grid-column:1/-1">최적화 대기</div><button class="jukebox-cancel-job">최적화 취소</button>';
   document.querySelector('#layout-fixture').append(row);
  });
  const geometry=await page.locator('#cancel-layout-check .jukebox-cancel-job').evaluate(el=>({width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,column:getComputedStyle(el).gridColumn,wrap:getComputedStyle(el).whiteSpace}));
  assert.equal(geometry.column,'1 / -1');assert.equal(geometry.wrap,'nowrap');assert(geometry.height>=44&&geometry.height<70);assert(geometry.width>80);
  await page.screenshot({path:out+'/cancel-layout-'+width+'.jpg'});
  report.push({width,cancelLayout:geometry});
  await context.close();
 }
 writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log('UPLOAD_STATUS_BROWSER_OK',JSON.stringify(report));
}finally{await browser.close();}
