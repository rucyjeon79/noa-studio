const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright-core');
const origin = 'https://skhnslu-busan.com';
// Read physical positions so a running timer or an animation name cannot pass a frozen ticker.
async function assertMoves(page) {
  const selector = '.bn-news-group a';
  const x = await page.locator(selector).first().evaluate(a => a.getBoundingClientRect().left);
  await page.waitForFunction(({selector,x}) => {
    const a = document.querySelector(selector);
    return a && Math.abs(a.getBoundingClientRect().left-x)>12;
  }, {selector,x}, {timeout:6000});
}

(async()=>{
  const browser = await chromium.launch({channel:'chrome',headless:true});
  try {
    for (const options of [
      {...devices['Pixel 7'], viewport:{width:390,height:844}},
      {viewport:{width:1440,height:920}}
    ]) {
      const width=options.viewport.width, touch=!!options.hasTouch;
      const page=await browser.newPage(options);
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
        for (const close of await page.locator('#hd_pop .hd_pops_reject:visible').all()) await close.click();
        await strip.scrollIntoViewIfNeeded();
        await assertMoves(page);
        const pause=strip.getByRole('button',{name:'뉴스 흐름 일시정지'});
        const play=strip.getByRole('button',{name:'뉴스 흐름 재생'});
        let article=feed[0];
        if (touch) {
          assert(await page.evaluate(()=>navigator.maxTouchPoints>0 && matchMedia('(pointer:coarse)').matches));
          // The second title must actually enter the visible window on its own.
          if (feed.length>1) await page.waitForFunction(()=>{
            const box=document.querySelector('.bn-news-window').getBoundingClientRect();
            const second=document.querySelectorAll('.bn-news-group:first-child a')[1].getBoundingClientRect();
            return second.left<box.left+box.width*.55 && second.right>box.left;
          },null,{timeout:45000});
          await pause.tap();
          const target=await strip.locator('.bn-news-window').evaluate(el=>{
            const rect=el.getBoundingClientRect(), x=rect.left+rect.width*.7, y=rect.top+rect.height/2;
            return {x,y,url:document.elementFromPoint(x,y)?.closest('a')?.href};
          });
          article=feed.find(x=>x.url===target.url);
          assert(article,'a visible headline must be tappable');
          await play.tap();
          await page.touchscreen.tap(target.x,target.y);
          await page.waitForURL(article.url,{timeout:10000});
          await page.goBack({waitUntil:'domcontentloaded'});
          await assertMoves(page);
        }
        await pause.click();
        await play.waitFor({state:'visible'});
        await page.waitForFunction(()=>document.querySelector('.bn-news-track').getAnimations()[0]?.playState==='paused');
        await page.emulateMedia({reducedMotion:'reduce'});
        await page.waitForFunction(()=>document.querySelector('#bn-news-strip').classList.contains('bn-still'));
        assert.equal(await strip.locator('.bn-news-group[aria-hidden]').isVisible(),false);
        if (touch) await play.tap(); else await play.click();
        await assertMoves(page);
        if (touch) {
          await page.reload({waitUntil:'domcontentloaded'});
          await assertMoves(page);
        }
        const link=article.url;
        await page.goto(link,{waitUntil:'domcontentloaded'});
        const card=page.locator('#bo_v_con a.bn-source-card');
        await card.waitFor({state:'visible'});
        assert.equal(await card.count(),1);
        assert.match(await card.locator('.bn-source-meta').innerText(),/\d{4}-\d{2}-\d{2}/);
        assert.equal(await card.locator('.bn-source-title').innerText(),article.title);
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
