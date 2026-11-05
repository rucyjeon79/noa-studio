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
  await page.setContent('<!doctype html><html lang="ko" class="noa-member-ui"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body class="noa-page"><main><h1>좋은 하루를 함께</h1><section class="noa-section"><h2>별무리 라운지</h2></section><form class="noa-actions"><input name="record_id" type="hidden" value="unchanged"><button class="noa-button" type="submit" name="operation" value="save"><span>곡 저장</span></button><button class="noa-button" type="button">장바구니에 담기</button><button class="noa-button" type="button">링크 공유</button><button class="noa-button" type="button">글 수정</button><button class="noa-button" type="button">곡 듣기</button><button class="noa-button" type="button">알림</button><button class="noa-button" type="button">선물하기</button><button class="noa-button" type="button">알 수 없는 기능</button><button class="noa-button" type="button" id="foreign"><svg viewBox="0 0 24 24"><path d="M2 2h20v20H2z"/></svg>고유 기능</button></form></main></body></html>');
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
  return {gaps,touched,invalid};
 });
 (report.relationships??=[]).push({...entry,...result});
 assert.equal(result.invalid,0,'invalid icon path');
 assert.deepEqual(result.gaps.filter(x=>!x.ok),[],JSON.stringify(entry));
 assert.deepEqual(result.touched,[],JSON.stringify(entry));
}
