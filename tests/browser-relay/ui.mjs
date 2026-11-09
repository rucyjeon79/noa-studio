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
 for(const width of [360,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}});await context.addCookies([{name:'qa_role',value:'admin',url:base}]);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/noa-browser-connect.php');
  await page.getByText('연결 화면을 열어 Google 로그인을 진행하세요.',{exact:true}).waitFor();
  assert(await page.getByRole('heading',{name:'Gemini·Flow 연결'}).isVisible());
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  assert((await page.locator('#browser-open').boundingBox()).height>=44);
  let sent;
  await page.route('**/noa-browser-connect.php?api=1',async route=>{
   if(route.request().method()==='POST'){sent=route.request().postDataJSON();return route.fulfill({json:{ok:true}});}
   await route.fulfill({json:{ok:true,state:'active',id:'fixture',frameSeq:7,inputReady:true}});
  });
  await page.locator('#browser-text').fill('DUMMY_ONLY');
  await page.waitForFunction(()=>!document.querySelector('#browser-type button').disabled);
  await page.locator('#browser-type button').click();
  await page.waitForFunction(()=>document.querySelector('#browser-text').value==='');
  assert.equal(sent.event.text,'DUMMY_ONLY');assert.equal(sent.frameSeq,7);
  assert.equal(errors.length,0,errors.join('\n'));
  await page.screenshot({path:`muvy-proof/browser-connect-${width}.png`,fullPage:true});
  await context.close();
 }
 console.log('N80_BROWSER_UI_OK mobile desktop input-cleared no-overflow');
}finally{await browser?.close();server.kill();rmSync(root,{recursive:true,force:true});}
