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
 const sample=await browser.newPage({viewport:{width:1280,height:900}});
 await sample.setContent('<html lang="ko"><body style="font:32px sans-serif;padding:80px;background:#eceff1"><h1>N80 연결 화면 테스트</h1><p>실제 Google 계정 화면이 아닌 격리된 테스트입니다.</p></body></html>');
 const frame='data:image/jpeg;base64,'+(await sample.screenshot({type:'jpeg'})).toString('base64');await sample.close();
 for(const width of [360,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies([{name:'qa_role',value:'admin',url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/noa-browser-connect.php');
  await page.getByText('연결 화면을 열어 Google 로그인을 진행하세요.',{exact:true}).waitFor();
  assert(await page.getByRole('heading',{name:'Gemini·Flow 연결'}).isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  assert((await page.locator('#browser-open').boundingBox()).height>=44);
  let sent,status={state:'queued',inputReady:false,waitSeconds:5};
  await page.route('**/noa-browser-connect.php?api=1',async route=>{
   if(route.request().method()==='POST'){sent=route.request().postDataJSON();return route.fulfill({json:{ok:true}});}
   await route.fulfill({json:{ok:true,id:'fixture',frameSeq:7,...status}});
  });
  await page.locator('#browser-open').click();
  await page.locator('#browser-preparing').waitFor({state:'visible'});
  assert.equal(await page.locator('#browser-preparing').getAttribute('data-stage'),'1');
  assert.equal(await page.locator('#browser-type').isVisible(),false);
  assert.equal(await page.locator('#browser-save').isEnabled(),false);
  await page.screenshot({path:`muvy-proof/browser-waiting-${width}.png`,fullPage:true});
  status={state:'active',phase:'starting',inputReady:false,waitSeconds:8};
  await page.waitForFunction(()=>document.querySelector('#browser-preparing').dataset.stage==='2');
  assert(await page.locator('#browser-preparing').isVisible());
  status={state:'active',phase:'active',inputReady:true,waitSeconds:11,frame};
  await page.locator('#browser-screen').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#browser-screen').naturalWidth===1280);
  assert.equal(await page.locator('#browser-preparing').isVisible(),false);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'frame overflows mobile layout');
  await page.locator('#browser-text').fill('DUMMY_ONLY');
  const posted=page.waitForRequest(r=>r.url().includes('?api=1')&&r.method()==='POST');
  await page.locator('#browser-type button').click();sent=(await posted).postDataJSON();
  await page.waitForFunction(()=>document.querySelector('#browser-text').value==='');
  await page.waitForFunction(()=>!document.querySelector('#browser-type button').disabled);
  assert.equal(sent.event.text,'DUMMY_ONLY');assert.equal(sent.frameSeq,7);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:`muvy-proof/browser-connect-${width}.png`,fullPage:true});
  await context.close();
 }
 console.log('N80_BROWSER_UI_OK queued starting visible-frame mobile desktop input-cleared no-overflow');
}finally{await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});}
