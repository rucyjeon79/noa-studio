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
  assert(await page.locator('#noa-drive-main').evaluate(el=>el.getBoundingClientRect().width<=760),'bounded readable width');
  const contrast=await button.evaluate(el=>{const c=getComputedStyle(el),l=s=>{const v=s.match(/[\d.]+/g).slice(0,3).map(x=>{x=Number(x)/255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722},a=l(c.color),b=l(c.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)});
  assert(contrast>=4.5,'readable connection button');
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow');
  assert.equal(await page.locator('input:not([type=hidden])').count(),0,'no manual credential input');
  await button.focus();assert(await button.evaluate(el=>el===document.activeElement));
  assert.equal(errors.length,0,errors.join('\n'));
  let requestOrigin=null;page.on('request',request=>{if(request.method()==='POST')requestOrigin=request.headers()['origin']});
  await page.route('https://accounts.google.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Isolated Google consent destination</h1>'}));
  // Model the production origin in the disposable server while letting Chromium
  // produce the actual Origin header; do not synthesize that request header.
  await button.click();await page.waitForURL('https://accounts.google.com/**');
  assert.equal(requestOrigin,base);const target=new URL(page.url());assert.equal(target.searchParams.get('scope'),'https://www.googleapis.com/auth/drive');
  report.push({width,theme,visibleConnection:true,noCredentialInput:true,noOverflow:true,keyboardAccess:true,nativePostOrigin:true,consentRedirect:true});await context.close();
 }
 writeFileSync(out+'/drive-connect.json',JSON.stringify({provider:'not contacted',checks:report},null,2));
 console.log('Drive connection UI: six layouts, keyboard access, readable consent and no manual credentials passed.');
}finally{await browser?.close();server.kill('SIGTERM');rmSync(root,{recursive:true,force:true});}
