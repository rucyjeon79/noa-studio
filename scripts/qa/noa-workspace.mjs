import {chromium} from 'playwright';import {spawn} from 'node:child_process';import {mkdirSync,writeFileSync} from 'node:fs';import assert from 'node:assert/strict';
const base='http://127.0.0.1:8079',out='workspace-proof/candidate';mkdirSync(out,{recursive:true});const server=spawn('php',['-S','127.0.0.1:8079','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'inherit'}),browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});const report={screens:[],permissions:[],mutations:[],productionWrites:0};
async function visiblePath(page,selector,values){
 const path=page.locator(selector);await path.locator('[data-category-level="4"]').waitFor();
 assert.equal(await path.locator('[data-category-level]:visible').count(),4,selector+' has four visible levels');
 assert.deepEqual(await path.locator('[data-category-level]>a,[data-category-level]>strong').allTextContents(),values);
 const layout=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,id:e.id,className:e.className,right:e.getBoundingClientRect().right})).slice(0,20)}));
 if(layout.scroll>layout.width+1){await page.screenshot({path:out+'/classification-overflow.png',fullPage:true});writeFileSync(out+'/classification-overflow.json',JSON.stringify({selector,layout},null,2));}
 assert(layout.scroll<=layout.width+1,selector+' fits the viewport: '+JSON.stringify(layout));
}
try{
 const probe=await browser.newContext();for(let i=0;i<50;i++){try{if((await probe.request.get(base+'/')).ok())break;}catch{}await new Promise(r=>setTimeout(r,100));}await probe.close();
 for(const role of ['guest','member','vip','admin']){const c=await browser.newContext();await c.addCookies([{name:'qa_role',value:role,url:base}]);for(const path of ['/noa-library.php','/noa-record-action.php','/noa-inline-edit.php?type=song&source=music&key=story:test']){const r=await c.request.get(base+path,{maxRedirects:0});if(role!=='admin'&&[302,303].includes(r.status()))assert.match(r.headers().location,/login/);else assert.equal(r.status(),role==='admin'?(path==='/noa-record-action.php'?405:200):403,path+' '+role);}report.permissions.push(role);await c.close();}
 for(const width of [320,390,1280])for(const theme of ['noa-studio','noa-ivory']){const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});await c.addCookies([{name:'qa_role',value:'admin',url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',design:'ios',radius:'soft'})),theme);const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(base+'/noa-library.php');assert.equal(await p.locator('.noa-workspace-grid').count(),4);assert.equal(await p.locator('.noa-workspace-grid>a').first().evaluate(e=>getComputedStyle(e).justifyContent),'flex-start');assert.equal(await p.locator('.noa-workspace-advanced').getAttribute('open'),null);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:out+'/workspace-'+width+'-'+theme+'.png',fullPage:true});
 await p.goto(base+'/noa-catalog.php?q=검색');const card=p.locator('.catalog-record:visible');await card.locator('.noa-edit-edit').waitFor();assert.equal(await card.count(),1);assert.equal(await card.locator('[data-category-level]').count(),4);await card.locator('.noa-edit-edit').click();await card.locator('.noa-edit-form [data-category-level="4"]').waitFor();assert.equal(await card.locator('.noa-edit-form .noa-classification [data-category-level]').count(),4);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await p.screenshot({path:out+'/catalog-edit-'+width+'-'+theme+'.png',fullPage:true});
 await p.goto(base+'/noa-music.php?track=single:test');
 await visiblePath(p,'#music-classification',['오리지널송','K-POP Original','ACT 1','EP.2 · EP 검증곡']);
 assert(await p.locator('#music-classification').evaluate(e=>e.getBoundingClientRect().bottom<=document.getElementById('music-info-title').getBoundingClientRect().top));
 assert(await p.locator('[aria-label="곡 상세"]').isHidden(),'legacy media details stay hidden');
 await p.locator('#music-info').screenshot({path:out+'/song-info-'+width+'-'+theme+'.png'});
 await p.locator('.song[data-key="single:test"] .noa-edit-edit').click();
 await visiblePath(p,'.song[data-key="single:test"] .noa-edit-form .noa-classification',['오리지널송','K-POP Original','ACT 1','EP.2 · EP 검증곡']);
 await p.getByRole('button',{name:'정보 수정 취소',exact:true}).click();
 await p.getByRole('button',{name:'전체 음원',exact:true}).click();
 await p.locator('.song[data-key="story:test"] .song-select').click();
 await visiblePath(p,'#music-classification',['당신의 이야기, 우리의 음악','당신의 이야기, 우리의 음악 🎧','미분류','검색 검증곡']);
 await p.goto(base+'/noa-editor.php?key=single:test');
 await visiblePath(p,'#editor-classification',['오리지널송','K-POP Original','ACT 1','EP.2 · EP 검증곡']);
 await c.route('**/noa-bridge/creator.php?action=list',r=>r.fulfill({json:{channel:null,songs:[{key:'creator:fixture',title:'내 검증곡',genre:'your-story',visibility:'private',fields:{title:'내 검증곡'},state:{ready:false,status:'draft'}}]}}));
 await c.route('**/noa-bridge/creator.php?action=status*',r=>r.fulfill({json:{ready:false,status:'draft'}}));
 await p.goto(base+'/noa-creator.php');await p.locator('.creator-row button').click();
 await visiblePath(p,'#creator-classification',['당신의 이야기, 우리의 음악','당신의 이야기, 우리의 음악 🎧','미분류','내 검증곡']);
 assert(await p.locator('#creator-classification').evaluate(e=>e.getBoundingClientRect().bottom<=document.getElementById('creator-editor-title').getBoundingClientRect().top));
 await p.locator('#creator-song [name=genre]').selectOption('cover-reborn');await p.locator('#creator-song [name=title]').fill('수정 중인 커버곡');
 await visiblePath(p,'#creator-classification',['AInoa의 유명곡 커버','🎤 AInoa의 유명곡 커버','미분류','수정 중인 커버곡']);
 await p.locator('#creator-classification').screenshot({path:out+'/creator-info-'+width+'-'+theme+'.png'});
 assert.deepEqual(errors,[]);report.screens.push({width,theme,search:true,inlineEditor:true,pathLevels:4,noOverflow:true,actualMusicPage:true,directSongLink:true,selectionChanged:true,standaloneEditor:true,creatorInfo:true});await c.close();}
 const c=await browser.newContext();await c.addCookies([{name:'qa_role',value:'admin',url:base}]);const p=await c.newPage();await p.goto(base+'/noa-catalog.php?q=검색');const csrf=await p.locator('meta[name=noa-catalog-csrf]').getAttribute('content'),selector={type:'song',source:'music',key:'story:test'};
 let r=await c.request.post(base+'/noa-record-action.php',{data:{},headers:{Origin:'https://evil.example','X-NOA-CSRF':csrf}});assert.equal(r.status(),403);
 r=await c.request.post(base+'/noa-record-action.php',{data:{},headers:{Origin:'https://noastudio.ai.kr'}});assert.equal(r.status(),403);
 const get=async()=>(await (await c.request.get(base+'/noa-inline-edit.php?'+new URLSearchParams(selector))).json());let current=await get();
 await p.locator('.catalog-record:visible .noa-edit-edit').click();await p.locator('#noa-edit-title').fill('수정된 검색 검증곡');await p.getByRole('button',{name:'정보 수정 저장',exact:true}).click();await p.waitForFunction(()=>document.getElementById('catalog-status').textContent.includes('저장했습니다'));assert.equal((await get()).fields.title,'수정된 검색 검증곡');await p.locator('.noa-edit-form [data-category-level="4"]').getByText('수정된 검색 검증곡',{exact:true}).waitFor();
 await p.reload();assert.match(await p.locator('.catalog-record:visible h2').textContent(),/수정된 검색/);report.mutations.push('inline-save-visible');
 p.on('dialog',d=>d.accept());await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.locator('.catalog-record:visible [data-record-action=trash]').click()]);assert.equal(new URL(p.url()).searchParams.get('q'),'검색');assert.equal(await p.locator('.catalog-record:visible').count(),0);report.mutations.push('confirmed-trash');
 current=await get();r=await c.request.post(base+'/noa-inline-edit.php',{headers:{Origin:'https://noastudio.ai.kr','X-NOA-Bridge-Request':'1'},data:{selector,patch:{title:'삭제 중 변경'},expectedRevision:current.revision,requestId:crypto.randomUUID()}});assert.equal(r.status(),409);
 await p.goto(base+'/noa-catalog.php?view=trash');await Promise.all([p.waitForNavigation({waitUntil:'load'}),p.locator('[data-record-action=restore]').click()]);assert.equal(new URL(p.url()).searchParams.get('view'),'trash');assert.equal(await p.locator('[data-record-action=restore]').count(),0);report.mutations.push('confirmed-restore');
 await c.route('**/noa-bridge/lab-api.php?action=status',route=>route.fulfill({json:{csrf:'fixture',config:{textEnabled:false,generationEnabled:false,chatEnabled:false,maxJobUsd:0,dailyBudgetUsd:0,oauthClientId:''},configured:{textAI:false,oauth:false,fal:false},channels:[],jobs:[],events:[]}}));await p.goto(base+'/noa-ai-lab.php');assert.equal(await p.locator('#lab-text').isVisible(),true);assert.equal(await p.locator('#lab-create').isVisible(),false);await p.locator('.lab-tabs a[href="#lab-create"]').click();assert.equal(await p.locator('#lab-create').isVisible(),true);assert.equal(await p.locator('#lab-text').isVisible(),false);await p.screenshot({path:out+'/lab-tasks.png',fullPage:true});report.taskPanels=true;await p.goto(base+'/noa-ai-lab.php#settings');await p.locator('#lab-config[open]').waitFor();report.settingsShortcut=true;await c.close();
}finally{await browser.close();server.kill();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}console.log('WORKSPACE_MYSQL_HTTP_BROWSER_OK',JSON.stringify(report));
