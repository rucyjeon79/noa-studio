import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Exercise the production decorators in isolation; all writes stay in this local page.
export async function verifyRelationships(browser,out,report){
 const source=readFileSync('deploy/noa-ui.js','utf8');
 const registry=source.slice(source.indexOf('const icons='),source.indexOf('let access='));
 const decorators=source.slice(source.indexOf('function icon(key)'),source.indexOf('function navItem('));
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.route('**/*',r=>r.abort());const page=await context.newPage();
  await page.setContent('<!doctype html><html lang="ko" class="noa-member-ui"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="noa-page"><main><h1>좋은 하루를 함께</h1><section class="noa-section"><h2>별무리 라운지</h2><form class="noa-actions"><input name="record_id" type="hidden" value="unchanged"><button class="noa-button" type="submit" name="operation" value="save"><span>곡 저장</span></button><button class="noa-button" type="button">장바구니에 담기</button><button class="noa-button" type="button">링크 공유</button><button class="noa-button" type="button">글 수정</button><button class="noa-button" type="button">곡 듣기</button><button class="noa-button" type="button">알림</button><button class="noa-button" type="button">선물하기</button><button class="noa-button" type="button">알 수 없는 기능</button><button class="noa-button" type="button" id="foreign"><svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>고유 기능</button></form></section></main></body></html>');
  for(const file of ['noa-ui.css','noa-member-surfaces.css'])await page.addStyleTag({content:readFileSync('deploy/'+file,'utf8')});
  await page.evaluate(()=>{window.originalButton=document.querySelector('button');window.submits=[];document.querySelector('form').addEventListener('submit',e=>{e.preventDefault();window.submits.push([...new FormData(e.target,e.submitter)]);});});
  await page.addScriptTag({content:'(()=>{const root=document.documentElement,g5=false;'+registry+decorators+';decorate();window.fixtureDecorate=decorate;})();'});
  await page.getByRole('button',{name:'곡 저장',exact:true}).click();
  assert.deepEqual(await page.evaluate(()=>window.submits),[[['record_id','unchanged'],['operation','save']]]);
  assert.equal(await page.evaluate(()=>document.querySelector('button')===window.originalButton),true);
  const symbol=label=>page.getByRole('button',{name:label,exact:true}).locator('svg').getAttribute('data-noa-symbol');
  assert.equal(await symbol('장바구니에 담기'),'cart');assert.equal(await symbol('링크 공유'),'share');assert.equal(await symbol('글 수정'),'edit');assert.equal(await symbol('곡 듣기'),'play');
  assert.equal(await page.getByRole('button',{name:'알 수 없는 기능',exact:true}).locator('svg').count(),0);
  assert.equal(await page.locator('h1 svg').count(),0);assert.equal(await page.locator('h2 svg').getAttribute('data-noa-symbol'),'community');
  assert.equal(await page.locator('#foreign path').getAttribute('d'),'M2 2h20v20H2z');
  // Changing a nested text node must refresh the owned symbol without replacing the button.
  await page.evaluate(()=>{document.querySelector('button span').firstChild.nodeValue='곡 다운로드';});
  await page.waitForFunction(()=>document.querySelector('button svg')?.dataset.noaSymbol==='download');
  await page.evaluate(()=>{window.fixtureDecorate();window.fixtureDecorate();});
  assert.equal(await page.locator('form button').first().locator('svg').count(),1);
  assert.equal(await page.evaluate(()=>document.querySelector('form').getBoundingClientRect().top-document.querySelector('h2').getBoundingClientRect().bottom),16);
  const geometry=await page.locator('form button').evaluateAll(nodes=>nodes.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
  for(let i=0;i<geometry.length;i++)for(let j=i+1;j<geometry.length;j++){
   const a=geometry[i],b=geometry[j];const x=Math.max(a.x,b.x)<Math.min(a.right,b.right)-1,y=Math.max(a.y,b.y)<Math.min(a.bottom,b.bottom)-1;
   assert(!(x&&y),'commands overlap');if(y)assert(Math.max(b.x-a.right,a.x-b.right)>=11.5,'commands touch');
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:out+'/semantic-controls-'+width+'.jpg',type:'jpeg',quality:85});
  report.fixtures.push({key:'semantic-controls',width,eventsPreserved:true,formDataPreserved:true,dynamicSymbol:true});await context.close();
 }
 console.log('MEMBER_SEMANTIC_CONTROLS_OK');
}
export async function auditRelationships(page,entry,report){
 const result=await page.evaluate(()=>{
  const visible=e=>e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;
  const gaps=[];
  function gap(key,a,b,min,max){if(!visible(a)||!visible(b))return;const actual=b.getBoundingClientRect().top-a.getBoundingClientRect().bottom;gaps.push({key,actual,min,max,ok:actual>=min-.5&&actual<=max+.5});}
  gap('moods-to-play',document.querySelector('#noa-listening .nl-moods'),document.querySelector('#noa-listening [data-manual-play]'),16,20);
  const footer=document.querySelector('.noa-main>.noa-mobile-footer');if(footer){let prev=footer.previousElementSibling;while(prev&&!visible(prev))prev=prev.previousElementSibling;gap('home-to-footer',prev,footer,24,32);}
  const siblingFooter=document.querySelector('body>main+.noa-mobile-footer');
  if(siblingFooter){
   const main=siblingFooter.previousElementSibling;
   let last=main.lastElementChild;while(last&&!visible(last))last=last.previousElementSibling;
   gap('content-to-footer',last,siblingFooter,24,32);
   gaps.push({key:'main-dock-clearance',actual:parseFloat(getComputedStyle(main).paddingBlockEnd),min:0,max:0,ok:parseFloat(getComputedStyle(main).paddingBlockEnd)===0});
  }
  const shopActions=document.querySelector('#ecosystem[data-space=shop] #ec-content>:is(.ec-grid,.ec-empty)+.ec-actions');
  if(shopActions)gap('products-to-store-link',shopActions.previousElementSibling,shopActions,24,24);
  const directory=document.querySelector('#community-boards'),crosslinks=directory?.nextElementSibling;
  if(crosslinks?.matches('.ec-crosslinks'))gap('directory-to-crosslinks',directory,crosslinks,0,0);
  const tools=document.querySelector('.ny-store-tools'),section=tools?.nextElementSibling;
  if(tools&&section?.matches('.ny-product-section'))gap('store-tools-to-products',tools,section,24,32);
  const touched=[];
  for(const group of document.querySelectorAll('.noa-actions,.creator-actions,.ncea-actions,.noa-record-actions,.ec-actions,.ny-store .np-pack-copy,.nl-heading')){
   if(group.closest('dialog:not([open])'))continue;
   const children=[...group.children].filter(e=>visible(e)&&e.matches('button,a,input:not([type=hidden])'));
   for(let i=0;i<children.length;i++)for(let j=i+1;j<children.length;j++){
    const a=children[i].getBoundingClientRect(),b=children[j].getBoundingClientRect();
    const x=Math.max(a.left,b.left)<Math.min(a.right,b.right)-1,y=Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom)-1;
    if(x&&y||y&&Math.max(b.left-a.right,a.left-b.right)<7.5||x&&Math.max(b.top-a.bottom,a.top-b.bottom)<7.5)touched.push({group:group.className,a:children[i].textContent.slice(0,20),b:children[j].textContent.slice(0,20)});
   }
  }
  const invalid=[...document.querySelectorAll('svg[data-noa-symbol] path')].filter(p=>!p.getAttribute('d')||p.getAttribute('d')==='undefined').length;
  const scene=document.querySelector('.noa-footer-scene');const ending=visible(scene)?document.documentElement.scrollHeight-(scene.getBoundingClientRect().bottom+scrollY):null;const root=getComputedStyle(document.documentElement);const footerClearance=(document.querySelector('.noa-mobile-nav')?.getBoundingClientRect().height||0)+['--noa-player-space','--noa-transfer-space'].reduce((sum,key)=>sum+(parseFloat(root.getPropertyValue(key))||0),0);return {gaps,touched,invalid,ending,footerClearance,scrolls:document.documentElement.scrollHeight>innerHeight+1};
 });
 (report.relationships??=[]).push({...entry,...result});
 if(result.ending!==null&&result.scrolls)assert(result.ending<=result.footerClearance+48,'excess space after footer: '+JSON.stringify({...entry,...result}));
 assert.equal(result.invalid,0,'invalid icon path');
 assert.deepEqual(result.gaps.filter(x=>!x.ok),[],JSON.stringify(entry));
 assert.deepEqual(result.touched,[],JSON.stringify(entry));
}

