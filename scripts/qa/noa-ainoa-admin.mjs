// Deployed UI + isolated API responses. Native SQL/HTTP tests separately verify real authorization.
import {chromium} from 'playwright';import assert from 'node:assert/strict';import {mkdirSync,writeFileSync} from 'node:fs';
const phase=process.env.NOA_AINOA_PHASE||'candidate',out='ainoa-proof/'+phase;mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report=[];
try{for(const width of [360,390,430])for(const theme of ['noa-studio','noa-ivory']){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'}),page=await context.newPage();let admin=false,ready=true,pending=null,runs=0,creates=0,posts=[],tasks=[],loseNext=false,saves=0;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
 if(phase==='candidate')await context.route(/\/noa-ainoa(?:-admin)?\.(js|css)(\?.*)?$/,r=>r.fulfill({path:'deploy/'+new URL(r.request().url()).pathname.slice(1),contentType:r.request().url().includes('.css')?'text/css':'text/javascript'}));
 await context.route('**/noa-ainoa.php*',async route=>{
  const q=route.request(),u=new URL(q.url()),generation={ready,model:'fixture-model',missing:ready?[]:['api_key']};
  if(q.method()==='GET')return route.fulfill({json:u.searchParams.get('action')==='admin_workspace'?{ok:true,csrf:'fixture',generation,tasks:structuredClone(tasks)}:{ok:true,csrf:'fixture',admin,adminAssistant:admin,adminAssistantVersion:'fixture',generation}});
  const b=q.postDataJSON();posts.push(b);if(!admin)return route.fulfill({status:403,json:{ok:false,error:'admin_required'}});
  if(['admin_chat','admin_generate'].includes(b.action)){
   let task=tasks.find(t=>t.requestId===b.requestId);if(!task){creates++;task={id:'n80:ai:fixture-'+creates,requestId:b.requestId,type:b.action==='admin_chat'?'chat':'generate',conversationId:b.conversationId,question:b.question,field:b.field,title:b.question||'검증 곡',state:'queued',revision:1,stage:'실행 대기',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};tasks.unshift(task);}
   if(loseNext){loseNext=false;return route.abort('failed');}return route.fulfill({json:{ok:true,task:structuredClone(task),generation}});
  }
  const task=tasks.find(t=>t.id===b.taskId);assert(task);
  if(b.action==='admin_run'){runs++;if(pending!==false)await new Promise(resolve=>pending=resolve);task.state=task.type==='chat'?'succeeded':'review';task.result='검토용 응답 <img src=x onerror=alert(1)>';task.stage='응답 보관';task.revision++;}
  if(b.action==='admin_cancel'){task.state='cancelled';task.stage='요청 취소';task.revision++;}
  return route.fulfill({json:{ok:true,task:structuredClone(task),generation}});
 });
 await context.route('**/noa-inline-edit.php*',r=>{if(r.request().method()==='POST')saves++;return r.fulfill({json:{ok:true,revision:1,fields:{title:'검증 곡'}}});});
 await page.goto('https://noastudio.ai.kr/',{waitUntil:'domcontentloaded'});await page.locator('.ainoa-symbol').click();await page.waitForFunction(()=>document.querySelector('.ainoa-note')?.textContent.includes('검색'));assert(await page.locator('.ainoa-admin-toggle').isHidden());
 admin=true;await page.locator('.ainoa-close').click();await page.locator('.ainoa-symbol').click();await page.locator('.ainoa-admin-toggle').waitFor({state:'visible'});await page.locator('.ainoa-admin-toggle').click();const modal=page.locator('#ainoa-admin-dialog');await modal.getByText('관리자 대화와 생성 초안은 계정별로 보관됩니다.',{exact:true}).waitFor();
 await page.evaluate(()=>dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{key:'single:kpop-original:01',title:'검증 곡'}}})));await modal.getByRole('button',{name:'새로고침',exact:true}).click();await modal.getByText('선택한 곡 포함 · 검증 곡',{exact:true}).waitFor();
 await modal.getByRole('textbox',{name:'관리자 ChatGPT 질문'}).fill('선택한 곡에 어울리는 소개를 만들어 줘');await modal.getByRole('button',{name:'보내기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ainoa-admin-notice')?.textContent.includes('처리하고'));
 assert(await modal.getByRole('button',{name:'보내기',exact:true}).isDisabled());assert.equal(creates,1);assert.equal(posts.find(p=>p.action==='admin_chat').trackKey,'single:kpop-original:01');pending();pending=false;await modal.locator('.ainoa-admin-log').getByText('검토용 응답 <img src=x onerror=alert(1)>',{exact:true}).waitFor();assert.equal(await modal.locator('.ainoa-admin-log img').count(),0);
 await modal.getByRole('button',{name:'닫기',exact:true}).click();await page.locator('.ainoa-symbol').click();await page.locator('.ainoa-admin-toggle').click();await modal.locator('.ainoa-admin-log').getByText('선택한 곡에 어울리는 소개를 만들어 줘',{exact:true}).waitFor();
 // Save succeeded but the HTTP reply was lost: same request ID reconciles it without another task.
 loseNext=true;await modal.getByRole('textbox',{name:'관리자 ChatGPT 질문'}).fill('연결 복귀 확인');await modal.getByRole('button',{name:'보내기',exact:true}).click();await modal.getByText(/같은 요청으로 확인합니다/).waitFor();const first=posts.at(-1).requestId;await modal.getByRole('button',{name:'보내기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.ainoa-admin-log')?.textContent.includes('연결 복귀 확인')&&!document.querySelector('.ainoa-admin-send')?.disabled);assert.equal(posts.filter(p=>p.action==='admin_chat').at(-1).requestId,first);assert.equal(creates,2);
 await modal.getByText('선택한 곡 AI 생성 자동화',{exact:true}).click();await modal.getByRole('button',{name:'초안 자동 생성',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('.ainoa-admin-generate')?.disabled);assert.equal(tasks.find(t=>t.type==='generate').state,'review');assert.equal(saves,0);
 // Missing credentials preserve a pending instruction and expose cancellation without paid calls.
 ready=false;await modal.getByRole('button',{name:'새 대화',exact:true}).click();await modal.getByRole('button',{name:'새로고침',exact:true}).click();await modal.getByText('연결 설정 필요 · API 키',{exact:true}).waitFor();const beforeRuns=runs;
 await modal.getByRole('textbox',{name:'관리자 ChatGPT 질문'}).fill('연결 후 처리할 제작 요청');await modal.getByRole('button',{name:'보내기',exact:true}).click();await modal.getByText('요청은 저장됐습니다. AI 연결 설정 후 처리합니다.',{exact:true}).waitFor();assert.equal(runs,beforeRuns);
 await modal.getByText('ChatGPT 구독 한도 연결',{exact:true}).click();assert(await modal.getByText(/현재 연결되지 않았습니다/).isVisible());
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));const box=await modal.boundingBox();assert(box.x>=0&&box.x+box.width<=width+1&&box.y>=0&&box.height<=844);
 for(const b of await modal.getByRole('button').all()){if(!await b.isVisible())continue;const rect=await b.boundingBox();assert(rect.width>=44&&rect.height>=44);}
 const screenshot=out+'/admin-'+theme+'-'+width+'.png';await page.screenshot({path:screenshot});assert.deepEqual(errors,[]);report.push({width,theme,phase,guestHidden:true,highestAdminDialog:true,storedConversation:true,selectedSongContext:true,networkRetrySameIdentity:true,noDuplicateTask:true,draftNotSaved:true,unconfiguredQueuePreserved:true,subscriptionNotFalselyConnected:true,safeTextRendering:true,touchTargets:true,noOverflow:true,screenshot});await context.close();
}writeFileSync(out+'/admin-report.json',JSON.stringify(report,null,2));console.log('N80_ADMIN_DIALOG_BROWSER_OK',report.length);}finally{await browser.close();}
