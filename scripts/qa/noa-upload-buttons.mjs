import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
const base='https://noastudio.ai.kr',file=Buffer.alloc(2048,1),name='original.wav';
const fingerprint=createHash('sha256').update(Buffer.concat([Buffer.from(JSON.stringify([name,file.length])),file,file])).digest('hex');
try{for(const width of [360,1280]){
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
 const before=queue;await page.evaluate(()=>window.dispatchEvent(new Event('online')));await page.waitForFunction(()=>!document.querySelector('.jukebox-transfer-check').disabled);assert(queue>before);
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
 console.log('UPLOAD_BUTTONS_OK',JSON.stringify({width,queue,init,finish,cancel,sameFileResume:true,cancelAfterPolling:true,live:!!process.env.NOA_BUTTONS_LIVE}));await context.close();
}}finally{await browser.close();}
