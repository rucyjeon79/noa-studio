import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import assert from 'node:assert/strict';

// The native form, PHP session and private config are real; every value and
// account below belongs only to the disposable HTTP fixture. No gateway calls.
const base='http://127.0.0.1:18090',site='/tmp/noa-toss-http/site';
const config='/tmp/noa-toss-http/noa-private/toss.php',out='payments-proof';
mkdirSync(out,{recursive:true});const report=[];
const source=readFileSync(site+'/noa-payment-settings.php','utf8');
writeFileSync(site+'/settings-before.php',source.replace('Referrer-Policy: same-origin','Referrer-Policy: no-referrer'));
const server=spawn('php',['-S','127.0.0.1:18090','-t',site],{stdio:'ignore'});
let browser;
try{
 for(let attempt=0;;attempt++){
  try{await fetch(base+'/noa-payment-settings.php');break;}catch(e){if(attempt===39)throw e;await new Promise(r=>setTimeout(r,100));}
 }
 for(const engine of ['chromium','webkit']){
  browser=await(engine==='webkit'?webkit.launch():chromium.launch({channel:'chrome',args:['--no-sandbox']}));
  for(const javaScriptEnabled of [false,true]){
   const context=await browser.newContext({viewport:{width:390,height:844},javaScriptEnabled,serviceWorkers:'block'});
   await context.addCookies([{name:'qa_toss_user',value:'tp_admin',url:base}]);
   const page=await context.newPage();
   const submit=async()=>{
    try{
     const [response]=await Promise.all([
      page.waitForResponse(r=>r.request().isNavigationRequest()&&r.request().method()==='POST'),
      page.getByRole('button',{name:'연동 설정 저장',exact:true}).click()
     ]);await response.finished();return response;
    }catch(error){
     await page.screenshot({path:`${out}/settings-failure-${engine}-${javaScriptEnabled}.png`,fullPage:true});
     console.error('SETTINGS_SUBMIT_DIAGNOSTIC',engine,javaScriptEnabled,await page.locator('form').evaluateAll(forms=>forms.map(f=>({valid:f.checkValidity(),method:f.method,action:f.action,invalid:[...f.elements].filter(e=>e.validity&&!e.validity.valid).map(e=>({name:e.name,type:e.type,message:e.validationMessage}))}))));
     throw error;
    }
   };
   const before=readFileSync(config,'utf8');
   await page.goto(base+'/settings-before.php');
   const rejected=await submit();assert.equal(rejected.status(),403);
   assert.equal(rejected.request().headers().origin,'null');
   assert.equal(readFileSync(config,'utf8'),before,'rejected POST must not save');

   const response=await page.goto(base+'/noa-payment-settings.php');
   assert.equal(response.headers()['referrer-policy'],'same-origin');
   await page.locator('select[name=mode]').selectOption('test');
   await page.locator('input[name=mid]').fill('fixture_settings');
   await page.locator('input[name=clientKey]').fill('test_ck_settings_fixture');
   await page.locator('input[name=secretKey]').fill('test_sk_settings_fixture');
   await page.locator('input[name=webhookSecret]').fill('a'.repeat(64));
   await page.locator('input[name=enabled]').uncheck();
   await page.locator('input[name=contractApproved]').uncheck();
   const saved=await submit();assert.equal(saved.status(),200);
   assert.equal(saved.request().headers().origin,base);
   await page.locator('main>p[role=status]').filter({hasText:'설정을 저장했습니다'}).waitFor();
   const stored=readFileSync(config,'utf8');
   assert(stored.includes('test_sk_settings_fixture')&&stored.includes('a'.repeat(64)));
   assert.equal(statSync(config).mode&0o777,0o600);
   const html=await page.content();
   assert(!html.includes('test_sk_settings_fixture')&&!html.includes('a'.repeat(64)),'secrets must not be rendered');
   await page.reload();assert.equal(await page.locator('input[name=mid]').inputValue(),'fixture_settings');
   assert.equal(await page.locator('input[name=secretKey]').getAttribute('placeholder'),'등록됨 · 변경할 때만 입력');
   assert(!(await page.locator('input[name=enabled]').isChecked()));

   const csrf=await page.locator('input[name=csrf]').inputValue();
   for(const [origin,token]of [['null',csrf],['https://evil.invalid',csrf],[base,'invalid-csrf']]){
    const denied=await context.request.post(base+'/noa-payment-settings.php',{headers:{Origin:origin},form:{csrf:token,mode:'test',mid:'must_not_save'}});
    assert.equal(denied.status(),403);assert.equal(readFileSync(config,'utf8'),stored);
   }
   await page.screenshot({path:`${out}/settings-${engine}-${javaScriptEnabled?'js':'native'}.png`,fullPage:true});
   report.push({engine,javaScriptEnabled,legacyNullOriginRejected:true,nativePostSaved:true,secretsHidden:true,csrfEnforced:true,mode:'test',enabled:false});
   await context.close();
  }
  await browser.close();browser=null;
 }
}finally{
 if(browser)await browser.close();server.kill();
 writeFileSync(out+'/settings-report.json',JSON.stringify(report,null,2));
}
console.log('TOSS_SETTINGS_NATIVE_FORM_ORIGIN_REGRESSION_OK',report.length);
