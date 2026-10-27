import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8079',out='workspace-proof/candidate',data=JSON.parse(readFileSync(out+'/surfaces-data.json','utf8'));
mkdirSync(out,{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8079','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'inherit'});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const report={productionWrites:0,actualReadProjections:[],nativeMarkupFixtures:[],authenticatedProductionBoardVerified:false};
async function noUnderlines(p){
 assert.deepEqual(await p.locator('a:visible').evaluateAll(links=>links.flatMap(a=>[a,...a.querySelectorAll('*')]).filter(e=>getComputedStyle(e).textDecorationLine.includes('underline')).map(e=>e.outerHTML.slice(0,200))),[],'visible links have no underline');
 const link=p.locator('a:visible').first();if(await link.count()){await link.hover();assert.equal(await link.evaluate(e=>getComputedStyle(e).textDecorationLine),'none');await link.focus();assert.equal(await link.evaluate(e=>getComputedStyle(e).textDecorationLine),'none');}
}
async function fits(p,label){const dimensions=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert(dimensions.scroll<=dimensions.width+1,label+' fits '+JSON.stringify(dimensions));}
async function forms(p){return p.locator('form').evaluateAll(fs=>fs.map(f=>({action:f.getAttribute('action'),method:f.method,enctype:f.enctype,fields:[...f.querySelectorAll('input,textarea,select,button')].map(e=>({name:e.name,type:e.type,required:e.required,value:e.type==='hidden'?e.value:undefined}))})));}
try{
 const probe=await browser.newContext();for(let i=0;i<50;i++){try{if((await probe.request.get(base+'/')).ok())break;}catch{}await new Promise(r=>setTimeout(r,100));}await probe.close();
 for(const width of [320,390,1280])for(const theme of ['noa-studio','noa-ivory']){
  const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await c.addCookies([{name:'qa_role',value:'admin',url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),theme);
  // Never issue writes from this rendering regression.
  await c.route('**/*',r=>r.request().method()==='POST'?r.abort():r.continue());
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  for(const path of ['/noa-music.php','/noa-youtube.php','/noa-catalog.php']){
   const response=await p.goto(base+path+'?genre=your-story');assert(response.ok(),path+' responds');await p.waitForFunction(theme=>document.documentElement.dataset.noaTheme===theme,theme);
   const list=p.locator('.noa-user-playlist[data-playlist-id="'+data.playlist+'"]');await list.waitFor();
   assert.match(await list.locator('.noa-browse-card small').textContent(),/3(?:개)?\s*(?:영상|곡|라이브러리)/,path+' count is three');
   await list.locator('.noa-list-toggle').click();assert.deepEqual(await list.locator('.noa-inline-title').allTextContents(),data.expectedTitles,path+' uses the original short titles');assert.equal(await list.locator('.noa-inline-song').count(),3);
   await noUnderlines(p);await fits(p,path);if(width===390)await p.screenshot({path:out+'/shared-'+path.slice(5,-4)+'-'+theme+'.png',fullPage:true});
   report.actualReadProjections.push({path,width,theme,visibleSongs:3,sourceDocuments:5,savedMembers:6});
  }
  // Real library source records remain addressable despite the grouped browse view.
  if(width===390&&theme==='noa-studio'){
   await p.goto(base+'/noa-catalog.php?q=NO%20LIMITS');await p.waitForFunction(()=>!!window.NoaBrowse);await p.locator('#catalog-search').fill('NO LIMITS');await p.waitForTimeout(100);assert.equal(await p.locator('.catalog-record:visible').count(),1,'library search removes duplicate display');
   const sourceId=await p.locator('.catalog-record[data-key="'+data.sourceKeys[4]+'"] a[href^="?"]').first().getAttribute('href');assert(sourceId);await p.goto(base+'/noa-catalog.php'+sourceId);await p.locator('.catalog-record[data-key="'+data.sourceKeys[4]+'"]').waitFor();
   report.originalDetailRetained=true;
  }
  for(const view of ['list','read','write']){
   const response=await p.goto(base+'/bbs/board.php?bo_table=free&view='+view);assert(response.ok());await p.locator('html.noa-g5').waitFor();
   await noUnderlines(p);await fits(p,'board '+view);
   const before=await forms(p);await p.evaluate(()=>{document.querySelectorAll('link[href*="noa-gnuboard.css"]').forEach(e=>e.disabled=true);});const without=await forms(p);assert.deepEqual(before,without,'skin preserves native fields, tokens and destinations');await p.evaluate(()=>{document.querySelectorAll('link[href*="noa-gnuboard.css"]').forEach(e=>e.disabled=false);});
   if(view==='list')assert.equal(await p.locator('#bo_list .bo_tit a.noa-action').count(),0,'post titles remain text links');
   if(view==='read'){assert.equal(await p.locator('#nested-link').getAttribute('data-noa-icon'),null,'authored links are not decorated as action buttons');assert.equal(await p.locator('#authored-underline').evaluate(e=>getComputedStyle(e).textDecorationLine),'underline');assert.equal(await p.locator('#nested-link u').evaluate(e=>getComputedStyle(e).textDecorationLine),'none');await p.locator('#nested-link').focus();assert.equal(await p.locator('#nested-link').evaluate(e=>getComputedStyle(e).textDecorationLine),'none');}
   if(view==='write'){assert(await p.locator('#wr_content').evaluate(e=>e.getBoundingClientRect().height>=240));assert(await p.locator('#wr_subject').evaluate(e=>e.getBoundingClientRect().height>=48));await p.locator('#wr_subject').focus();assert.notEqual(await p.locator('#wr_subject').evaluate(e=>getComputedStyle(e).outlineStyle),'none','keyboard focus remains visible');}
   if(width===390||width===1280)await p.screenshot({path:out+'/board-'+view+'-'+theme+'-'+width+'.png',fullPage:true});report.nativeMarkupFixtures.push({view,width,theme,linksWithoutUnderline:true,formContractPreserved:true});
  }
  assert.deepEqual(errors,[]);await c.close();
 }
}finally{await browser.close();server.kill();writeFileSync('/tmp/noa-pwa-fixture/router.php',readFileSync('/tmp/noa-pwa-fixture/surfaces-router-before.php'));writeFileSync(out+'/surfaces-report.json',JSON.stringify(report,null,2));}
console.log('ACTUAL_THREE_SURFACE_DUPLICATES_AND_NATIVE_BOARD_STYLE_OK');
