import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const base='https://noastudio.ai.kr',file=Buffer.alloc(2048,1),name='original.wav';
const fingerprint=createHash('sha256').update(Buffer.concat([Buffer.from(JSON.stringify([name,file.length])),file,file])).digest('hex');
async function checkEditorProgress(width){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
 const editorKey='track:audio-34',keys=[editorKey,'other'],isReplace=width>600;
 const rows=keys.map(key=>({key,title:key}));
 let releaseInit,releaseFinish;
 const initGate=new Promise(resolve=>releaseInit=resolve),finishGate=new Promise(resolve=>releaseFinish=resolve);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const cards=keys.map(key=>'<article class="noa-inline-song-row" data-inline-key="'+key+'"><span>'+key+'</span></article>').join('');
  const sources=keys.map(key=>'<article class="song" data-key="'+key+'" data-jukebox-key="'+key+'" data-title="'+key+'" '+(isReplace?'data-audio="/old.mp3" data-jukebox-status="ready"':'data-jukebox-status="audio_pending"')+'><div class="jukebox-actions">'+(isReplace?'':'<button type="button" class="sound-upload">Upload</button>')+'</div></article>').join('');
  await page.route('**/editor-progress-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta name="viewport" content="width=device-width"><meta name="noa-jukebox-csrf" content="fixture"><body class="noa-page"><main><div id="music-browse"><div class="noa-inline-songs" data-track-view="'+(isReplace?'list':'album')+'">'+cards+'</div></div><div id="songs" hidden>'+sources+'</div></main>'}));
  await page.route('**/noa-inline-edit.php?*',r=>{
   const key=new URL(r.request().url()).searchParams.get('key');
   return r.fulfill({json:{ok:true,kind:'single',writeKey:key,packageType:'song',revision:1,context:{},fields:{title:key}}});
  });
  await page.route('**/noa-gpt.php?*',r=>r.fulfill({json:{ok:true,workerConfigured:true}}));
  await page.route('**/noa-app/jukebox/upload.php?*',async r=>{
   const action=new URL(r.request().url()).searchParams.get('action');
   if(action==='queue')return r.fulfill({json:{rows:[],counts:{},health:{can_upload:true}}});
   if(action==='init'){assert.equal(r.request().postDataJSON().key,editorKey);await initGate;return r.fulfill({json:{id:'a'.repeat(32),chunks:[],chunkSize:65536,status:'uploading'}});}
   if(action==='chunk')return r.fulfill({json:{index:0,sha256:'b'.repeat(64)}});
   if(action==='finish')await finishGate;
   return r.fulfill({json:{key:editorKey,status:'ready',ready:true,audio:'/fixture.mp3',audio_sha256:'verified',upload:{id:'a'.repeat(32)}}});
  });
  await page.goto(base+'/editor-progress-fixture');
  for(const path of ['noa-ui.css','noa-record-form.css','noa-app/jukebox/upload.css','noa-browse.js','noa-record-form.js','noa-browse-edit.js','noa-premium.js','noa-app/jukebox/upload-transport.js','noa-app/jukebox/upload.js']){
   const content=process.env.NOA_BUTTONS_LIVE?await(await page.request.get(base+'/'+path+'?progress='+Date.now())).text():readFileSync('deploy/'+path,'utf8');
   if(path.endsWith('.css'))await page.addStyleTag({content});else await page.addScriptTag({content});
  }
  await page.evaluate(rows=>NoaBrowseEdit.mount({host:document.querySelector('#music-browse'),rows}),rows);
  const card=page.locator('.noa-inline-song-row').first(),other=page.locator('.noa-inline-song-row').last();
  await card.locator('.noa-edit-edit').click();
  const field=page.locator('[data-record-field="audioFileLocation"]'),progress=field.locator('.noa-track-progress');
  const chooser=page.waitForEvent('filechooser');
  await field.getByRole('button',{name:isReplace?'음원 교체':'음원 업로드',exact:true}).click();
  await(await chooser).setFiles({name,mimeType:'audio/wav',buffer:file});
  await field.locator('[data-phase=uploading] progress').waitFor();
  const path=await field.locator('.noa-input-guard').boundingBox(),meter=await progress.boundingBox();
  assert(meter.y>=path.y+path.height-1 && Math.abs(path.x-meter.x)<=2);
  await field.getByRole('button',{name:'음원 처리 상세 펼침'}).click();
  assert(await field.locator('#jukebox-transfer-details').isVisible());
  await page.getByRole('button',{name:'곡정보창 접기'}).click();
  assert(await progress.isHidden());
  await page.getByRole('button',{name:'곡정보창 펼치기'}).click();await progress.waitFor();
  await other.locator('.noa-edit-edit').click();
  await page.locator('[data-audio-progress-key=other]').waitFor();
  await card.locator('.noa-track-progress[data-phase=uploading]').waitFor();
  assert.equal(await field.locator('.noa-track-progress,#jukebox-transfer-dock').count(),0);
  await card.locator('.noa-edit-edit').click();
  await field.locator('#jukebox-transfer-details').waitFor();await progress.waitFor();
  assert.equal(await page.locator('.noa-track-progress').count(),1);
  releaseInit();
  await field.locator('[data-phase=checking]').waitFor();
  releaseFinish();
  await field.getByRole('button',{name:'음원 교체',exact:true}).waitFor();
  await progress.waitFor({state:'detached'});assert(await field.locator('#jukebox-transfer-dock').isHidden());
  assert.deepEqual(errors,[]);
  console.log('EDITOR_UPLOAD_PROGRESS_OK',JSON.stringify({width,isReplace}));
 }finally{releaseInit();releaseFinish();await page.close();}
}

