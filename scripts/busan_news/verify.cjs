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
      const feed=await (await page.request.get(await strip.getAttribute('data-feed'))).json();
      assert(await page.locator('.sideGnb a').filter({hasText:'챗지기자 뉴스'}).count(),'news menu missing');
      assert(!(await strip.innerText()).includes('챗지기자'),'fixed reporter caption');
      const fits=await strip.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1 &&
        el.parentElement.querySelector('.grid-container')?.getBoundingClientRect().top>=el.getBoundingClientRect().bottom-1);
      assert(fits,'home strip alignment');
      if (feed.length) {
        const links=strip.locator('.bn-news-group:not([aria-hidden]) a');
        await links.first().waitFor({state:'visible'});
        assert.deepEqual(await links.allTextContents(),feed.map(x=>x.title));
        assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(a=>a.href)),feed.map(x=>x.url));
        const start=await links.first().evaluate(el=>el.getBoundingClientRect().x);
        await page.waitForFunction(x=>document.querySelector('.bn-news-group a').getBoundingClientRect().x<x-3,start);
        const pause=strip.getByRole('button',{name:'뉴스 흐름 일시정지'});
        await pause.evaluate(el=>el.click());
        assert.equal(await links.first().evaluate(el=>getComputedStyle(el.parentElement).animationPlayState),'paused');
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>getComputedStyle(document.querySelector('.bn-news-group')).animationName==='none');
        assert.equal(await strip.locator('.bn-news-group[aria-hidden]').isVisible(),false);
        const link=await links.first().getAttribute('href');
        await page.goto(link,{waitUntil:'domcontentloaded'});
        const card=page.locator('#bo_v_con a.bn-source-card');
        await card.waitFor({state:'visible'});
        assert.equal(await card.count(),1);
        assert.match(await card.locator('.bn-source-meta').innerText(),/\d{4}-\d{2}-\d{2}/);
        assert.equal(await card.locator('.bn-source-title').innerText(),feed[0].title);
        const url=new URL(await card.getAttribute('href'));
        assert.equal(url.protocol,'https:');
        assert((await card.innerText()).includes(url.hostname));
        assert.equal(await card.evaluate(el=>getComputedStyle(el).display),'grid');
        assert.equal(await page.locator('.linkBox a').filter({hasText:url.href}).count(),0,'duplicate raw link');
        assert(await page.locator('.footerWrap').count(),'board footer missing');
        console.log('PASS scrolling titles and source card',width,feed.length,link,url.hostname);
      } else {
        await strip.getByText('최근 한 달 새 소식이 없습니다').waitFor();
      }
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
