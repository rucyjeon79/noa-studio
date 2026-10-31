// Exercise the shipped browser client with deterministic API responses; durable and
// authorization behavior is tested separately against real PHP/MySQL in completion.php.
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const script=readFileSync('deploy/noa-ecosystem.js','utf8');
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try {
 for(const width of [390,1280]) {
  const page=await browser.newPage({viewport:{width,height:900}}),errors=[],calls=[];
  page.on('pageerror',e=>errors.push(e.message));
  let own=null,admin=false,failCart=false;
  const product={id:'real-product',title:'실제 굿즈',priceWon:12000,image:'/image.png',category:'팬 굿즈',url:'https://marpple.shop/kr/jr_lifestyle/products/1'};
  const post={id:'a'.repeat(32),space:'lab',category:'collaboration',title:'협업 검증',body:'함께 만드는 음악',name:'창작자',at:1,stage:'draft',visibility:'public',roles:'보컬',schedule:'11월',compensation:'서면 계약',rights:'공동 크레딧',termsHash:'verified-terms',revision:1,options:[],images:[],likes:0};
  const shop=()=>({storeUrl:'https://marpple.shop/kr/jr_lifestyle',products:[product,{...product,id:"second-product",title:"다른 상품",priceWon:22000}],managedProducts:admin?[product]:[],popularity:{},state:{wishlist:[],cart:[]},revision:0});
  await page.route('http://noa.test/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname==='/noa-bridge/ecosystem.php') {
    const action=url.searchParams.get('action'),body=req.postDataJSON();if(body)calls.push({action,body});let data={};
    if(action==='session')data={member:true,level:admin?10:5,creator:true,admin,csrf:'fixture'};
    else if(action==='detail')data={post,ownApplication:own,applications:[],comments:[],versions:[],vote:null,products:[product]};
    else if(action==='apply'){own={status:'requested',revision:1};data=own;}
    else if(action==='application-withdraw'){own={status:'withdrawn',revision:2};data=own;}
    else if(action==='shop')data=shop();
    else if(action==='shop-save'&&failCart){await route.fulfill({status:409,json:{ok:false,error:'revision_conflict'}});return;}
    else if(action==='activity')data={notices:[{key:'n',text:'LAB 알림',post:post.id,space:'lab',at:1}],applications:[]};
    else if(action==='list')data={items:[],page:1,pages:1};
    else if(action==='highlights')data={monthCount:0,items:[]};
    await route.fulfill({json:{ok:true,...data}});return;
   }
   if(url.pathname==='/client.js'){await route.fulfill({contentType:'application/javascript',body:script});return;}
   if(url.pathname==='/image.png'){await route.fulfill({status:204});return;}
   const space=url.pathname.includes('shop')?'shop':url.pathname.includes('lab')?'lab':'lounge';
   await route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko"><meta charset="utf-8"><div id="ecosystem" data-space="${space}"><a href="/noa-shop.php?view=cart">보관한 상품</a><div id="ec-hero-actions"></div><div id="ec-tools"></div><p id="ec-status"></p><div id="ec-content"></div></div><script src="/client.js"></script></html>`});
  });
  await page.goto('http://noa.test/noa-creator-lab.php?post='+post.id);
  await page.getByRole('button',{name:'협업 참여 신청',exact:true}).click();
  await page.getByLabel('참여 역할·소개').fill('보컬 참여');
  await page.getByRole('checkbox').check();await page.getByRole('button',{name:'신청하기',exact:true}).click();
  await page.getByRole('button',{name:'신청 철회',exact:true}).waitFor();
  assert.equal(calls.find(c=>c.action==='apply').body.termsHash,'verified-terms');
  await page.getByRole('button',{name:'신청 철회',exact:true}).click();await page.getByRole('button',{name:'철회하기',exact:true}).click();
  await page.getByRole('button',{name:'최신 조건으로 다시 신청'}).click();await page.getByLabel('참여 역할·소개').fill('조건 재동의');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'신청하기',exact:true}).click();
  await page.getByRole('button',{name:'신청 철회',exact:true}).waitFor();assert.equal(calls.filter(c=>c.action==='apply').at(-1).body.applicationRevision,2);
  assert.equal(await page.getByRole('link',{name:/실제 굿즈/}).getAttribute('href'),'/noa-shop.php?product=real-product');
  await page.getByRole('button',{name:'작품·이야기 올리기'}).click();await page.getByText('음악·영상·이미지 연결',{exact:true}).click();await page.getByRole('button',{name:'관련 굿즈 선택',exact:true}).click();await page.getByLabel('실제 굿즈',{exact:true}).check();
  await page.getByLabel('제목',{exact:true}).fill('관련 상품 작품');await page.getByLabel('내용',{exact:true}).fill('작품 소개');await page.getByRole('checkbox',{name:/이 작품을 공개/}).check();await page.getByRole('button',{name:'게시하기',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('dialog'));assert.deepEqual(calls.find(c=>c.action==='save').body.productIds,['real-product']);
  await page.goto('http://noa.test/noa-lounge.php?view=list');await page.getByRole('button',{name:'내 활동·알림'}).click();await page.getByRole('button',{name:/LAB 알림/}).click();await page.waitForURL('**/noa-creator-lab.php?post=*');
  await page.goto('http://noa.test/noa-shop.php');await page.locator('.ec-shop-secondary button[aria-pressed=false]').filter({hasText:'비교'}).first().click();await page.locator('.ec-shop-secondary button[aria-pressed=false]').filter({hasText:'비교'}).click();await page.getByRole('button',{name:'선택 상품 비교 (2/3)',exact:true}).click();await page.getByRole('region',{name:'선택 상품 비교표'}).waitFor();assert.equal(await page.locator('thead th').count(),3);assert((await page.locator('table').innerText()).includes('22,000원'));await page.getByRole('button',{name:'← 상품 목록',exact:true}).click();
  await page.getByRole('searchbox',{name:'상품 찾기'}).fill('실제');await page.locator('.ec-open').click();await page.getByRole('button',{name:'← 상품 목록',exact:true}).click();assert.equal(await page.getByRole('searchbox',{name:'상품 찾기'}).inputValue(),'실제');assert.equal(await page.locator('.ec-card').count(),1);await page.getByRole('searchbox',{name:'상품 찾기'}).fill('');
  failCart=true;await page.locator('.ec-open').first().click();await page.getByRole('button',{name:'상품 보관',exact:true}).click();await page.getByText('다른 화면에서 변경되었습니다.',{exact:false}).waitFor();
  await page.getByRole('link',{name:'보관한 상품',exact:true}).click();await page.getByText('보관한 상품이 없어요',{exact:true}).waitFor();
  admin=true;await page.reload();await page.getByRole('button',{name:'상품 관리',exact:true}).click();assert.equal(await page.getByLabel('상품 ID',{exact:true}).inputValue(),'');assert.equal(await page.getByLabel('상품',{exact:true}).inputValue(),'');
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('ECOSYSTEM_BROWSER_MOBILE_DESKTOP_CONSENT_WITHDRAW_REAPPLY_PRODUCT_LINK_ACTIVITY_CART_ROLLBACK_PRODUCT_COMPARE_FILTER_RESTORE_OK');
} finally {await browser.close();}
