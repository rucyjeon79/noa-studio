// Public shop catalog only. No accounts, orders, carts or payment operations.
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const ROOT='https://marpple.shop/kr/jr_lifestyle/products?cate_root_id=1';
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
mkdirSync('marpple-proof',{recursive:true});
try {
 const page=await browser.newPage();
 async function scan(url){
  const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
  assert(response.ok(),'Storefront HTTP '+response.status());
  await page.locator('[data-rune="CardProductView"]').first().waitFor({timeout:20000});
  const all=[],seen=new Set();let finished=false;
  for(let n=0;n<100;n++){
   await page.locator('[data-rune="Pagination"]').waitFor({state:'attached'});
   const rows=await page.locator('[data-rune="CardProductView"]').evaluateAll(cards=>cards.map(card=>{
    const a=card.querySelector('[data-rune="ProductTitleView"]'),im=card.querySelector('[data-rune="ProductImageView"] img'),pr=card.querySelector('[data-rune="PriceView"]');
    return {url:a?.href,title:a?.textContent.trim(),image:im?.getAttribute('data-src')||im?.src,priceText:pr?.textContent,soldOut:/품절|판매 종료/.test(card.textContent)};
   }));
   assert(rows.length,'Empty storefront page');
   for(const row of rows){assert(row.url&&!seen.has(row.url),'Duplicate or incomplete pagination');seen.add(row.url);all.push(row);}
   const next=page.locator('[data-rune="Pagination"] [data-action="PageNext"]');
   assert.equal(await next.count(),1,'Pagination structure changed');
   const end=await next.evaluate(e=>e.disabled||e.getAttribute('aria-disabled')==='true'||/disabled/.test(e.className));
   if(end){finished=true;break;}
   const prior=rows[0].url;await next.click();
   await page.waitForFunction(old=>document.querySelector('[data-rune="ProductTitleView"]')?.href!==old,prior);
  }
  assert(finished,'Pagination limit reached; preserve previous catalog');
  return all;
 }
 const rows=await scan(ROOT);
 const categoryLinks=await page.locator('a[href*="cate_list_id="]').evaluateAll(as=>[...new Map(as.filter(a=>a.href.includes('/kr/jr_lifestyle/products?')).map(a=>[a.href,{url:a.href,name:a.textContent.trim()}])).values()]);
 assert(categoryLinks.length,'Missing category navigation');
 const categories=new Map();
 for(const c of categoryLinks){for(const p of await scan(c.url)){assert(!categories.has(p.url),'Product repeated across categories');categories.set(p.url,c.name);}}
 assert.equal(categories.size,rows.length,'Root/category inventory mismatch');
 const checkedAt=new Date().toISOString();
 const products=rows.map(row=>{
  const url=new URL(row.url),id=url.pathname.match(/^\/kr\/jr_lifestyle\/products\/(\d+)$/)?.[1];
  assert(url.origin==='https://marpple.shop'&&id,'Unexpected product URL: '+row.url);
  assert(row.title&&row.title.length<=200,'Invalid title');
  const amount=row.priceText?.match(/([\d,]+)\s*원/);assert(amount,'Missing KRW price');
  const priceWon=Number(amount[1].replaceAll(',',''));assert(Number.isSafeInteger(priceWon)&&priceWon>0&&priceWon<100000000,'Invalid price');
  const image=new URL(row.image);assert(image.protocol==='https:'&&['common.image.cf.marpple.co','s3.marpple.co'].includes(image.hostname),'Unapproved product image');
  assert(categories.has(row.url),'Missing category');
  return {id,title:row.title,url:row.url,image:row.image,images:[row.image],priceWon,category:categories.get(row.url),checkedAt,sourceUrl:row.url,synced:true,soldOut:row.soldOut,availability:row.soldOut?'품절 · 마플샵에서 확인':'마플샵에서 판매 상태 확인',optionsRequired:true,description:'상품 상세와 옵션은 마플샵에서 확인해 주세요.',optionNote:'색상·사이즈·수량은 마플샵에서 선택합니다.',seller:'제이알 · 마플샵',checkout:'external'};
 });
 writeFileSync('marpple-proof/catalog.json',JSON.stringify({version:1,source:ROOT,complete:true,checkedAt,count:products.length,products},null,2));
 console.log('MARPPLE_COMPLETE_CATALOG '+JSON.stringify({count:products.length,categories:categoryLinks.map(c=>c.name),checkedAt}));
} catch(e){console.error(e.message);throw e;}finally{await browser.close();}
