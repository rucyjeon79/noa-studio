// Real editor code with isolated API fixtures; never sends a paid generation request.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.env.NOA_AINOA_PHASE||'candidate',out='ainoa-proof/'+phase;mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
try{for(const width of [360,390,430,1280]){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();let mode='unconfigured',posts=[],saved=0,pending=null,revision=1;
 const fields={title:'검증용 곡',youtubeTitle:'기존 영상 제목',lyrics:'보존할 가사',sunoPrompt:'기존 스타일',description:'보존할 영상 설명',communityPost:'기존 커뮤니티 글'};const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/noa-ainoa.php*',async route=>{
  const request=route.request();if(request.method()==='GET')return route.fulfill({json:{ok:true,csrf:'isolated',generation:{ready:mode!=='unconfigured',missing:mode==='unconfigured'?['api_key','daily_budget']:[]}}});
  const b=request.postDataJSON();posts.push(b);if(mode==='network')return route.abort('failed');if(mode==='html')return route.fulfill({status:503,contentType:'text/html',body:'<html>upstream unavailable</html>'});
  if(mode==='pending')await new Promise(resolve=>pending=resolve);return route.fulfill({json:{ok:true,text:'새 영상 제목 초안',saved:false,requestId:b.requestId}});
 });
 await context.route('**/noa-inline-edit.php*',route=>{if(route.request().method()==='POST'){saved++;Object.assign(fields,route.request().postDataJSON().patch);revision++;return route.fulfill({json:{ok:true,revision}});}return route.fulfill({json:{ok:true,writeKey:'single:fixture:01',revision,packageType:'song',context:{genre:'kpop-original'},fields}});});
 await page.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded'});
 if(phase==='candidate')await page.addScriptTag({path:'deploy/noa-browse-edit.js'});else await page.addScriptTag({url:'https://noastudio.ai.kr/noa-browse-edit.js?proof='+Date.now()});
 await page.evaluate(()=>{const host=document.createElement('main');host.id='generation-fixture';host.className='noa-page';host.innerHTML='<div class="noa-inline-song-row" data-inline-key="single:fixture:01"><button class="noa-inline-song">검증용 곡</button></div>';document.body.append(host);window.NoaBrowseEdit.mount({host,rows:[{key:'single:fixture:01',title:'검증용 곡'}],kind:'곡',onSaved(){}});});
 await page.locator('#generation-fixture .noa-edit-edit').click();const input=page.locator('#noa-edit-youtubeTitle'),wrap=input.locator('..'),ai=wrap.getByRole('button',{name:'YouTube 제목 AI 생성 또는 수정'});
 await ai.click();await wrap.getByText(/API 키/).waitFor();assert.equal(posts.length,0);assert.equal(await input.inputValue(),'기존 영상 제목');assert.equal(await wrap.getByRole('link').getAttribute('href'),'/noa-ai-lab.php');
 mode='pending';await ai.click();await page.waitForFunction(()=>document.querySelector('#noa-edit-youtubeTitle')?.parentElement.textContent.includes('작성 중'));
 assert(await ai.isDisabled());await ai.evaluate(b=>b.click());assert.equal(posts.length,1);pending();
 await wrap.getByRole('button',{name:'초안 적용',exact:true}).waitFor();assert.equal(await input.inputValue(),'기존 영상 제목');assert.equal(saved,0);
 const screenshot=out+'/generation-'+width+'.png';await wrap.screenshot({path:screenshot});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile horizontal overflow');
 for(const button of await wrap.getByRole('button').all()){const box=await button.boundingBox();assert(box.width>=44&&box.height>=44,'minimum touch area');}
 await wrap.getByRole('button',{name:'초안 적용',exact:true}).click();assert.equal(await input.inputValue(),'새 영상 제목 초안');assert.equal(saved,0);
 // Network retry uses the exact request identity; status feedback stays next to its button.
 await input.fill('네트워크 검증 초안');mode='network';await ai.click();await wrap.getByText(/네트워크 연결/).waitFor();await ai.click();await page.waitForFunction(()=>!document.querySelector('#noa-edit-youtubeTitle')?.parentElement.querySelector('.noa-edit-ai')?.disabled);assert.equal(posts.at(-1).requestId,posts.at(-2).requestId);assert.equal(await input.inputValue(),'네트워크 검증 초안');
 mode='pending';await ai.click();await page.waitForFunction(()=>document.querySelector('#noa-edit-youtubeTitle')?.parentElement.textContent.includes('작성 중'));await input.fill('내가 직접 바꾼 제목');pending();await wrap.getByRole('button',{name:'초안 적용',exact:true}).click();assert.equal(await input.inputValue(),'내가 직접 바꾼 제목');await wrap.getByText(/입력이 바뀌었습니다/).waitFor();
 mode='html';await ai.click();await wrap.getByText(/AI 응답을 확인하지 못했습니다/).waitFor();assert.equal(await input.inputValue(),'내가 직접 바꾼 제목');assert.equal(saved,0);
 await page.getByRole('button',{name:'정보 수정 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.noa-edit-status')?.textContent==='저장했습니다.');assert.equal(saved,1);assert.equal(fields.youtubeTitle,'내가 직접 바꾼 제목');assert.deepEqual(errors,[]);
 report.push({width,phase,unconfiguredVisible:true,doubleClickOneRequest:true,previewBeforeApply:true,noAutomaticSave:true,typingPreserved:true,stableRetryIdentity:true,htmlErrorVisible:true,explicitSave:true,touchTargets:true,overflow:false,screenshot});await context.close();
}writeFileSync(out+'/generation-report.json',JSON.stringify(report,null,2));console.log('P0_GENERATION_BROWSER_OK',JSON.stringify(report));}finally{await browser.close();}
