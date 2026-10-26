import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8076',api=base+'/noa-bridge/community.php',out='community-proof';mkdirSync(out,{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8076','-t','/tmp/noa-community-fixture','/tmp/noa-community-fixture/router.php'],{stdio:'ignore'}),browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']}),report={environment:'isolated MySQL and native-auth interface fixture; no production identities',api:[],browser:[]};
const sentinel='PRIVATE_REQUEST_SENTINEL: 작성자 외에는 내려오면 안 되는 사연',password='fixture-password-only';
try{
 const probe=await browser.newContext();let ready=false;for(let i=0;i<50&&!ready;i++){try{ready=(await probe.request.get(api)).status()===401;}catch{}if(!ready)await new Promise(r=>setTimeout(r,100));}assert(ready);await probe.close();
 const clients={};for(const role of ['guest','a','b','temp','staff','admin']){const c=await browser.newContext();await c.addCookies([{name:'qa_role',value:role,url:base}]);clients[role]=c;}
 const get=async(role,query)=>{const r=await clients[role].request.get(api+'?'+new URLSearchParams(query));return{status:r.status(),data:await r.json(),headers:r.headers()};};
 const csrf={};for(const role of ['a','b','temp','staff','admin']){const r=await get(role,{board:'song_request'});assert.equal(r.status,200);csrf[role]=r.data.csrf;assert(r.headers['cache-control'].includes('no-store'));}
 assert.equal((await get('guest',{board:'song_request'})).status,401);
 const post=async(role,data,token=csrf[role],origin=base)=>{const r=await clients[role].request.post(api,{headers:{'X-NOA-CSRF':token||'',Origin:origin},data});return{status:r.status(),data:await r.json()};};
 const payload={action:'create',title:'비공개 사연 테스트',name:'신청자',body:sentinel,password,requestId:'11111111-1111-4111-8111-111111111111'};
 assert.equal((await post('a',payload,'')).status,403);assert.equal((await post('a',payload,csrf.a,'https://other.example')).status,403);assert.equal((await post('temp',payload)).status,403);
 const created=await post('a',payload);assert.equal(created.status,200);const id=created.data.id;assert(id>0);const replay=await post('a',payload);assert.equal(replay.data.id,id);assert.equal(replay.data.created,false);
 assert.equal((await post('a',{...payload,title:'changed'})).data.error,'request_conflict');
 for(const role of ['a','b','staff','temp']){const r=await get(role,{board:'song_request',action:'read',id});assert(r.data.locked);assert(!JSON.stringify(r).includes(sentinel));assert(!JSON.stringify(r).includes(password));}
 assert.equal((await post('b',{action:'unlock',id,password})).status,403);assert.equal((await post('staff',{action:'unlock',id,password})).status,403);
 const wrong=await post('a',{action:'unlock',id,password:'incorrect'});assert.equal(wrong.status,403);assert(!JSON.stringify(wrong).includes(sentinel));
 const opened=await post('a',{action:'unlock',id,password});assert.equal(opened.data.body,sentinel);assert.equal(opened.data.canComment,false);
 assert.equal((await post('a',{action:'comment',id,body:'not allowed',requestId:'22222222-2222-4222-8222-222222222222'})).status,403);
 const admin=await get('admin',{board:'song_request',action:'read',id});assert.equal(admin.data.body,sentinel);assert(admin.data.canComment);
 const comment={action:'comment',id,body:'관리자 답변 확인',requestId:'33333333-3333-4333-8333-333333333333'};assert.equal((await post('admin',comment)).data.comments.length,1);assert.equal((await post('admin',comment)).data.comments.length,1);
 assert.equal((await post('a',{action:'unlock',id,password})).data.comments[0].body,'관리자 답변 확인');
 const titles=await get('b',{board:'song_request'});assert.equal(titles.data.items.length,1);assert.deepEqual(Object.keys(titles.data.items[0]).sort(),['id','title']);assert(!JSON.stringify(titles).includes(sentinel));
 for(let n=0;n<6;n++)var limited=await post('b',{action:'unlock',id,password:'bad'});assert.equal(limited.status,429);
 for(const role of ['guest','a','staff'])for(const path of ['/bbs/board.php?bo_table=song_request&wr_id='+id,'/bbs/password_check.php?bo_table=song_request&wr_id='+id,'/bbs/write_comment_update.php?bo_table=song_request&wr_id='+id,'/bbs/download.php?bo_table=song_request&wr_id='+id,'/bbs/rss.php?bo_table=song_request','/song_request/'+id]){const r=await clients[role].request.get(base+path);assert.equal(r.status(),403);assert(!(await r.text()).includes('NATIVE_PRIVATE_BODY_SENTINEL'));}
 const free=await get('a',{board:'free'});assert.equal(free.data.items.length,5);assert(free.data.more);assert(!free.data.items.some(r=>r.id===7));assert(!JSON.stringify(free).includes('본문'));assert.equal((await get('a',{board:'free',action:'read',id:7})).data.error,'post_not_available');
 report.api.push({ownerNeedsPassword:true,otherAccountWithCorrectPasswordDenied:true,staffLevelTenIsNotAdmin:true,adminOnlyComments:true,csrfAndOriginEnforced:true,passwordRateLimit:true,nativeAndPrettyRoutesDenied:true,noBodyInLists:true,replayCreatesOnePostAndOneComment:true});
 // Create enough owned rows to verify five-title pagination and expansion in the actual UI.
 for(let n=2;n<=5;n++)assert.equal((await post('admin',{...payload,title:'관리자 시험 신청 '+n,requestId:String(n).repeat(8)+'-4444-4444-8444-444444444444'})).status,200);
 for(const width of [320,390,1280])for(const theme of ['noa-studio','noa-ivory'])for(const pageName of ['youtube','music']){
  const c=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});await c.addCookies([{name:'qa_role',value:'admin',url:base}]);await c.addInitScript(theme=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme,language:'ko',radius:'soft',design:'ios'})),theme);
  const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base+'/noa-'+pageName+'.php');const host=p.locator('[data-noa-community]');await host.locator('.noa-community-post').first().waitFor();assert.equal(await host.locator('.noa-community-post').count(),5);assert(await p.evaluate(()=>document.querySelector('main').lastElementChild.matches('[data-noa-community]')));
  assert((await host.locator('.noa-community-body').allTextContents()).every(value=>value===''));
  const first=host.locator('.noa-community-post').first();await first.locator('summary').click();await first.locator('.noa-community-text').first().waitFor();assert(await p.locator('#noa-disclosure-close').isVisible());
  if(pageName==='music'){assert(await first.locator('textarea').isVisible());assert((await first.textContent()).includes(sentinel));}
  await p.screenshot({path:out+'/'+pageName+'-'+theme+'-'+width+'.png'});await p.locator('#noa-disclosure-close').click();await first.locator('.noa-community-text').first().waitFor({state:'detached'});assert.equal(await first.locator('.noa-community-text').count(),0,'closed panels erase private bodies');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);report.browser.push({width,theme,page:pageName,fiveTitles:true,inlineExpansion:true,floatingClose:true,noOverflow:true,errors});await c.close();
 }
 // Owner password form and ordinary member comment restrictions also run through the shipped UI.
 const ownerPage=await clients.a.newPage();await ownerPage.goto(base+'/noa-music.php');const own=ownerPage.locator('#noa-song_request-'+id);await own.locator('summary').click();await own.getByLabel('글 비밀번호',{exact:true}).fill(password);await own.getByRole('button',{name:'내용 확인',exact:true}).click();await own.locator('.noa-community-text').first().waitFor();assert.equal(await own.locator('textarea').count(),0);assert((await own.textContent()).includes(sentinel));
 assert.equal(report.browser.length,12);
}finally{writeFileSync(out+'/isolated-regression.json',JSON.stringify(report,null,2));await browser.close();server.kill();}
console.log('COMMUNITY_PRIVATE_ACCESS_AND_BROWSER_OK',report.browser.length);
