import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
const products=JSON.parse(readFileSync('deploy/noa-products.json'));
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync('shop-proof',{recursive:true});
try {
 for(const width of [320,390,1280]){
  const page=await browser.newPage({viewport:{width,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://noa.test/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/noa-bridge/ecosystem.php'){
    const data=u.searchParams.get('action')==='session'?{member:false,level:0}:{products,storeUrl:'https://marpple.shop/kr/jr_lifestyle',state:{wishlist:[],cart:[]},popularity:{},revision:0};
    return route.fulfill({json:{ok:true,...data}});
   }
   if(u.pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:readFileSync('deploy'+u.pathname)});
   if(u.pathname.endsWith('.js'))return route.fulfill({contentType:'application/javascript',body:readFileSync('deploy'+u.pathname)});
   if(u.pathname.endsWith('.jpg'))return route.fulfill({contentType:'image/jpeg',body:readFileSync('deploy'+u.pathname)});
   return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ko" data-noa-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ecosystem.css"><body class="noa-page"><main id="ecosystem" data-space="shop"><h1>NOA SHOP</h1><div id="ec-hero-actions" class="ec-actions"></div><div id="ec-status" role="status"></div><nav id="ec-tools" class="ec-tools"></nav><section id="ec-content"></section></main><script src="/noa-ecosystem.js"></script></body></html>`});
  });
  await page.goto('http://noa.test/noa-shop.php');await page.locator('.ec-card').last().waitFor();
  assert.equal(await page.locator('.ec-card').count(),products.length);
  const links=await page.locator('.ec-card .ec-buy').evaluateAll(nodes=>nodes.map(n=>({href:n.href,target:n.target,rel:n.rel})));
  assert.deepEqual(links.map(x=>x.href),products.map(p=>p.url));
  for(const a of links){assert.equal(a.target,'_blank');assert(a.rel.includes('noopener'));}
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const bounds=await page.locator('.ec-shop-secondary button,.ec-card .ec-buy').evaluateAll(nodes=>nodes.map(n=>({h:n.getBoundingClientRect().height,w:n.getBoundingClientRect().width,wrap:getComputedStyle(n).whiteSpace,overflow:n.scrollWidth>n.clientWidth})));
  assert(bounds.every(x=>x.h>=44&&x.h<56&&x.w>=44&&x.wrap==='nowrap'&&!x.overflow),JSON.stringify(bounds));
  await page.locator('.ec-grid').screenshot({path:`shop-proof/shop-${width}.png`});
  await page.locator('.ec-shop-secondary button').first().click();await page.getByRole('link',{name:'로그인하기',exact:true}).waitFor();
  for(let i=0;i<2;i++)await page.locator('.ec-shop-secondary').nth(i).getByRole('button',{name:/비교/}).click();
  await page.getByRole('button',{name:'선택 상품 비교 (2/3)',exact:true}).click();await page.getByRole('region',{name:'선택 상품 비교표'}).waitFor();
  assert.equal(await page.locator('table .ec-buy').count(),2);
  await page.getByRole('button',{name:'← 상품 목록',exact:true}).click();await page.locator('.ec-open').first().click();
  await page.locator('.ec-detail .ec-buy').first().waitFor();assert.equal(await page.locator('.ec-detail .ec-buy').first().getAttribute('href'),products[0].url);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('SHOP_320_390_1280_LAYOUT_DIRECT_PURCHASE_DETAIL_COMPARE_GUEST_OK');
}finally{await browser.close();}
