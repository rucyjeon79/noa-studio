import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='room-theme-proof/member';mkdirSync(out,{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8077','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:['ignore','ignore','pipe']});
let serverErrors='';server.stderr.on('data',b=>serverErrors+=b);
const base='http://127.0.0.1:8077';
for(let i=0;i<40;i++){try{if((await fetch(base+'/noa-design.json')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const results=[];
try{
 for(const width of [390,1280,1600])for(const theme of ['noa-ivory','noa-studio'])for(const role of ['member','vip']){
  const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await c.addCookies([{name:'qa_role',value:role,url:base}]);
  await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection-v2',JSON.stringify({theme})),theme);
  await c.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/noa-my.php');
  await p.waitForFunction(theme=>document.documentElement.dataset.noaTheme===theme,theme);
  assert(await p.locator('.noa-room-heading h1').isVisible());
  assert(await p.locator('#noa-my-account').isVisible());
  assert((await p.locator('.noa-level-line').innerText()).includes(role==='vip'?'LEVEL 4':'LEVEL 3'),'the isolated entitlement reader renders the correct member level');
  assert(await p.locator('.noa-my-gift-actions').isVisible(),'existing gift shortcuts remain available');
  const g=await p.evaluate(()=>{const r=document.querySelector('main').getBoundingClientRect();return {x:r.x,contentWidth:r.width,overflow:document.documentElement.scrollWidth-innerWidth};});
  assert(g.overflow<=1&&g.x>=0,JSON.stringify({width,theme,role,g}));
  assert.equal(await p.locator('#noa-menu-drawer').isVisible(),false);
  assert.equal(await p.locator('#noa-menu-drawer [data-noa-nav=music]').getAttribute('aria-disabled'),null,'member navigation remains enabled');
  assert.deepEqual(errors,[]);
  await p.screenshot({path:out+'/my-'+role+'-'+theme+'-'+width+'.png'});
  results.push({width,theme,role,...g});await c.close();
 }
 console.log('ACTUAL_MY_TEMPLATE_ISOLATED_MEMBER_VIP_TWO_THEMES',JSON.stringify(results));
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){await p.screenshot({path:out+'/failure.png',fullPage:true});writeFileSync(out+'/failure.html',await p.content());}throw e;}
finally{await browser.close();server.kill();writeFileSync(out+'/results.json',JSON.stringify(results));writeFileSync(out+'/php.log',serverErrors);}