// Fixed controls must reserve space after the scene, never between content and scene.
export async function verifyFooterClearance(page,entry,report){
 if(!await page.locator('body>main+.noa-mobile-footer').count())return;
 const measurements=await page.evaluate(()=>{
  const root=document.documentElement,main=document.querySelector('body>main:has(+.noa-mobile-footer)'),footer=main.nextElementSibling;
  const keys=['--noa-nav-space','--noa-player-space','--noa-transfer-space'];
  const saved=keys.map(k=>[k,root.style.getPropertyValue(k),root.style.getPropertyPriority(k)]);
  try{return [[0,0,0],[64,0,0],[64,80,56]].map(values=>{
   keys.forEach((k,i)=>root.style.setProperty(k,values[i]+'px'));
   const last=[...main.children].filter(e=>e.getBoundingClientRect().height>0).at(-1);
   return {values,gap:footer.getBoundingClientRect().top-last.getBoundingClientRect().bottom,mainEnd:parseFloat(getComputedStyle(main).paddingBlockEnd),footerEnd:parseFloat(getComputedStyle(footer).paddingBottom)};
  });}finally{for(const [k,v,p] of saved){if(v)root.style.setProperty(k,v,p);else root.style.removeProperty(k);}}
 });
 for(const item of measurements){assert.equal(item.mainEnd,0);assert(item.gap>=23.5&&item.gap<=32.5,JSON.stringify({...entry,...item}));assert.equal(item.footerEnd,item.values.reduce((a,b)=>a+b,24));}
 (report.clearance??=[]).push({...entry,measurements});
}

