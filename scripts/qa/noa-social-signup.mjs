import {chromium} from 'playwright';
import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('social-signup-proof/native'),out='social-signup-proof/screenshots';mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{
 const path=decodeURI(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+path);
 if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 if(path==='/noa-social-signup.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync('deploy/noa-social-signup.css'));return;}
 if(!existsSync(file)){res.writeHead(404).end();return;}
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(readFileSync(file));
});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
function contrast(a,b){const lum=c=>c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
try{
 for(const width of [320,390,1280])for(const theme of ['noa-studio','noa-ivory']){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
  await page.goto(base+'/'+(width<700?'mobile':'pc')+'.html');await page.waitForFunction(()=>window.NoaUI?.getState());
  await page.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);
  const form=page.locator('#fregisterform'),before=await form.evaluate(f=>({action:f.getAttribute('action'),method:f.method,inputs:[...f.querySelectorAll('input')].map(i=>[i.name,i.type,i.value,i.required,i.readOnly])}));
  assert.equal(before.action,'/plugin/social/register_member_update.php');assert.equal(before.method,'post');
  assert.equal(await page.evaluate(()=>typeof reg_mb_nick_check),'function');assert.equal(await page.evaluate(()=>typeof reg_mb_email_check),'function');
  assert.equal(await page.locator('[name=agree]').isChecked(),false);assert.equal(await page.locator('[name=agree2]').isChecked(),false);
  // Isolated form fixture: clicks never accept real terms or create an account.
  await page.locator('label[for=chk_all]').click();assert(await page.locator('[name=agree]').isChecked());assert(await page.locator('[name=agree2]').isChecked());
  await page.locator('label[for=chk_all]').click();assert.equal(await page.locator('[name=agree]').isChecked(),false);
  assert(await page.locator('.fregister_agree input[type=checkbox]').evaluateAll(nodes=>nodes.every(n=>n.getBoundingClientRect().width<=1)),'duplicate native checkbox visible');
  const audit=await page.evaluate(()=>{
   const vis=n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0;
   const bg=n=>{for(let e=n;e;e=e.parentElement){const c=getComputedStyle(e).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;}return getComputedStyle(document.body).backgroundColor;};
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,colors:[...document.querySelectorAll('#container_title,#fregisterform h2,#fregisterform p,#fregisterform textarea,#fregisterform th,#fregisterform td,#fregisterform .frm_input,#fregisterform .fregister_agree label')].filter(vis).map(n=>({selector:n.id||n.tagName,color:getComputedStyle(n).color,bg:bg(n)})),targets:[...document.querySelectorAll('.fregister_agree label,.btn_confirm a,.btn_confirm button')].filter(vis).map(n=>n.getBoundingClientRect().height)};
  });assert(!audit.overflow,JSON.stringify({width,theme,audit}));
  for(const n of audit.colors)assert(contrast(n.color,n.bg)>=4.5,'contrast '+JSON.stringify({width,theme,...n}));assert(audit.targets.every(h=>h>=44));
  assert.deepEqual(await form.evaluate(f=>({action:f.getAttribute('action'),method:f.method,inputs:[...f.querySelectorAll('input')].map(i=>[i.name,i.type,i.value,i.required,i.readOnly])})),before);assert.deepEqual(errors,[]);
  if(width!==320){await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+theme+'-'+width+'.png',fullPage:true});}
  report.push({width,theme,...audit,nativeFormPreserved:true,nativeValidatorsAvailable:true,consentToggleWorks:true});await page.close();
 }
 writeFileSync('social-signup-proof/qa.json',JSON.stringify({ok:true,cases:report,fixtureOnly:true,externalAccountSignupTested:false},null,2));console.log('SOCIAL_SIGNUP_NATIVE_QA_OK',report.length);
}finally{await browser.close();server.close();}
