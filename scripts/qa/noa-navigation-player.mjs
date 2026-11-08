import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
const out='jukebox-proof';mkdirSync(out,{recursive:true});const cases=[];
import assert from 'node:assert/strict';
const root=process.env.NOA_SOURCE_ROOT||process.cwd();
const server=spawn('php',['-S','127.0.0.1:8093','tests/p0/router.php'],{cwd:root,stdio:'ignore'});
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8093/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch();
 for(const width of [360,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900},serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('BROWSER_ERROR',e.message);});
  await page.goto('http://127.0.0.1:8093/noa-music.php?track=one');
  assert.equal(await page.evaluate(()=>window.N80JukeBox===window.NoaMusic),true);
  await page.locator('#pause-play').click();
  await page.waitForFunction(()=>document.querySelector('audio').currentTime>0.2);
  await page.evaluate(()=>window.originalAudio=document.querySelector('audio'));
  for(const path of ['/noa-lounge.php','/noa-shop.php','/']){
   const before=await page.locator('audio').evaluate(a=>a.currentTime);
   await page.locator('.noa-mobile-nav a[href="'+path+'"]:visible,.noa-menu a[href="'+path+'"]:visible').first().click();
   await page.waitForFunction(path=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname===path,path);
   await page.waitForFunction(t=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused&&window.originalAudio.currentTime>t+0.2,before);
   assert.equal(new URL(page.url()).pathname,path);
   assert(await page.locator('.noa-two-line').isVisible());
  }
  // New workspaces were absent from the old static route list. Keep one audio owner.
  for(const path of ['/noa-ai-lab.php?tool=jobs','/noa-library.php','/noa-channel-workspace.php']){
   await page.evaluate(path=>{const a=document.createElement('a');a.id='n80-route-test';a.href=path;a.textContent='Workspace';document.querySelector('.noa-two-line').append(a);},path);
   await page.locator('#n80-route-test').click();await page.locator('#n80-route-test').evaluate(a=>a.remove());
   await page.waitForFunction(path=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname===new URL(path,location.origin).pathname,path);
   assert(await page.evaluate(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused));
  }
  await page.evaluate(()=>window.NoaPlayerShell.open('/'));
  await page.waitForFunction(()=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname==='/');
  // Follow a content link inside the retained view, then browser back.
  await page.frameLocator('#noa-shell-view').locator('a[href^="/bbs/board.php"]').click();
  await page.waitForFunction(()=>location.pathname==='/bbs/board.php');
  await page.evaluate(()=>history.back());
  await page.waitForFunction(()=>location.pathname==='/');
  assert(await page.evaluate(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused));
  // MY entry and an explicit _self link must retain the same engine.
  await page.evaluate(()=>{const a=document.createElement('a');a.id='test-my';a.href='/noa-my.php';a.target='_self';a.textContent='MY';document.querySelector('.noa-two-line').append(a);});
  await page.locator('#test-my').click();
  await page.waitForFunction(()=>document.querySelector('#noa-shell-view')?.contentDocument?.location.pathname==='/noa-my.php');
  await page.frameLocator('#noa-shell-view').locator('a[href="/noa-music.php"]').click();
  await page.waitForFunction(()=>!document.querySelector('#noa-shell-view'));
  assert(await page.evaluate(()=>window.originalAudio===document.querySelector('audio')&&!window.originalAudio.paused));
  await page.locator('#pause-play').click();
  assert(await page.locator('audio').evaluate(a=>a.paused));
  await page.locator('#pause-play').click();
  await page.waitForFunction(()=>!document.querySelector('audio').paused);
  assert.deepEqual(errors,[]);
  await page.addScriptTag({content:readFileSync(root+'/deploy/noa-app/jukebox/player.js','utf8')});
  await page.addScriptTag({content:readFileSync(root+'/deploy/noa-app/jukebox/presentation.js','utf8')});
  await page.evaluate(()=>{window.N80JukeBox.play('one');document.querySelector('audio').dispatchEvent(new Event('ended'));});
  assert.equal(await page.evaluate(()=>window.N80JukeBox.snapshot().key),'two','duplicate script must not advance twice');
  await page.screenshot({path:out+'/player-'+width+'.png'});
  await page.locator('#dock-close').click();
  assert(await page.locator('audio').evaluate(a=>a.paused));
  assert.equal(await page.evaluate(()=>window.N80JukeBox.snapshot().desiredPlaying),false);
  assert.equal(await page.locator('audio').count(),1);
  cases.push({width,ok:true,singleAudio:true,workspacesPreservePlayback:true,duplicateLoadSafe:true});
  console.log('N80_JUKEBOX_NAVIGATION_VERIFIED',width);
  await page.close();
 }
 // Installed Android bridge continues to use the same module through compatibility accessors.
 const native=await browser.newContext();
 await native.addInitScript({content:'window.nativeCalls=[];window.NoaAndroid={postMessage:value=>nativeCalls.push(JSON.parse(value))};'+readFileSync(root+'/android/app/src/main/assets/noa-native-bridge.js','utf8')});
 const page=await native.newPage(),nativeErrors=[];page.on('pageerror',e=>nativeErrors.push(e.message));
 await page.goto('http://127.0.0.1:8093/noa-music.php?track=one');
 await page.waitForFunction(()=>window.NoaNativeBridge?.ready()&&window.N80JukeBox);
 await page.evaluate(()=>N80JukeBox.play('one'));
 assert(await page.evaluate(()=>nativeCalls.some(c=>c.type==='play'&&c.key==='one')));
 await page.evaluate(()=>NoaNativeBridge.state({key:'two',queue:['one','two'],position:12,duration:90,playing:true,paused:false,closed:false,volume:.5,repeat:false,shuffle:false}));
 // A pending native play command must first acknowledge its selected key.
 await page.evaluate(()=>{NoaNativeBridge.state({key:'one',queue:['one','two'],position:12,duration:90,playing:true,paused:false,closed:false,volume:.5,repeat:false,shuffle:false});NoaNativeBridge.state({key:'two',queue:['one','two'],position:13,duration:90,playing:true,paused:false,closed:false,volume:.5,repeat:false,shuffle:false});});
 assert.deepEqual(await page.evaluate(()=>({key:N80JukeBox.snapshot().key,seconds:N80JukeBox.snapshot().seconds,backend:N80JukeBox.snapshot().backend})),{key:'two',seconds:13,backend:'android'});
 assert.deepEqual(nativeErrors,[]);cases.push({ok:true,nativeCompatibility:true});await native.close();
 writeFileSync(out+'/verification.json',JSON.stringify({ok:true,cases},null,2));
}finally{await browser?.close();server.kill();}
