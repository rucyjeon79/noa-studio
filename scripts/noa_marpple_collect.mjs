import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
mkdirSync('marpple-proof',{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--no-sandbox']});
try {
 const page=await browser.newPage();
 const r=await page.goto('https://marpple.shop/kr/jr_lifestyle/products?cate_root_id=1',{waitUntil:'domcontentloaded',timeout:45000});
 await page.screenshot({path:'marpple-proof/source.png',fullPage:true});
 writeFileSync('marpple-proof/listing.html',await page.content());
 console.log(JSON.stringify({status:r.status(),title:await page.title(),cards:await page.locator('[data-rune="CardProductView"]').count(),text:(await page.locator('body').innerText()).slice(0,1200)}));
}finally{await browser.close();}
