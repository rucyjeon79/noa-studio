import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHmac,randomBytes,createECDH} from 'node:crypto';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8078',api=base+'/noa-bridge/notifications.php',out='notifications-proof';mkdirSync(out,{recursive:true});mkdirSync('/workspace/screenshots',{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8078','-t','/tmp/noa-community-fixture','/tmp/noa-community-fixture/router.php'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report={api:[],layouts:[],phoneDelivery:'not claimed; physical device opt-in required'};
try{
 const contexts={};for(const role of ['guest','a','b','admin']){const c=await browser.newContext();await c.addCookies([{name:'qa_role',value:role,url:base}]);contexts[role]=c;}
 for(let i=0;i<50;i++){try{await contexts.a.request.get(base+'/noa-notifications.php');break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const csrf={};const get=async role=>{const r=await contexts[role].request.get(api);return {status:r.status(),data:await r.json()};};
 const post=async(role,data,headers={})=>{const r=await contexts[role].request.post(api,{headers:{Origin:base,'X-NOA-CSRF':csrf[role],...headers},data});return {status:r.status(),data:await r.json()};};
 assert.equal((await get('guest')).status,401);
 for(const role of ['a','b','admin']){const result=await get(role);assert.equal(result.status,200,JSON.stringify(result));csrf[role]=result.data.csrf;assert(!JSON.stringify(result.data).includes('privateKey'));}
 assert.equal((await post('a',{action:'read',id:1},{Origin:'https://evil.invalid'})).status,403);
 assert.equal((await post('a',{action:'read',id:1},{'X-NOA-CSRF':'bad'})).status,403);
 const ecdh=createECDH('prime256v1');ecdh.generateKeys();const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/browser-fixture',keys:{p256dh:ecdh.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
 assert.equal((await post('a',{action:'subscribe',subscription:{...subscription,endpoint:'https://127.0.0.1/push'}})).status,400);
 const registered=await post('a',{action:'subscribe',subscription});assert.equal(registered.status,200,JSON.stringify(registered));const device=registered.data.device;
 assert.equal((await post('b',{action:'test',device})).status,400);
 assert.equal((await post('a',{action:'test',device})).status,200);
 const own=await get('a'),other=await get('b');assert(own.data.items.some(i=>i.text.includes('알림이 연결')));assert(!other.data.items.some(i=>i.text.includes('알림이 연결')));
 const testId=own.data.items.find(i=>i.text.includes('알림이 연결')).id;await post('b',{action:'read',id:testId});assert(!(await get('a')).data.items.find(i=>i.id===testId).read);
 async function worker(data,headers={}){const raw=JSON.stringify(data),time=String(Math.floor(Date.now()/1000)),nonce=randomBytes(16).toString('hex');const signed={'Content-Type':'application/json','X-NOA-Time':time,'X-NOA-Nonce':nonce,'X-NOA-Signature':createHmac('sha256','f'.repeat(64)).update(time+'\n'+nonce+'\n'+raw).digest('hex'),...headers};const r=await contexts.guest.request.post(base+'/noa-bridge/notification-worker.php',{headers:signed,data:raw});return {r,raw,signed};}
 assert.equal((await worker({action:'claim'},{'X-NOA-Signature':'0'.repeat(64)})).r.status(),404);
 const claim=await worker({action:'claim'});assert.equal(claim.r.status(),200);const claimed=await claim.r.json();assert.equal(claimed.jobs.length,1);const job=claimed.jobs[0];assert.equal(job.id,testId);
 const replay=await contexts.guest.request.post(base+'/noa-bridge/notification-worker.php',{headers:claim.signed,data:claim.raw});assert.equal(replay.status(),409);
 assert.equal((await (await worker({action:'claim'})).r.json()).jobs.length,0);
 await worker({action:'ack',results:[{id:job.id,device:job.device,lease:job.lease,http:201}]});
 const receipt=await contexts.guest.request.post(api+'?receipt=1',{headers:{Origin:base},data:{id:job.id,receipt:job.payload.receipt}});assert.equal(receipt.status(),200);
 assert.equal((await get('a')).data.testStatus.received,1);
 report.api.push('guest denied','CSRF and origin denied','own inbox only','device endpoint allowlist','owner-only test and read','worker HMAC and replay protection','exclusive queue lease','provider acceptance separated from browser receipt');
 // UI-only browser capability adapter; no real push subscription or phone receipt is claimed.
 const ui=await browser.newContext();await ui.addCookies([{name:'qa_role',value:'a',url:base}]);
 await ui.addInitScript(({subscription})=>{
  let active=null;window.qaPermissionPrompts=0;
  class FixtureNotification{static permission='default';static async requestPermission(){window.qaPermissionPrompts++;this.permission='granted';return 'granted';}}
  window.Notification=FixtureNotification;window.PushManager=class{};
  const sub=()=>({...subscription,toJSON:()=>subscription,unsubscribe:async()=>{active=null;return true;}});const registration={pushManager:{getSubscription:async()=>active,subscribe:async()=>active=sub()}};
  Object.defineProperty(navigator,'serviceWorker',{value:{getRegistration:async()=>registration,register:async()=>registration,ready:Promise.resolve(registration)}});
 },{subscription:{...subscription,endpoint:subscription.endpoint+'-ui'}});
 const page=await ui.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/noa-notifications.php');await page.getByText('내 소식은 나에게만 보여요.',{exact:true}).waitFor();await page.getByRole('heading',{name:'내 활동 알림',exact:true}).waitFor();assert(!(await page.locator('body').innerText()).includes('휴대폰 알림'));assert.equal(await page.evaluate(()=>qaPermissionPrompts),0);
 const inbox=(await get('a')).data;let inlineNotice=null;
 for(const item of inbox.items){const r=await contexts.a.request.get(api+'?thread='+item.id);if(r.ok()){const d=await r.json();if(d.thread.replyTo?.body==='알림에서 답할 원래 댓글'){inlineNotice=item;break;}}}
 assert(inlineNotice,'real comment notification exists');assert.equal(inlineNotice.boardTitle,'자유게시판');assert.equal(inlineNotice.postTitle,'자유게시판 제목 1');assert(inlineNotice.excerpt.includes('자유게시판 본문 1'));assert(!inlineNotice.excerpt.includes('unsafe'));await page.locator('#nnt-item-'+inlineNotice.id).getByText('자유게시판 제목 1',{exact:true}).waitFor();
 const denied=await contexts.b.request.get(api+'?thread='+inlineNotice.id);assert.equal(denied.status(),400);
 const locationBefore=page.url();await page.locator('#nnt-item-'+inlineNotice.id).click();
 const dialog=page.locator('dialog.noa-comments');await dialog.getByLabel('별무리 B님에게 답댓글',{exact:true}).waitFor();await dialog.locator('.noa-comment-post').getByText('별무리 A',{exact:true}).waitFor();await dialog.locator('.noa-comment-post').getByText('자유게시판',{exact:true}).waitFor();assert.equal(page.url(),locationBefore);
 await dialog.getByLabel('별무리 B님에게 답댓글',{exact:true}).fill('알림함 안에서 작성한 답댓글');await dialog.getByRole('button',{name:'답댓글 등록',exact:true}).click();
 const replyRow=dialog.locator('.noa-comment').filter({has:page.locator('p',{hasText:'알림함 안에서 작성한 답댓글'})});await replyRow.waitFor();await replyRow.getByText('별무리 B님에게 답댓글',{exact:true}).waitFor();await replyRow.getByRole('button',{name:'답댓글',exact:true}).click();await dialog.getByLabel('별무리 A님에게 답댓글',{exact:true}).fill('알림에서 대댓글까지 등록 확인');await dialog.getByRole('button',{name:'답댓글 등록',exact:true}).click();await dialog.locator('.noa-comment>p').filter({hasText:'알림에서 대댓글까지 등록 확인'}).waitFor();assert.equal(page.url(),locationBefore);
 for(const width of [390,1280]){await page.setViewportSize({width,height:900});assert(await dialog.evaluate(e=>e.scrollWidth<=e.clientWidth));await page.screenshot({path:out+`/inline-reply-${width}.png`});}
 await dialog.getByRole('button',{name:'닫기',exact:true}).click();await page.reload();await page.locator('#nnt-item-'+inlineNotice.id).click();await page.locator('dialog .noa-comment>p').filter({hasText:'알림함 안에서 작성한 답댓글'}).waitFor();
 await page.locator('dialog').getByRole('button',{name:'답댓글 취소',exact:true}).click();await page.getByLabel('댓글 남기기',{exact:true}).fill('알림함 안에서 작성한 일반 댓글');await page.locator('dialog').getByRole('button',{name:'댓글 등록',exact:true}).click();await page.locator('dialog .noa-comment>p').filter({hasText:'알림함 안에서 작성한 일반 댓글'}).waitFor();await page.locator('dialog').getByRole('button',{name:'닫기',exact:true}).click();assert.equal(page.url(),locationBefore);
 report.api.push('owned thread only','inline preview author','reply persisted after reload','inline top-level comment','no navigation from inbox');
 // Category filtering is server-side and confirmation is reversible without opening a post.
 const filters=page.locator('#nnt-filters');await filters.getByRole('button',{name:/댓글·답글/}).click();await page.locator('#nnt-filter-status').getByText(/댓글·답글 소식/).waitFor();
 assert((await page.locator('#nnt-list li').evaluateAll(rows=>rows.map(x=>x.dataset.kind))).every(k=>['comment','reply','request_reply'].includes(k)));
 const first=page.locator('#nnt-list li').first(),itemId=Number((await first.locator('.nnt-item').getAttribute('id')).replace('nnt-item-',''));
 if(await first.getByRole('button',{name:/확인 처리/}).count()){await first.getByRole('button',{name:/확인 처리/}).click();await page.locator('#nnt-item-'+itemId).locator('..').getByRole('button',{name:/미확인으로/}).waitFor();}
 await page.locator('#nnt-item-'+itemId).locator('..').getByRole('button',{name:/미확인으로/}).click();await page.locator('#nnt-item-'+itemId).locator('..').getByRole('button',{name:/확인 처리/}).waitFor();
 await filters.getByRole('button',{name:/미확인/}).click();await page.locator('#nnt-filter-status').getByText(/미확인 소식/).waitFor();assert((await page.locator('#nnt-list .nnt-item').evaluateAll(rows=>rows.map(x=>x.dataset.read))).every(x=>x==='false'));
 await filters.getByRole('button',{name:/반응/}).click();await page.locator('#nnt-filter-status').getByText(/반응 소식/).waitFor();assert((await page.locator('#nnt-list li').evaluateAll(rows=>rows.map(x=>x.dataset.kind))).every(k=>k==='like'));
 await filters.getByRole('button',{name:/전체/}).click();await page.locator('#nnt-filter-status').getByText(/전체 소식/).waitFor();
 report.api.push('server category filters','reversible individual read state','unread filter','category navigation without post navigation');

 await page.getByRole('button',{name:'알림 켜기',exact:true}).click();await page.getByText('이 기기로 AInoa의 알림을 받을 수 있어요.',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>qaPermissionPrompts),1);
 await page.getByRole('button',{name:'테스트 알림 받기',exact:true}).click();await page.getByText('테스트 알림은 이 기기에만 보냅니다.',{exact:true}).waitFor();const secondTest=(await get('a')).data.testStatus;assert.notEqual(secondTest.id,testId);assert.equal(secondTest.received,0);assert.equal(secondTest.state,'pending');
 await page.getByLabel('내 게시물의 좋아요',{exact:true}).uncheck();await page.getByRole('button',{name:'알림 종류 저장'}).click();await page.getByText('받을 알림 종류를 저장했어요.',{exact:true}).waitFor();assert.equal((await get('a')).data.preferences.likes,false);
 const setTheme=async theme=>{await page.evaluate(theme=>{for(const [k,v] of Object.entries(theme==='light'?{'--noa-bg':'#faf8f3','--noa-surface':'#ffffff','--noa-raised':'#ffffff','--noa-text':'#29251f','--noa-muted':'#615b50','--noa-line':'#c8c0b0','--noa-accent':'#70511d'}:{'--noa-bg':'#17191c','--noa-surface':'#202329','--noa-raised':'#25282d','--noa-text':'#efefef','--noa-muted':'#bcbcbc','--noa-line':'#555','--noa-accent':'#e2c57d'}))document.documentElement.style.setProperty(k,v);},theme);};
 for(const width of [390,1280])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:900});await setTheme(theme);
  const dims=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,targets:[...document.querySelectorAll('#noa-notification-page button')].filter(b=>b.getBoundingClientRect().height>0).every(b=>b.getBoundingClientRect().height>=44)}));assert(!dims.overflow&&dims.targets,JSON.stringify(dims));const name=`notifications-${width}-${theme}.png`;await page.screenshot({path:'/workspace/screenshots/'+name,fullPage:true});await page.screenshot({path:out+'/'+name,fullPage:true});report.layouts.push({width,theme,...dims});
 }
 await page.getByRole('button',{name:'이 기기 알림 끄기',exact:true}).click();await page.getByText('이 기기 알림을 껐어요. 알림함에서는 계속 확인할 수 있어요.',{exact:true}).waitFor();assert(!(await get('a')).data.devices.includes(await page.evaluate(async endpoint=>{const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(endpoint));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');},subscription.endpoint+'-ui')));
 await page.goto(base+'/notification-shell.php');await page.locator('.ainoa-symbol').click();await page.locator('.ainoa-panel-body').waitFor();assert.equal(await page.locator('#noa-ainoa .nnt-entry,#noa-ainoa>.nnt-badge').count(),0);
 await page.goto(base+'/noa-my.php');await page.locator('#noa-my-activity .nnt-entry').waitFor();
 assert.equal(await page.locator('#noa-my-account .noa-level-line').count(),1);assert.equal(await page.getByRole('heading',{name:'나의 회원 등급'}).count(),0);
 assert(await page.evaluate(()=>!!(document.querySelector('#noa-my-activity').compareDocumentPosition(document.querySelector('#my-recent'))&Node.DOCUMENT_POSITION_FOLLOWING)));
 for(const width of [390,1280])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:900});await setTheme(theme);
  const entry=page.locator('#noa-my-activity>.nnt-entry');const dims=await entry.evaluate(el=>({overflow:el.scrollWidth>el.clientWidth,height:el.getBoundingClientRect().height}));assert(!dims.overflow&&dims.height>=44,JSON.stringify(dims));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const name=`my-activity-${width}-${theme}.png`;await page.screenshot({path:'/workspace/screenshots/'+name,fullPage:true});await page.screenshot({path:out+'/'+name,fullPage:true});report.layouts.push({surface:'MY activity',viewport:width,theme,...dims});
 }
 await page.getByRole('link',{name:/도착한 소식/}).click();await page.getByRole('heading',{name:'내 활동 알림',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/새 글/}).count(),0);
 const adminPage=await contexts.admin.newPage();await adminPage.goto(base+'/noa-notifications.php');await adminPage.locator('#nnt-content').waitFor();await adminPage.locator('#nnt-filters').getByRole('button',{name:/새 글/}).click();await adminPage.getByText(/새 글 소식 2개/).waitFor();assert.equal(await adminPage.locator('#nnt-list li').count(),2);
 const adminData=(await get('admin')).data;const publicPost=adminData.items.find(x=>x.kind==='new_post'&&x.url.includes('bo_table=free'));
 await adminPage.locator('#nnt-item-'+publicPost.id).click();await adminPage.locator('dialog.noa-comments').waitFor();assert.equal(adminPage.url(),base+'/noa-notifications.php');await adminPage.close();
 assert.equal(errors.length,0,errors.join('\n'));
 await page.route('**/noa-bridge/notifications.php?*',route=>route.fulfill({status:401,contentType:'text/html',body:'<!doctype html><title>Unauthorized</title>'}));await page.reload();await page.locator('#nnt-login').getByRole('link',{name:'로그인',exact:true}).waitFor();
 report.api.push('explicit user gesture permission only','subscribe and revoke UI','preferences persisted','MY activity navigation and integrated membership','no AInoa inbox entry','administrator-only new posts','host HTML 401 login recovery');
 writeFileSync(out+'/qa.json',JSON.stringify(report,null,2));console.log('NOTIFICATION_API_UI_PASS',JSON.stringify(report));
}finally{await browser.close();server.kill();}
