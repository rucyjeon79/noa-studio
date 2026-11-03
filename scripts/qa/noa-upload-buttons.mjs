import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const base='https://noastudio.ai.kr',file=Buffer.alloc(2048,1),name='original.wav';
const fingerprint=createHash('sha256').update(Buffer.concat([Buffer.from(JSON.stringify([name,file.length])),file,file])).digest('hex');
async function checkEditorProgress(width){
 const page=await browser.newPage({viewport:{width,height:844},serviceWorkers:'block'});
 const editorKey='track:audio-34',keys=['first',editorKey,'other','fourth','fifth','sixth'],isReplace=width>600;
 const rows=keys.map((key,index)=>({key,title:index===1?'A Small Tremor':'First Glance '+index,genre:'pop-original',ep:String(31+index),thumb:'/test-cover.svg'}));
 let releaseInit,releaseFinish;const serverJobs=[];
 const initGate=new Promise(resolve=>releaseInit=resolve),finishGate=new Promise(resolve=>releaseFinish=resolve);
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const sources=keys.map(key=>'<article class="song" data-key="'+key+'" data-jukebox-key="'+key+'" data-title="'+key+'" '+(isReplace?'data-audio="/old.mp3" data-jukebox-status="ready"':'data-jukebox-status="audio_pending"')+'><div class="jukebox-actions">'+(isReplace?'':'<button type="button" class="sound-upload">Upload</button>')+'</div></article>').join('');
  await page.route('**/editor-progress-fixture?*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html data-noa-style="starlight" data-noa-precision="1"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="noa-jukebox-csrf" content="fixture"><body class="noa-page noa-record-room"><main><div id="music-browse"></div><div id="songs" hidden>'+sources+'</div><audio id="sound-player"></audio><img id="dock-cover" hidden><span id="dock-cover-empty" hidden></span></main>'}));
  await page.route('**/test-cover.svg',r=>r.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320"><rect width="320" height="320" fill="#172e36"/><circle cx="160" cy="160" r="80" fill="#99845a"/><circle cx="160" cy="160" r="8" fill="#172e36"/></svg>'}));
  await page.route('**/noa-inline-edit.php?*',r=>{
   const key=new URL(r.request().url()).searchParams.get('key');
   return r.fulfill({json:{ok:true,kind:'single',writeKey:key,packageType:'song',revision:1,context:{},fields:{title:key}}});
  });
  await page.route('**/noa-gpt.php?*',r=>r.fulfill({json:{ok:true,workerConfigured:true}}));
  await page.route('**/noa-app/jukebox/upload.php?*',async r=>{
   const action=new URL(r.request().url()).searchParams.get('action');
   if(action==='queue')return r.fulfill({json:{rows:serverJobs,counts:{},health:{can_upload:true}}});
   if(action==='init'){assert.equal(r.request().postDataJSON().key,editorKey);await initGate;return r.fulfill({json:{id:'a'.repeat(32),chunks:[],chunkSize:65536,status:'uploading'}});}
   if(action==='chunk')return r.fulfill({json:{index:0,sha256:'b'.repeat(64)}});
   if(action==='finish'){
    await finishGate;serverJobs.push({id:1,song_key:editorKey,upload_id:'a'.repeat(32),title:'A Small Tremor',status:'queued'});
   }
   const key=new URL(r.request().url()).searchParams.get('key')||editorKey;
   const job=serverJobs.find(j=>j.song_key===key),status=job?.status||'ready';
   return r.fulfill({json:{key,status,ready:status==='ready',audio:status==='ready'?'/fixture.mp3':'',audio_sha256:status==='ready'?'verified':'',job,upload:{id:job?.upload_id||'a'.repeat(32)}}});
  });
  await page.goto(base+'/editor-progress-fixture?group=original&genre=pop-original&act=4');
  for(const path of ['noa-ui.css','noa-starlight.css','noa-engagement.css','noa-music-vinyl.css','noa-record-form.css','noa-app/jukebox/upload.css','noa-browse.js','noa-music-vinyl.js','noa-record-form.js','noa-browse-edit.js','noa-premium.js','noa-app/jukebox/upload-transport.js','noa-app/jukebox/upload.js']){
   const content=process.env.NOA_BUTTONS_LIVE?await(await page.request.get(base+'/'+path+'?progress='+Date.now())).text():readFileSync('deploy/'+path,'utf8');
   if(path.endsWith('.css'))await page.addStyleTag({content});else await page.addScriptTag({content});
  }
  await page.evaluate(rows=>{
   const host=document.querySelector('#music-browse');
   const tree=NoaBrowse.mount({host,rows,onChange:()=>tree.apply([])});tree.apply([]);
   NoaBrowseEdit.mount({host,rows});
  },rows);
  const list=page.locator('.noa-inline-songs').first();
  await list.locator('.lp-track-art').first().waitFor();
  await page.locator('.lp-view-switch [data-mode=album]').first().click();
  const baseline=await list.locator(':scope>.noa-inline-song-row').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
  const card=page.locator('.noa-inline-song-row').nth(1),other=page.locator('.noa-inline-song-row').nth(2);
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
  const detached=list.locator(':scope>.noa-track-processing[data-song-panel-key="'+editorKey+'"]');
  await detached.locator('.noa-track-progress[data-phase=uploading]').waitFor();
  assert.equal(await card.locator('.noa-track-progress,#jukebox-transfer-dock').count(),0);
  const heights=await list.locator(':scope>.noa-inline-song-row').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height));
  assert(heights.every((h,i)=>Math.abs(h-baseline[i])<2),'Processing must not stretch either album card');
  assert.equal(await field.locator('.noa-track-progress,#jukebox-transfer-dock').count(),0);
  await page.getByRole('button',{name:'정보 수정 취소',exact:true}).click();
  await detached.locator('.noa-track-progress').waitFor();
  const checkRows=async()=>{
   const layout=await list.evaluate(list=>{
    const cards=[...list.querySelectorAll(':scope>.noa-inline-song-row')].map(c=>c.getBoundingClientRect().toJSON());
    const panels=[...list.querySelectorAll(':scope>[data-song-panel-key]')].map(p=>({key:p.dataset.songPanelKey,rect:p.getBoundingClientRect().toJSON()}));
    return {cards,panels,width:list.getBoundingClientRect().width};
   });
   for(const item of layout.panels){
    const index=keys.indexOf(item.key),anchor=layout.cards[index];
    const peers=layout.cards.filter(c=>Math.abs(c.y-anchor.y)<2);
    assert(Math.abs(item.rect.width-layout.width)<2);
    assert(item.rect.y>=Math.max(...peers.map(c=>c.bottom)));
    assert(layout.cards.every(c=>c.bottom<=item.rect.top||c.top>=item.rect.bottom),'panel overlaps a card');
   }
   assert.equal(await list.locator('.noa-inline-song-row .noa-track-progress').count(),0);
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  };
  await checkRows();
  for(const mode of ['list','album']){
   await page.locator('.lp-view-switch [data-mode='+mode+']').first().click();
   await page.waitForTimeout(100);await checkRows();
  }
  await page.setViewportSize({width:width<600?1280:360,height:844});
  await page.waitForTimeout(100);await checkRows();
  await page.setViewportSize({width,height:844});
  await page.waitForTimeout(100);await checkRows();
  mkdirSync('upload-buttons-proof',{recursive:true});
  await list.screenshot({path:'upload-buttons-proof/processing-below-row-'+width+'.png'});
  await card.locator('.noa-edit-edit').click();
  await field.locator('#jukebox-transfer-details').waitFor();await progress.waitFor();
  assert.equal(await page.locator('.noa-track-progress').count(),1);
  releaseInit();
  await field.locator('[data-phase=checking]').waitFor();
  releaseFinish();
  await field.locator('[data-phase=queued]').waitFor();
  await page.getByRole('button',{name:'정보 수정 취소',exact:true}).click();
  await detached.locator('[data-phase=queued]').waitFor();
  serverJobs.push({id:2,song_key:'fifth',upload_id:'c'.repeat(32),title:'Another queued song',status:'queued'});
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await list.locator('.noa-track-processing[data-song-panel-key=fifth] [data-phase=queued]').waitFor();
  for(const mode of ['album','list']){
   await page.locator('.lp-view-switch [data-mode='+mode+']').first().click();
   await page.waitForTimeout(100);await checkRows();
   await list.screenshot({path:'upload-buttons-proof/queued-'+mode+'-'+width+'.png'});
  }
  await other.locator('.noa-edit-edit').click();
  await page.locator('[data-audio-progress-key=other]').waitFor();await checkRows();
  await page.getByRole('button',{name:'정보 수정 취소',exact:true}).click();
  for(const job of serverJobs)job.status='ready';
  await page.evaluate(()=>window.dispatchEvent(new Event('online')));
  await list.locator('.noa-track-processing').waitFor({state:'detached'});
  assert(await page.locator('#jukebox-transfer-dock').isHidden());
  assert.deepEqual(errors,[]);
  console.log('EDITOR_UPLOAD_PROGRESS_OK',JSON.stringify({width,isReplace}));
 }catch(error){mkdirSync('upload-buttons-proof',{recursive:true});await page.screenshot({path:'upload-buttons-proof/failure-'+width+'.png',fullPage:true});throw error;}finally{releaseInit();releaseFinish();await page.close();}
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
