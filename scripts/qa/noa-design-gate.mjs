// Approved player and browse geometry, using real PHP templates with synthetic catalogue data.
// Compare deployed assets to the candidate on the identical isolated content.
import {chromium} from 'playwright';import pixelmatch from 'pixelmatch';import {PNG} from 'pngjs';import {spawn} from 'node:child_process';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const black=Buffer.alloc(16*16*4,255),changed=Buffer.from(black);for(let y=4;y<12;y++)for(let x=4;x<12;x++)for(let c=0;c<3;c++)changed[(y*16+x)*4+c]=0;assert(pixelmatch(black,changed,null,16,16,{threshold:.1,includeAA:false})>0,'visual comparator must reject real changes');
const out='design-proof';mkdirSync(out,{recursive:true});const server=spawn('php',['-S','127.0.0.1:8093','tests/p0/router.php'],{stdio:'ignore'});let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8093/')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const assets=new Map(),report=[];
 for(const width of [360,390,430,1280])for(const theme of ['noa-studio','noa-ivory']){
  const shots={};for(const phase of ['operating-assets','candidate']){
   const context=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
   await context.route('**/embed/**',r=>r.fulfill({contentType:'text/html',body:'<p>Isolated video fixture</p>'}));
   if(phase==='operating-assets')await context.route(/\.(css|js)(\?.*)?$/,async route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1')return route.continue();if(u.pathname==='/noa-sw.js')return route.fulfill({status:404,body:''});if(!assets.has(u.pathname)){const response=await context.request.get('https://noastudio.ai.kr'+u.pathname);assert(response.ok(),'operating asset '+u.pathname);assets.set(u.pathname,await response.body());}return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'application/javascript',body:assets.get(u.pathname)});});
   await page.goto('http://127.0.0.1:8093/noa-music.php?track=one');await page.waitForFunction(()=>window.NoaUI?.getState()?.theme);await page.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);
   await page.addStyleTag({content:'*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}'});await page.evaluate(()=>document.fonts.ready);
   const dock=page.locator('.noa-two-line');await dock.waitFor({state:'visible'});
   const metrics=await dock.evaluate(bar=>{const top=bar.querySelector('.noa-dock-top').getBoundingClientRect(),bottom=bar.querySelector('.noa-dock-bottom').getBoundingClientRect(),b=bar.getBoundingClientRect(),nav=document.querySelector('.noa-mobile-nav')?.getBoundingClientRect(),controls=[...bar.querySelectorAll('button')].filter(n=>n.getBoundingClientRect().width>0).map(n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}),art=bar.querySelector('#dock-cover-empty').getBoundingClientRect();return {twoRows:bottom.top>=top.bottom,noOverflow:document.documentElement.scrollWidth<=innerWidth+1,noNavOverlap:!nav?.height||b.bottom<=nav.top+1,touchTargets:controls.every(r=>r.width>=44&&r.height>=44),controlsDoNotOverlap:controls.every((a,i)=>controls.slice(i+1).every(b=>a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1)),squareCover:Math.abs(art.width-art.height)<1,noNestedDecoratedCard:[...bar.querySelectorAll('.noa-dock-top,.noa-dock-bottom,.controls')].every(n=>{const c=getComputedStyle(n);return c.boxShadow==='none'&&parseFloat(c.borderTopWidth)===0;})};});
   for(const [name,passed]of Object.entries(metrics))assert(passed,`${name} ${width} ${theme} ${phase}`);
   const file=`${out}/${theme}-${width}-${phase}.png`;shots[phase]=await dock.screenshot({path:file});await page.screenshot({path:`${out}/music-${theme}-${width}-${phase}.png`});
   assert.deepEqual(errors,[]);report.push({width,theme,phase,...metrics,screenshot:file});await context.close();
  }
  // Standard perceptual comparison excludes antialiasing only; no changed UI pixels allowed.
  const a=PNG.sync.read(shots['operating-assets']),b=PNG.sync.read(shots.candidate);
  assert.equal(a.width,b.width);assert.equal(a.height,b.height);
  const diff=new PNG({width:a.width,height:a.height}),changed=pixelmatch(a.data,b.data,diff.data,a.width,a.height,{threshold:0.1,includeAA:false});
  writeFileSync(`${out}/diff-${theme}-${width}.png`,PNG.sync.write(diff));
  const pixels={dimensionsMatch:true,changedPixels:changed,pixelCount:a.width*a.height,comparison:'pixelmatch 7.1 threshold 0.1, antialias exclusion, zero changed pixels'};
  writeFileSync(`${out}/comparison-${theme}-${width}.json`,JSON.stringify(pixels,null,2));
  assert.equal(changed,0,`approved player screenshot changed: ${width} ${theme}`);
  report.push({width,theme,screenshotComparison:pixels});
 }
 for(const width of [360,390,430,1280])for(const theme of ['noa-studio','noa-ivory']){
  const c=await browser.newContext({viewport:{width,height:844},reducedMotion:'reduce',serviceWorkers:'block'}),p=await c.newPage();await p.goto('http://127.0.0.1:8093/noa-work-status.php');await p.waitForFunction(()=>window.NoaUI?.getState()?.theme);await p.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);
  assert.equal(await p.locator('article[data-task-id]').count(),7);assert(await p.getByText('ChatGPT Work 내부 실행 상태를 제어하거나 표시하는 화면은 아닙니다.',{exact:false}).isVisible());await p.getByText('2026.10.26 추가 지시 원문',{exact:true}).click();assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${out}/n80-${theme}-${width}.png`});report.push({page:'N80 task journal',width,theme,tasks:7,originalDirectiveVisible:true,noOverflow:true});await c.close();
 }
 for(const width of [360,390,430])for(const theme of ['noa-studio','noa-ivory']){
  const c=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),p=await c.newPage();
  await c.route('**/noa-bridge/creator.php*',r=>r.fulfill({json:{channel:null,songs:[{key:'fixture',title:'모바일 수정 버튼 확인',genre:'your-story',visibility:'private',fields:{title:'모바일 수정 버튼 확인'},state:{ready:false,status:'draft'}}]}}));
  await p.goto('http://127.0.0.1:8093/noa-creator.php');await p.waitForFunction(()=>document.querySelector('.creator-row button'));
  await p.waitForFunction(()=>window.NoaUI?.getState()?.theme);await p.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);
  await p.addStyleTag({url:'http://127.0.0.1:8093/noa-ainoa.css'});await p.addScriptTag({url:'http://127.0.0.1:8093/noa-ainoa.js'});
  const edit=p.getByRole('button',{name:'수정',exact:true});await edit.scrollIntoViewIfNeeded();
  assert(await edit.evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el===hit||el.contains(hit);}),'creator action obscured by floating search');
  await edit.click();assert(await p.locator('#creator-editor').isVisible());assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:`${out}/creator-${theme}-${width}.png`});
  report.push({page:'creator',width,theme,editClickable:true,noOverflow:true});await c.close();
 }
 writeFileSync(out+'/report.json',JSON.stringify({cases:report,approvedPlayerScreenshotComparison:true,content:'isolated fixture; real PHP template and deployed/candidate assets'},null,2));console.log('NOA_DESIGN_GATE_OK',report.length);
}finally{await browser?.close();server.kill();}