try{for(const width of [360,1280]){
 await checkEditorProgress(width);
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));let queue=0,init=0,finish=0,cancel=0,gate;
 const saved={id:'reservation',key:'song',title:'EP.34',filename:name,bytes:file.length,fingerprint,owner:'closed-tab',state:'waiting',uploadId:'a'.repeat(32)};
 await context.addInitScript(saved=>{localStorage.setItem('noa-jukebox-reservations-v1',JSON.stringify([saved]));},saved);
 await context.route('**/buttons-fixture',r=>r.fulfill({contentType:'text/html',body:'<meta name="noa-jukebox-csrf" content="fixture"><main><article data-jukebox-key="song" data-jukebox-status="audio_pending" data-title="EP.34"><div class="jukebox-actions"></div></article></main>'}));
 await context.route('**/noa-app/jukebox/upload.php*',async r=>{
  const action=new URL(r.request().url()).searchParams.get('action');
  if(action==='queue'){queue++;return r.fulfill({json:{rows:[],counts:{},health:{can_upload:true}}});}
  if(action==='status')return r.fulfill({json:{key:'song',status:'uploading',public:{key:'song',status:'uploading'},chunks:[],upload:{id:saved.uploadId}}});
  if(action==='cancel'){cancel++;await new Promise(resolve=>gate=resolve);return r.fulfill({json:{replaced:true}});}
  if(action==='init'){init++;return r.fulfill({json:{id:saved.uploadId,chunks:[],status:'uploading',chunkSize:524288}});}
  if(action==='chunk')return r.fulfill({json:{index:0,sha256:'b'.repeat(64)}});
  if(action==='finish'){finish++;return r.fulfill({json:{key:'song',status:'ready',ready:true,audio:'/fixture.mp3',upload:{id:saved.uploadId}}});}
  return r.fulfill({json:{can_upload:true}});
 });
 const mount=async()=>{await page.goto(base+'/buttons-fixture');for(const path of ['noa-premium.js','noa-app/jukebox/upload-transport.js','noa-app/jukebox/upload.js']){
  const content=process.env.NOA_BUTTONS_LIVE?await(await context.request.get(base+'/'+path+'?buttons='+Date.now())).text():readFileSync('deploy/'+path,'utf8');await page.addScriptTag({content});
 }await page.locator('.jukebox-source-actions button').first().waitFor();
 // Force another successful poll before tapping retained controls.
 await page.waitForFunction(()=>!document.querySelector('.jukebox-transfer-check').disabled);const before=queue;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>!document.querySelector('.jukebox-transfer-check').disabled);assert(queue>before);
 };
 await mount();
 await page.locator('.jukebox-source-actions').getByRole('button',{name:'전송 예약 취소',exact:true}).click();
 for(let i=0;!gate&&i<100;i++)await new Promise(r=>setTimeout(r,20));assert(gate);
 // Poll during cancellation must preserve the held current object.
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));gate();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1'))[0].state==='replaced');
 await page.waitForFunction(()=>!document.querySelector('.jukebox-source-actions'));
 assert.equal(cancel,1);assert.equal(init,0);
 await mount();
 const chooser=page.waitForEvent('filechooser');await page.locator('.jukebox-source-actions').getByRole('button',{name:'파일 다시 선택',exact:true}).click();
 await(await chooser).setFiles({name,mimeType:'audio/wav',buffer:file});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1'))[0].state==='ready');
 assert.equal(init,1);assert.equal(finish,1);assert.equal(cancel,1);assert.deepEqual(errors,[]);
 assert.equal(await page.locator('.jukebox-download').getAttribute('href'),'/noa-music-download.php?key=song');
 // Ready audio + an unmatched old local reservation must not show re-upload UI.
 await context.route('**/buttons-fixture',r=>r.fulfill({contentType:'text/html',body:'<meta name="noa-jukebox-csrf" content="fixture"><main><article data-jukebox-key="song" data-jukebox-status="ready" data-audio="/existing.mp3" data-audio-sha="verified" data-title="EP.31"><div class="jukebox-actions"></div></article></main>'}));
 await context.route('**/noa-app/jukebox/upload.php*',r=>{
 const action=new URL(r.request().url()).searchParams.get('action');
 return r.fulfill({json:action==='queue'?{rows:[],counts:{},health:{can_upload:true}}:{key:'song',status:'ready',ready:true,audio:'/existing.mp3',audio_sha256:'verified',upload:{id:'different-server-upload'}}});
 });
 await page.goto(base+'/buttons-fixture');
 for(const path of ['noa-premium.js','noa-app/jukebox/upload-transport.js','noa-app/jukebox/upload.js'])await page.addScriptTag({content:process.env.NOA_BUTTONS_LIVE?await(await context.request.get(base+'/'+path+'?buttons='+Date.now())).text():readFileSync('deploy/'+path,'utf8')});
 await page.waitForFunction(()=>!document.querySelector('.jukebox-transfer-check').disabled);
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await page.waitForFunction(()=>!document.querySelector('.jukebox-transfer-check').disabled);
 const replace=page.getByRole('button',{name:'EP.31 음원 교체',exact:true});
 assert.equal(await replace.count(),1);
 await replace.click();
 await page.locator('.jukebox-duplicate-keep').click();
 assert.equal(init,1);
 assert.equal(await page.locator('.jukebox-source-actions').count(),0);
 assert.equal(await page.locator('.noa-track-progress').count(),0);
 assert.equal(await page.locator('#jukebox-transfer-dock').isVisible(),false);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('noa-jukebox-reservations-v1'))[0].uploadId),saved.uploadId);
 assert.deepEqual(errors,[]);
 // Reproduce a large library with hundreds of old phone reservations.
 const elapsed=await page.evaluate(async()=>{
  const main=document.querySelector('main'),template=main.querySelector('article'),rows=[];
  for(let i=0;i<600;i++){const card=template.cloneNode(true);card.dataset.jukeboxKey='large:'+i;main.append(card);rows.push({id:'large:'+i,key:'large:'+i,filename:'old.wav',owner:'closed',state:'waiting'});}
  localStorage.setItem('noa-jukebox-reservations-v1',JSON.stringify(rows));
  const start=performance.now();window.dispatchEvent(new Event('online'));
  while(document.querySelector('.jukebox-transfer-check').disabled)await new Promise(r=>setTimeout(r,20));
  await new Promise(requestAnimationFrame);return performance.now()-start;
 });
 assert(elapsed<8000,'large library blocked for '+elapsed+'ms');
 console.log('LARGE_RESERVATION_RENDER_OK',JSON.stringify({width,rows:600,elapsedMs:Math.round(elapsed)}));
 console.log('READY_RESERVATION_HIDDEN_OK',JSON.stringify({width,metadataPreserved:true,live:!!process.env.NOA_BUTTONS_LIVE}));
 console.log('UPLOAD_BUTTONS_OK',JSON.stringify({width,queue,init,finish,cancel,sameFileResume:true,cancelAfterPolling:true,live:!!process.env.NOA_BUTTONS_LIVE}));await context.close();
}}finally{await browser.close();}
