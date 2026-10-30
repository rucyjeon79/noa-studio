import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:8077',url=base+'/noa-bridge/engagement.php',out='engagement-proof';mkdirSync(out,{recursive:true});mkdirSync('/workspace/screenshots',{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8077','-t','/tmp/noa-community-fixture','/tmp/noa-community-fixture/router.php'],{stdio:'ignore'});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']});const report={api:[],layouts:[]};
try{
 const contexts={};for(const role of ['guest','a','b','temp','admin']){const c=await browser.newContext();await c.addCookies([{name:'qa_role',value:role,url:base}]);contexts[role]=c;}
 for(let i=0;i<50;i++){try{await contexts.a.request.get(base);break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const t={type:'music',key:'fixture-song'},csrf={};
 const get=async(role,query=t)=>{const r=await contexts[role].request.get(url+'?'+new URLSearchParams(query));return {status:r.status(),data:await r.json()};};
 const post=async(role,body,headers={})=>{const r=await contexts[role].request.post(url,{headers:{Origin:base,'X-NOA-CSRF':csrf[role],...headers},data:body});return {status:r.status(),data:await r.json()};};
 assert.equal((await get('guest')).status,401);
 const batch=await get('a',{targets:JSON.stringify([t,{type:'video',key:'abcdefghijk'}])});assert.equal(batch.status,200,JSON.stringify(batch));assert.equal(batch.data.items.length,2);assert(batch.data.items.every(x=>!x.unavailable));
 assert.equal((await get('a',{targets:'{invalid'})).status,400);
 report.api.push('native escaped GET batch decoded and validated');
 for(const role of ['a','b','temp','admin']){const r=await get(role);assert.equal(r.status,200,JSON.stringify(r));csrf[role]=r.data.csrf;}
 assert.equal((await post('a',{...t,action:'like',active:true},{Origin:'https://evil.invalid'})).status,403);
 assert.equal((await post('a',{...t,action:'like',active:true},{'X-NOA-CSRF':'invalid'})).status,403);
 for(const role of ['a','b'])assert.equal((await post(role,{...t,action:'like',active:true})).status,200);
 assert.equal((await post('a',{...t,action:'like',active:true})).data.stats.likes,2);
 const payload={...t,action:'comment',requestId:'22222222-2222-4222-8222-222222222222',body:'<img src=x onerror=alert(1)> 댓글 보존 검증'};
 assert.equal((await post('temp',payload)).status,403);const created=await post('a',payload);assert.equal(created.status,200,JSON.stringify(created));assert.equal((await post('a',payload)).data.stats.comments,1);
 const id=created.data.comments.items[0].id;assert.equal((await post('b',{action:'delete',id})).status,403);assert.equal((await post('a',{...t,action:'like',active:false})).data.stats.likes,1);
 assert.equal((await post('a',{action:'delete',id})).status,200);assert.equal((await get('a')).data.stats.comments,0);
 for(const target of [{type:'music',key:'catalog:'+'b'.repeat(64)},{type:'board',key:'free:7'},{type:'board',key:'song_request:1'},{type:'board',key:'grouponly:1'}])assert.equal((await get('a',target)).status,404);
 assert.equal((await get('a',{type:'video',key:'abcdefghijk'})).status,200);
 const native=await get('b',{type:'board',key:'free:1'});assert.equal(native.data.stats.likes,1);assert(native.data.stats.liked);
 report.api.push('guest denied','CSRF and origin denied','idempotent likes/comments','unlike decrements','owner-only deletion','private/restricted denied','native likes preserved','music/video resolved');
 const page=await contexts.a.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/engagement-test.php');
 const widget=page.locator('.noa-inline-song-row>.noa-engagement');await widget.getByRole('button',{name:'댓글 0',exact:true}).waitFor();await widget.getByRole('button',{name:'댓글 0',exact:true}).click();
 await page.getByLabel('댓글 남기기').fill('모바일에서 남기는 댓글입니다.');await page.getByRole('button',{name:'댓글 등록',exact:true}).click();await page.locator('.noa-comment p').filter({hasText:'모바일에서 남기는 댓글입니다.'}).waitFor();
 for(const width of [390,1280])for(const theme of ['dark','light']){await page.setViewportSize({width,height:850});await page.evaluate(theme=>{const s=document.documentElement.style;for(const [k,v]of Object.entries(theme==='light'?{'--noa-bg':'#faf8f3','--noa-raised':'#ffffff','--noa-text':'#29251f','--noa-muted':'#615b50','--noa-line':'#c8c0b0','--noa-accent':'#70511d'}:{'--noa-bg':'#17191c','--noa-raised':'#25282d','--noa-text':'#efefef','--noa-muted':'#bcbcbc','--noa-line':'#555','--noa-accent':'#e2c57d'}))s.setProperty(k,v);},theme);const dims=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,dialogOverflow:document.querySelector('dialog').scrollWidth>document.querySelector('dialog').clientWidth,targets:[...document.querySelectorAll('dialog button')].filter(b=>b.getBoundingClientRect().height>0).every(b=>b.getBoundingClientRect().height>=44)}));assert(!dims.overflow&&!dims.dialogOverflow&&dims.targets,JSON.stringify(dims));const file=`engagement-${width}-${theme}.png`;await page.screenshot({path:'/workspace/screenshots/'+file});await page.screenshot({path:out+'/'+file});report.layouts.push({width,theme,...dims});}
 await page.getByRole('button',{name:'삭제',exact:true}).click();await page.getByRole('button',{name:'삭제 확인',exact:true}).click();await page.getByText('아직 댓글이 없습니다. 첫 이야기를 남겨 주세요.').waitFor();await page.getByRole('button',{name:'닫기',exact:true}).click();await widget.getByRole('button',{name:'댓글 0',exact:true}).waitFor();assert.equal(errors.length,0,errors.join('\n'));
 // Compact controls remain on one line and overflow actions invoke their original handlers.
 await widget.getByRole('button',{name:'좋아요 1',exact:true}).waitFor();
 for(const width of [320,390,1280])for(const theme of ['dark','light']){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>{document.documentElement.dataset.noaTheme=theme==='light'?'noa-ivory':'noa-studio';const s=document.documentElement.style;for(const [k,v]of Object.entries(theme==='light'?{'--noa-bg':'#faf8f3','--noa-raised':'#ffffff','--noa-text':'#29251f','--noa-muted':'#615b50','--noa-line':'#c8c0b0'}:{'--noa-bg':'#17191c','--noa-raised':'#25282d','--noa-text':'#efefef','--noa-muted':'#bcbcbc','--noa-line':'#555'}))s.setProperty(k,v);},theme);
  // ResizeObserver schedules the shared card layout on the next animation frame.
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const dims=await page.evaluate(()=>{const row=document.querySelector('.noa-inline-song-row'),social=row.querySelector('.noa-engagement'),buttons=[...social.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return {overflow:document.documentElement.scrollWidth>innerWidth,rowHeight:row.getBoundingClientRect().height,sameLine:buttons[0].y===buttons[1].y,targets:buttons.every(b=>b.width>=44&&b.height>=44),cardOverflow:[...document.querySelectorAll('.noa-engagement-card')].filter(c=>c.scrollWidth>c.clientWidth).map(c=>({width:c.clientWidth,scroll:c.scrollWidth,children:[...c.querySelectorAll('*')].filter(n=>n.scrollWidth>n.clientWidth||n.getBoundingClientRect().right>c.getBoundingClientRect().right+1).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,80),width:n.clientWidth,scroll:n.scrollWidth}))})),cards:[...document.querySelectorAll('.noa-engagement-card')].every(c=>c.scrollWidth<=c.clientWidth)};});assert(!dims.overflow&&dims.sameLine&&dims.targets&&dims.cards&&dims.rowHeight<140,JSON.stringify({width,...dims}));
  await page.screenshot({path:out+`/compact-${width}-${theme}.png`});report.layouts.push({width,theme,...dims});
 }
 const precision=await page.locator('.noa-engagement-card>.noa-music-card').first().evaluate(e=>({border:getComputedStyle(e).borderWidth,display:getComputedStyle(e).display}));assert.equal(precision.border,'0px');assert.equal(precision.display,'block');
 const guestPage=await contexts.guest.newPage();await guestPage.goto(base+'/engagement-test.php');await guestPage.locator('.noa-engagement a.noa-action').first().waitFor();const guestFooter=await guestPage.locator('.noa-engagement a.noa-action').first().evaluate(e=>({border:getComputedStyle(e).borderWidth,height:e.getBoundingClientRect().height,direction:getComputedStyle(e).flexDirection}));assert.equal(guestFooter.border,'0px');assert.equal(guestFooter.height,44);assert.equal(guestFooter.direction,'row');await guestPage.close();
 await page.setViewportSize({width:390,height:850});
 await page.getByRole('button',{name:'EP.1 · 하루의 끝에 더보기',exact:true}).click();await page.locator('.noa-song-menu').getByRole('button',{name:'담기',exact:true}).click();assert.equal(await page.locator('.noa-song-actions [aria-label="하루의 끝에 담기"]').getAttribute('data-used'),'true');
 await page.getByRole('button',{name:'EP.1 · 하루의 끝에 더보기',exact:true}).click();await page.locator('.noa-song-menu').getByRole('button',{name:'수정',exact:true}).click();assert.equal(await page.locator('.noa-inline-song-row>.noa-edit-edit').getAttribute('data-used'),'true');
 report.api.push('compact 44px controls and original more-menu handlers');
 // Production hosting replaces error JSON with an HTML error document.
 await page.route('**/noa-bridge/engagement.php?*',route=>route.fulfill({status:401,contentType:'text/html',body:'<!doctype html><title>401 Unauthorized</title>'}));
 await widget.getByRole('button',{name:'댓글 0',exact:true}).click();await page.locator('dialog').getByText('로그인 후 이용해 주세요.',{exact:true}).waitFor();report.api.push('host HTML 401 gives login guidance');assert.equal(errors.length,0,errors.join('\n'));
 writeFileSync(out+'/qa.json',JSON.stringify(report,null,2));console.log('ENGAGEMENT_API_UI_PASS',JSON.stringify(report));
}finally{await browser.close();server.kill();}
