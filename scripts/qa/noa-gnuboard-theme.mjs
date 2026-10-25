/* Observe real native skins; candidate overlays only the new CSS. No form submission. */
import {chromium} from 'playwright';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const phase=process.env.NOA_G5_PHASE||'candidate',base='https://noastudio.ai.kr',out='gnuboard-proof/'+phase;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
function contrast(a,b){const lum=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4;});return v[0]*.2126+v[1]*.7152+v[2]*.0722;};const x=lum(a),y=lum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
try{
 for(const width of [360,390,430,1280]){
  const mobile=width<700,context=await browser.newContext({viewport:{width,height:844},isMobile:mobile,hasTouch:mobile,serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',async route=>{
   if(!['GET','HEAD'].includes(route.request().method()))return route.abort('blockedbyclient'); // Native CAPTCHA initialization is also blocked; never submit forms.
   const u=new URL(route.request().url());
   if(phase==='candidate'&&u.origin===base&&u.pathname==='/noa-gnuboard.css')return route.fulfill({path:process.cwd()+'/deploy/noa-gnuboard.css',contentType:'text/css'});
   if(phase==='candidate'&&u.origin===base&&route.request().isNavigationRequest()&&u.pathname.startsWith('/bbs/')){const response=await route.fetch();const body=(await response.text()).replace('</head>','<link rel="stylesheet" href="/noa-gnuboard.css?candidate"></head>');return route.fulfill({response,body});}
   return route.continue();
  });
  const page=await context.newPage();
  for(const route of ['/bbs/login.php','/bbs/board.php?bo_table=free','/bbs/register.php','/bbs/password_lost.php','/bbs/content.php?co_id=privacy']){
   const response=await page.goto(base+route+(route.includes('?')?'&':'?')+'device='+(mobile?'mobile':'pc'),{waitUntil:'domcontentloaded'});assert.equal(response.status(),200);await page.waitForFunction(()=>window.NoaUI?.getState());
   const originalForms=await page.locator('form').evaluateAll(nodes=>nodes.map(n=>({action:n.action,method:n.method,inputs:[...n.querySelectorAll('input,textarea,select')].map(i=>[i.name,i.type,i.required])})));
   for(const theme of ['noa-studio','noa-ivory']){
    await page.evaluate(theme=>window.NoaUI.apply({...window.NoaUI.getState(),theme}),theme);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const audit=await page.evaluate(()=>{
     const normalized=v=>{v=v.trim();if(!v.startsWith('#'))return v;let h=v.slice(1);if(h.length===3)h=h.split('').map(c=>c+c).join('');return 'rgb('+h.match(/../g).slice(0,3).map(x=>parseInt(x,16)).join(', ')+')';};const root=getComputedStyle(document.documentElement),color=(n)=>getComputedStyle(n),visible=n=>n.getBoundingClientRect().width>0&&n.getBoundingClientRect().height>0;
     const selectors=['#container_title','#mb_login','#flogin','#login_frm','#login_info','.mb_login_join','#bo_list','#bo_list_total','.empty_table','#bo_sch','#fregister section','#fregister_chkall','#find_info','.new_win_con','#ctt'];
     return{theme:document.documentElement.dataset.noaTheme,overflow:document.documentElement.scrollWidth>innerWidth+1,surfaces:selectors.flatMap(sel=>[...document.querySelectorAll(sel)].filter(visible).map(n=>({selector:sel,bg:color(n).backgroundColor,color:color(n).color}))),inputs:[...document.querySelectorAll('input.frm_input,input.sch_input,select,textarea')].filter(visible).map(n=>({bg:color(n).backgroundColor,color:color(n).color})),palette:['--noa-bg','--noa-surface','--noa-raised'].map(k=>normalized(root.getPropertyValue(k))),surface:root.getPropertyValue('--noa-surface').trim(),bodyBg:color(document.body).backgroundColor};
    });
    writeFileSync(out+'/last-audit.json',JSON.stringify({route,width,theme,...audit},null,2));assert.equal(audit.theme,theme);assert(!audit.overflow,'horizontal overflow '+route+' '+width);
    for(const n of [...audit.surfaces,...audit.inputs]){if(!n.bg.startsWith('rgba')&&!n.bg.startsWith('color(')){assert(audit.palette.includes(n.bg),'skin surface outside selected palette '+JSON.stringify(n));assert(contrast(n.color,n.bg)>=4.5,'text contrast '+JSON.stringify(n));}}
    assert.deepEqual(await page.locator('form').evaluateAll(nodes=>nodes.map(n=>({action:n.action,method:n.method,inputs:[...n.querySelectorAll('input,textarea,select')].map(i=>[i.name,i.type,i.required])}))),originalForms,'native form changed');
    if(width===390||width===1280)await page.screenshot({path:out+'/'+theme+'-'+route.replace(/[^a-z0-9]/gi,'-')+'-'+width+'.jpg',type:'jpeg',quality:86});report.push({route,width,theme,...audit,formsPreserved:true});
   }
  }
  // Empty board search remains usable without creating or editing content.
  await page.goto(base+'/bbs/board.php?bo_table=free&device='+(mobile?'mobile':'pc'));await page.locator('select[name=sfl]').selectOption('wr_subject||wr_content');assert.equal(await page.locator('select[name=sfl]').inputValue(),'wr_subject||wr_content');
  await context.close();
 }
 writeFileSync(out+'/report.json',JSON.stringify({ok:true,phase,cases:report,physicalAndroid:false,databaseWrites:0},null,2));console.log('NOA_GNUBOARD_THEMES_OK',report.length);
}finally{await browser.close();}
