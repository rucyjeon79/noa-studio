import {chromium} from 'playwright';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync('ui-audit-proof',{recursive:true});
if(process.env.LIVE_ONLY==='1'){
 const results=[];try{for(const width of [390,1280]){const p=await browser.newPage({viewport:{width,height:900}});for(const path of ['/','/noa-lounge.php','/noa-shop.php','/noa-points.php','/noa-vip.php','/noa-youtube.php','/noa-music.php','/noa-world.php','/noa-my.php']){
 await p.goto('https://noastudio.ai.kr'+path,{waitUntil:'domcontentloaded'});if(path==='/noa-lounge.php')await p.locator('.ec-card,.ec-empty').first().waitFor();if(path==='/noa-shop.php')await p.locator('.ec-grid .ec-card').first().waitFor();
 assert(await p.locator('body').innerText());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow '+path+' '+width);
 const nav=p.locator('#noa-section-navigation a');if(await nav.count()){const geometry=await nav.evaluateAll(ns=>ns.map(n=>({padding:parseFloat(getComputedStyle(n).paddingLeft),height:n.getBoundingClientRect().height})));assert(geometry.every(x=>x.padding>=12&&x.height>=44),'nav geometry '+path);}
 if(path==='/noa-lounge.php'){assert.equal(await p.getByRole('button',{name:'이야기 쓰기',exact:true}).count(),1);assert.equal(await p.getByText('등록된 게시판이 없습니다.',{exact:true}).count(),0);}
 if(path==='/noa-shop.php'){assert.equal(await p.locator('#ec-hero-actions a').count(),0);assert(await p.locator('.ec-card .ec-buy').count()>6);if(width===390)assert((await p.locator('.ec-grid .ec-card').first().boundingBox()).y<700,'show products early');}
 results.push({width,path,url:p.url(),cards:await p.locator('.ec-card').count()});await p.screenshot({path:'ui-audit-proof/live-'+(path==='/'?'home':path.slice(1,-4))+'-'+width+'.png'});
 }await p.close();}console.log('LIVE_UI_AUDIT',JSON.stringify(results));}finally{await browser.close();}process.exit(0);
}
const css=['noa-ui','noa-engagement','noa-support','noa-world','noa-ecosystem','noa-starlight'];
try{
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:900}}),p=await context.newPage(),errors=[],sends=[];let balance=7000,sender='member-a',fail=false,receipt=null;
  p.on('pageerror',e=>errors.push(e.message));
  await p.route('http://noa.test/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/noa-bridge/community.php')return route.fulfill({status:401,json:{ok:false,error:'login_required'}});
   if(u.pathname==='/noa-bridge/support.php'){
    const action=u.searchParams.get('action');let data={};
    if(action==='stats')data={items:[{type:'channel',key:'channel-a',available:true,count:4}]};
    if(action==='quote')data={balance,senderKey:sender,csrf:'test',target:{title:'내일도 우리',channelTitle:'람준파파',entity:'channel:channel-a',channelId:'channel-a'}};
    if(action==='receipt')data={senderKey:sender,receipt};
    if(action==='send'){const v=route.request().postDataJSON();sends.push(v);if(fail){return route.fulfill({status:503,json:{ok:false,error:'support_unavailable'}});}receipt={amount:v.amount,balance:balance-v.amount,channelTitle:'람준파파',title:'내일도 우리',count:5};data={receipt};}
    return route.fulfill({json:{ok:true,...data}});
   }
   if(u.pathname.startsWith('/noa-bridge/'))return route.fulfill({json:{ok:true,member:true,level:3,access:{home:true,member:true,music:true},items:[],notifications:[]}});
   if(/\.(css|js)$/.test(u.pathname)&&existsSync('deploy'+u.pathname))return route.fulfill({contentType:u.pathname.endsWith('.css')?'text/css':'application/javascript',body:readFileSync('deploy'+u.pathname)});
   if(/\.(png|webp|jpg)$/.test(u.pathname))return route.fulfill({status:204});
   if(u.pathname==='/noa-lounge.php')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><meta charset=utf-8><body><section data-noa-community=free></section><script src=/noa-community.js></script></body></html>'});
   const world=u.pathname.includes('world'),points=u.pathname.includes('points');
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang=ko data-noa-style=starlight data-noa-precision=true><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">${css.map(x=>`<link rel=stylesheet href=/${x}.css>`).join('')}<body class="noa-page ${world?'nw-page':''}"><script id=noa-access type=application/json>{"home":true,"member":true,"music":true}</script><main ${world?'data-world-editorial':''}>${world?'<nav class=nw-breadcrumb><a href=/>NOA STUDIO</a><span>/</span><a href=/noa-world.php aria-current=page>NOA WORLD</a></nav><h1>노래가 끝나도,<br>이야기는 계속됩니다.</h1>':points?'<h1>포인트 충전</h1>':'<section class=channel-profile><h1>람준파파의 음악</h1></section>'}</main><script src=/noa-ui.js></script><script src=/noa-support.js></script></body></html>`});
  });
  await p.goto('http://noa.test/noa-world.php');await p.locator('#noa-section-navigation a').first().waitFor();
  const nav=await p.locator('#noa-section-navigation a').evaluateAll(ns=>ns.map(n=>({pad:parseFloat(getComputedStyle(n).paddingLeft),height:n.getBoundingClientRect().height,overflow:n.scrollWidth>n.clientWidth})));
  assert(nav.every(x=>x.pad>=12&&x.height>=44&&!x.overflow));
  assert.equal(await p.locator('.nw-breadcrumb a').first().evaluate(n=>getComputedStyle(n).borderTopWidth),'0px');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await p.screenshot({path:`ui-audit-proof/world-${width}.png`});
  await p.goto('http://noa.test/noa-channel.php?id=channel-a');const support=p.locator('.noa-support-button');await support.waitFor();await p.waitForFunction(()=>!document.querySelector('.noa-support-button').disabled);await support.click();
  await p.getByRole('button',{name:'3,000P',exact:true}).click();await p.getByLabel('응원 메시지',{exact:true}).fill('오늘도 잘 들었어요');
  await p.getByText('응원 후 잔액 4,000P',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'10,000P',exact:true}).isEnabled(),false);
  await p.screenshot({path:`ui-audit-proof/support-${width}.png`});
  await p.getByRole('button',{name:'3,000P 응원 확인',exact:true}).click();assert.equal(sends.length,0);
  await p.getByRole('button',{name:'금액·메시지 수정'}).click();assert.equal(await p.getByLabel('후원할 포인트',{exact:true}).inputValue(),'3000');assert.equal(await p.getByLabel('응원 메시지',{exact:true}).inputValue(),'오늘도 잘 들었어요');
  await p.getByLabel('후원할 포인트',{exact:true}).fill('8000');await p.getByText('포인트가 1,000P 부족해요. 충전 후 이어서 응원하세요.').waitFor();
  await p.getByRole('link',{name:'포인트 충전하고 돌아오기'}).click();await p.getByRole('link',{name:'응원하던 곳으로 돌아가기'}).waitFor();balance=10000;
  await p.getByRole('link',{name:'응원하던 곳으로 돌아가기'}).click();await p.getByRole('button',{name:'8,000P 응원 확인'}).waitFor();assert.equal(await p.getByLabel('응원 메시지',{exact:true}).inputValue(),'오늘도 잘 들었어요');assert.equal(sends.length,0);
  await p.getByRole('button',{name:'8,000P 응원 확인'}).click();await p.getByRole('button',{name:'8,000P로 응원 보내기'}).click();assert.equal(sends.length,0);
  await p.getByRole('checkbox').check();fail=true;await p.getByRole('button',{name:'8,000P로 응원 보내기'}).click();await p.getByRole('button',{name:'같은 요청으로 다시 확인'}).waitFor();fail=false;await p.getByRole('button',{name:'같은 요청으로 다시 확인'}).click();await p.getByText('응원이 전달되었습니다',{exact:true}).waitFor();assert.equal(sends.length,2);assert.equal(sends[0].requestId,sends[1].requestId);assert.equal(sends[1].amount,8000);
  await p.getByRole('button',{name:'완료',exact:true}).click();await support.click();await p.getByRole('button',{name:'1,000P',exact:true}).click();await p.getByRole('link',{name:'포인트 충전하고 돌아오기'}).click();sender='member-b';await p.getByRole('link',{name:'응원하던 곳으로 돌아가기'}).click();await p.getByLabel('후원할 포인트',{exact:true}).waitFor();assert.equal(await p.getByLabel('후원할 포인트',{exact:true}).inputValue(),'');
  await p.goto('http://noa.test/noa-lounge.php?board=free&nativePost=1#noa-free-1');const login=p.getByRole('link',{name:'로그인하고 글 보기'});await login.waitFor();assert.equal(new URL(await login.getAttribute('href'),'http://noa.test').searchParams.get('url'),'/noa-lounge.php?board=free&nativePost=1#noa-free-1');assert.equal(await p.getByRole('button',{name:'다시 불러오기'}).count(),0);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('UI_AUDIT_320_390_1280_NAV_SPACING_BREADCRUMB_SUPPORT_BALANCE_EDIT_CHARGE_RETURN_ACCOUNT_SWITCH_RETRY_IDEMPOTENCY_OK');
}finally{await browser.close();}