// Public music redirects guests home. Cover the signed-in music footer topology
// with the actual music stylesheet and cross-link mounting code, without audio.
export async function verifyMusicFooter(browser,out,report){
 const music=readFileSync('deploy/noa-music.php','utf8');
 const inline=[...music.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m=>m[1]).join('\n');
 const themes=JSON.parse(readFileSync('deploy/noa-design.json','utf8')).themes;
 for(const width of [320,390,768,1440])for(const theme of themes){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
  await context.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'}));
  const page=await context.newPage();await page.goto('https://music.fixture/noa-music.php');
  const tokens=Object.entries(theme.tokens).map(([k,v])=>'--noa-'+k+':'+v).join(';');
  await page.setContent('<!doctype html><html lang="ko" class="noa-shell-wide noa-member-ui" data-noa-precision="true" data-noa-style="starlight" data-noa-theme="'+theme.id+'" style="'+tokens+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="noa-page noa-sound-page noa-record-room"><main><section><h1>당신의 이야기, 우리의 음악</h1><p>사연 남기기 → 창작자의 곡 답변 → 카드로 바로 듣기.</p><details><summary>내 삶의 가장 따뜻한 선물</summary><p>사연곡</p></details><details><summary>봄내음 보다 너를</summary><p>사연곡</p></details></section><audio id="sound-player"></audio></main><footer class="noa-sidebar-bottom noa-mobile-footer"><section class="noa-footer-scene" aria-label="스튜디오 안내"></section></footer></body></html>');
  await page.addStyleTag({content:inline});
  for(const file of ['noa-ui.css','noa-starlight.css','noa-music-vinyl.css','noa-member-surfaces.css'])await page.addStyleTag({content:readFileSync('deploy/'+file,'utf8')});
  await page.addScriptTag({content:readFileSync('deploy/noa-ecosystem-links.js','utf8')});
  await page.locator('#noa-ecosystem-links').waitFor();
  await verifyFooterClearance(page,{path:'signed-in-music-fixture',width,theme:theme.id},report);
  const gap=await page.evaluate(()=>{const links=document.querySelector('#noa-ecosystem-links');return document.querySelector('.noa-mobile-footer').getBoundingClientRect().top-links.getBoundingClientRect().bottom;});
  assert.equal(gap,24);
  report.fixtures.push({key:'music-footer',width,theme:theme.id,gap,actualMusicStyles:true,actualCrossLinks:true});
  // The initially empty history must end at the same spacing as the loaded state.
  for(const file of ['noa-points.css','noa-vip.css'])await page.addStyleTag({content:readFileSync('deploy/'+file,'utf8')});
  for(const kind of ['points','vip']){
   const template=readFileSync('deploy/noa-'+kind+'.php','utf8').match(/<section[^>]*class="np-history"[^>]*>[\s\S]*?<\/section>/)[0];
   for(const state of ['loading','loaded','admin']){
    await page.evaluate(({template,kind,state})=>{
     document.body.className='noa-page';const main=document.querySelector('main');main.className='noa-points-page';main.innerHTML=template;
     const orders=document.getElementById(kind+'-orders');orders.replaceChildren();
     if(state!=='loading'){const p=document.createElement('p');p.textContent='로그인 후 구매 내역을 확인할 수 있어요.';orders.append(p);}
     if(state==='admin'){const link=document.createElement('p');link.className='np-admin-link';link.innerHTML='<a href="/noa-payment-settings.php">결제 연동 설정</a>';main.append(link);}
    },{template,kind,state});
    await verifyFooterClearance(page,{path:kind+'-'+state+'-fixture',width,theme:theme.id},report);
   }
  }
  report.fixtures.push({key:'wallet-endings',width,theme:theme.id,states:['loading','loaded','admin'],stores:['points','vip']});
  await context.close();
 }
 console.log('MEMBER_MUSIC_FOOTER_OK');
}
