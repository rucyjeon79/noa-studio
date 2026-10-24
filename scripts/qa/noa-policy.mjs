import {chromium} from 'playwright';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const root=process.env.NOA_SOURCE_ROOT||process.cwd(),base='https://noastudio.ai.kr';
const phase=process.env.NOA_POLICY_PHASE||'candidate',out=path.join(root,'policy-proof',phase);mkdirSync(out,{recursive:true});
const policy='<link rel="stylesheet" href="/noa-policy-20261024.css">';
const common='<link rel="stylesheet" href="/noa-ui.css?v=20261022-recovery2">';
const shared='<script src="/noa-ui.js?v=20261024-policy1" defer></script>';
const themeOnly='<script src="/noa-ui.js?v=20261024-policy1" data-noa-theme-only defer></script>';
const definitions=[['database','deploy/noa-app/database/index.php'],['taxonomy','deploy/noa-app/taxonomy/index.php'],['jukebox','deploy/noa-app/jukebox/index.php']];
const fixtures=new Map();
for(const[name,file]of definitions){
 const script='$t=token_get_all(file_get_contents($argv[1]));foreach($t as $v)if(is_array($v)&&$v[0]===T_INLINE_HTML)echo $v[1];';
 let html=execFileSync('php',['-r',script,path.join(root,file)],{encoding:'utf8',maxBuffer:2e6});
 html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 html=html.replace('</head>',common+policy+themeOnly+'</head>');
 html=html.replace('<body','<body data-policy-fixture="true"').replace(/<img\b[^>]*src=""[^>]*>/gi,'');
 if(name==='database')html=html.replace('</main>','<section><div class="cards"><div class="card"><strong>82</strong><span>연결된 테이블</span></div></div></section></main>');
 if(name==='taxonomy')html=html.replace('id="counts" class="cards"></div>','id="counts" class="cards"><div class="metric"><strong>10</strong>분류 항목</div></div>');
 fixtures.set('/noa-app/'+name+'/',html);
}
fixtures.set('/noa-policy-dock-fixture','<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1">'+common+'<link rel="stylesheet" href="/noa-app/jukebox/upload.css">'+policy+shared+'</head><body class="noa-page noa-sound-page noa-processing-dock"><main><h1>표시 전용 검증</h1><div style="min-height:900px"></div><button id="last-action">마지막 조작</button></main><section id="jukebox-transfer-dock"><div class="jukebox-transfer-head"><strong>업로드 진행 상태</strong><button type="button" id="details-toggle" onclick="document.getElementById(\'jukebox-transfer-details\').hidden=!document.getElementById(\'jukebox-transfer-details\').hidden">자세히</button></div><div id="jukebox-transfer-details" hidden><p>완료된 파일만 게시합니다.</p><p>현재 작업과 대기 목록을 보존합니다.</p></div></section></body></html>');
const browser=await chromium.launch({headless:true,executablePath:process.env.NOAC_CHROME||'/usr/bin/google-chrome',args:['--no-sandbox']});
const report={phase,rows:[],runtimeWrites:0,privateViews:'in-memory source fixtures; not authenticated production',errors:[]};
let activePage;
try{
 for(const theme of ['noa-studio','noa-ivory'])for(const[w,h]of [[320,740],[390,844],[760,1024],[1024,768],[1440,900],[844,390]]){
  const context=await browser.newContext({viewport:{width:w,height:h},reducedMotion:'reduce'});
  await context.addInitScript(({theme})=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),{theme});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(!['GET','HEAD'].includes(req.method())){report.errors.push('Unexpected mutation: '+u.pathname);return route.abort();}
   if(u.origin===base){
    if(req.isNavigationRequest()&&fixtures.has(u.pathname))return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixtures.get(u.pathname)});
    if(phase==='candidate'&&['/noa-ui.js','/noa-policy-20261024.css'].includes(u.pathname))return route.fulfill({path:path.join(root,'deploy',u.pathname),contentType:u.pathname.endsWith('.js')?'application/javascript':'text/css'});
    if(phase==='candidate'&&req.isNavigationRequest()&&['/','/bbs/login.php','/noa-settings.php','/noa-music.php'].includes(u.pathname)){
     try{const response=await route.fetch({maxRetries:2});let html=await response.text();html=html.replace('</head>',policy+'</head>');return route.fulfill({response,body:html});}
     catch(e){report.errors.push('Candidate HTML transport failed: '+u.pathname);await route.abort();return;}
    }
   }
   return route.continue();
  });
  const page=await context.newPage();activePage=page;page.on('pageerror',e=>report.errors.push(String(e)));
  for(const pathname of ['/bbs/login.php','/noa-settings.php',...definitions.map(([name])=>'/noa-app/'+name+'/'),'/noa-policy-dock-fixture']){
   await page.goto(base+pathname,{waitUntil:'networkidle'});
   await page.waitForFunction(theme=>document.documentElement.dataset.noaTheme===theme,theme);
   const measured=await page.evaluate(()=>{
    const rect=el=>{const r=el.getBoundingClientRect();return {w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom}};
    const style=el=>{const s=getComputedStyle(el);return{bg:s.backgroundColor,color:s.color,border:s.borderTopWidth,shadow:s.boxShadow}};
    const login=document.querySelector('#mb_login');
    return{overflow:document.documentElement.scrollWidth>innerWidth+1,body:style(document.body),themeOnly:document.documentElement.dataset.noaThemeOnly,
     sidebars:document.querySelectorAll('.noa-sidebar').length,
     login:login?{inner:style(login.querySelector('.mbskin_box')),find:rect(document.querySelector('#login_info a')),auto:rect(document.querySelector('#login_info label'))}:null,
     smallLinks:[...document.querySelectorAll('.noa-sidebar-bottom a')].filter(e=>e.getBoundingClientRect().height).map(rect),
     metrics:[...document.querySelectorAll('section .cards>.card,section .cards>.metric')].map(style)};
   });
   assert(!measured.overflow,`${theme} ${w} ${pathname}: horizontal overflow`);
   if(pathname==='/bbs/login.php'){
    assert(measured.login);assert.equal(measured.login.inner.border,'0px');assert.equal(measured.login.inner.shadow,'none');
    assert(measured.login.find.h>=44&&measured.login.auto.h>=44,'Login touch targets below 44px');
    for(const r of measured.smallLinks)assert(r.h>=44,'Sidebar touch target below 44px');
   }
   if(definitions.some(([name])=>pathname==='/noa-app/'+name+'/')){
    assert.equal(measured.themeOnly,'true');assert.equal(measured.sidebars,0,'Workspace shell duplicated');
    const token=JSON.parse(readFileSync(path.join(root,'deploy/noa-design.json'),'utf8')).themes.find(t=>t.id===theme).tokens.bg;
    const rgb='rgb('+[1,3,5].map(i=>parseInt(token.slice(i,i+2),16)).join(', ')+')';assert.equal(measured.body.bg,rgb,'Workspace palette differs from shared theme');
    for(const s of measured.metrics){assert.equal(s.border,'0px');assert.equal(s.shadow,'none');}
   }
   if(pathname==='/noa-policy-dock-fixture'){
    for(const expanded of [false,true]){
     if(expanded)await page.locator('#details-toggle').click();
     await page.waitForFunction(()=>Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--noa-transfer-space'))-document.getElementById('jukebox-transfer-dock').getBoundingClientRect().height)<2);
     const boxes=await page.evaluate(()=>{const d=document.getElementById('jukebox-transfer-dock').getBoundingClientRect(),n=document.querySelector('.noa-mobile-nav'),s=document.querySelector('.noa-sidebar');return{dock:{left:d.left,bottom:d.bottom},navTop:n&&getComputedStyle(n).display!=='none'?n.getBoundingClientRect().top:innerHeight,sidebarRight:s&&getComputedStyle(s).display!=='none'?s.getBoundingClientRect().right:0};});
     assert(boxes.dock.bottom<=boxes.navTop+1,'Upload dock covers mobile navigation');assert(boxes.dock.left>=boxes.sidebarRight-1,'Upload dock covers desktop sidebar');
     await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
     assert(await page.locator('#last-action').evaluate(el=>{const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return el===hit||el.contains(hit)}),'Final action covered by dock');
    }
   }
   report.rows.push({theme,width:w,height:h,path:pathname,ok:true});
   if((w===390||w===1440)&&['/bbs/login.php','/noa-app/database/','/noa-app/taxonomy/','/noa-policy-dock-fixture'].includes(pathname))await page.screenshot({path:path.join(out,theme+'-'+w+'-'+pathname.replaceAll('/','_')+'.png'),fullPage:false});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);
 console.log('NOA_COMMON_POLICY_VISUAL_OK',JSON.stringify({phase,cases:report.rows.length,errors:report.errors}));
}catch(e){report.errors.push(String(e));if(activePage&&!activePage.isClosed())await activePage.screenshot({path:path.join(out,'failure.png'),fullPage:false}).catch(()=>{});throw e;
}finally{writeFileSync(path.join(out,'result.json'),JSON.stringify(report,null,2));await browser.close();}
