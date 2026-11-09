import {chromium} from 'playwright';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
const root=mkdtempSync(tmpdir()+'/n80-drive-ui-'),out='muvy-proof',base='http://127.0.0.1:8079';
mkdirSync(out,{recursive:true});execFileSync('python',['tests/session-agent/drive_fixture.py',root]);
const server=spawn('php',['-S','127.0.0.1:8079','-t',root+'/html'],{stdio:'ignore'});
let browser;const report=[];
try{
 browser=await chromium.launch({...(process.env.NOA_QA_CHROME?{executablePath:process.env.NOA_QA_CHROME}:{channel:'chrome'}),headless:true,args:['--no-sandbox']});
 for(const width of [360,768,1440])for(const theme of ['noa-studio','noa-ivory']){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.addCookies([{name:'qa_role',value:'admin',url:base}]);
  await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/noa-bridge/lab-oauth.php?action=drive');
  await page.screenshot({path:`${out}/drive-${theme}-${width}.png`,fullPage:true});
  assert(await page.getByRole('heading',{name:'Drive 임시저장 연결'}).isVisible());
  const button=page.getByRole('button',{name:'Google Drive 연결',exact:true});assert(await button.isVisible());
  assert((await button.boundingBox()).height>=44);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  assert.equal(await page.locator('input:not([type=hidden])').count(),0,'no manual credential input');
  await button.focus();assert(await button.evaluate(el=>el===document.activeElement));
  assert.equal(errors.length,0,errors.join('\n'));
  report.push({width,theme,visibleConnection:true,noCredentialInput:true,noOverflow:true,keyboardAccess:true});await context.close();
 }
 writeFileSync(out+'/drive-connect.json',JSON.stringify({provider:'not contacted',checks:report},null,2));
 console.log('Drive connection UI: six layouts, keyboard access, readable consent and no manual credentials passed.');
}finally{await browser?.close();server.kill('SIGTERM');rmSync(root,{recursive:true,force:true});}
