import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const source=process.env.NOA_SOURCE_ROOT||process.cwd();
const phase=process.env.NOA_THEME_PHASE||'live';
const output='room-theme-proof/'+phase;
const config=JSON.parse(readFileSync(source+'/deploy/noa-design.json','utf8'));
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync(output,{recursive:true});
const results=[];
try{for(const width of [390,768,1280]){
 const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'}),p=await context.newPage();
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 if(phase==='candidate')for(const name of ['noa-design.json','noa-starlight.css']){
  await context.route('**/'+name+'*',route=>route.fulfill({body:readFileSync(source+'/deploy/'+name),contentType:name.endsWith('.css')?'text/css':'application/json'}));
 }
 const base='https://noastudio.ai.kr';
 await p.goto(base+'/noa-settings.php');
 await p.locator('#noa-theme').waitFor();
 assert.equal(await p.locator('#noa-theme').inputValue(),'noa-studio','fresh visitor defaults to dark');
 for(const mode of ['noa-ivory','noa-studio']){
  const theme=config.themes.find(t=>t.id===mode);
  await p.locator('#noa-theme').selectOption(mode);
  assert.equal(await p.locator('#noa-theme option:checked').innerText(),theme.name);
  for(const [route,room] of [['/','home'],['/noa-lounge.php','community'],['/noa-shop.php','shop'],['/noa-settings.php','']]){
   await p.goto(base+route,{waitUntil:'domcontentloaded'});
   await p.waitForFunction(([mode,room])=>document.documentElement.dataset.noaTheme===mode&&document.documentElement.dataset.noaRoom===room,[mode,room]);
   // Close the real campaign overlay through its existing control, without account writes.
   if(room==='home'){
    const close=p.locator('#noa-amt-fan .amt-close');
    if(await close.isVisible())await close.click();
   }
   await p.evaluate(()=>document.fonts.ready);
   const metrics=await p.evaluate(()=>{
    const root=document.documentElement,style=getComputedStyle(root);
    return {bg:style.getPropertyValue('--noa-bg').trim().toLowerCase(),shared:style.getPropertyValue('--noa-darkGray').trim().toLowerCase(),scheme:style.colorScheme,overflow:root.scrollWidth-innerWidth,text:document.querySelector('main')?.innerText.length||0};
   });
   results.push({width,mode,route,...metrics});
   assert.equal(metrics.bg,theme.tokens.bg.toLowerCase());
   assert.equal(metrics.shared,'#30343b');
   assert.equal(metrics.scheme,mode==='noa-ivory'?'light':'dark');
   assert(metrics.overflow<=1,JSON.stringify(results.at(-1)));
   assert(metrics.text>20,'visible content: '+route);
   assert.deepEqual(errors,[],'uncaught browser errors: '+route);
   await p.screenshot({path:output+'/'+(room||'settings')+'-'+mode+'-'+width+'.png'});
  }
  assert.equal(await p.locator('#noa-theme').inputValue(),mode,'theme survives navigation');
  await p.reload();await p.locator('#noa-theme').waitFor();
  assert.equal(await p.locator('#noa-theme').inputValue(),mode,'theme survives reload');
 }
 await context.close();
}console.log('DARK_DEFAULT_LIGHT_COMPATIBILITY_CONTRAST_LAYOUT_AND_RELOAD_OK');
}finally{
 writeFileSync(output+'/results.json',JSON.stringify(results,null,2));
 await browser.close();
}
