const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const origin = 'https://skhnslu-busan.com';
(async()=>{
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const width of [390, 1440]) {
      const page=await browser.newPage({viewport:{width,height:920}});
      await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
      const strip=page.locator('#contentsWrap > .kvWrap + #bn-news-strip');
      await strip.waitFor({state:'visible'});
      await page.waitForFunction(()=>document.querySelector('.bn-news-link')?.href.includes('wr_id='));
      assert(await page.locator('.sideGnb a').filter({hasText:'챗지기자 뉴스'}).count(), 'news menu missing');
      const boxes=await strip.evaluate(el=>({w:el.getBoundingClientRect().width,end:el.getBoundingClientRect().right,
        after:el.nextElementSibling?.classList.contains('grid-container')}));
      assert(boxes.after && boxes.end<=width+1 && boxes.w>0, 'home strip alignment');
      const link=await strip.locator('.bn-news-link').getAttribute('href');
      await page.goto(link,{waitUntil:'domcontentloaded'});
      const body = page.locator('.boardViewWrap .viewContent').first();
      await body.waitFor({state:'visible'});
      assert((await body.innerText()).includes('출처'),'article source missing');
      assert(await body.getByRole('link',{name:/원문 읽기/}).count(),'source link missing');
      console.log('PASS home → article → source',width,link);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
