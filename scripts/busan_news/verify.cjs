const assert = require('node:assert/strict');
const { chromium, devices, request } = require('playwright-core');
const origin = 'https://skhnslu-busan.com';
const checkHeaders = {'X-Busan-News-Check': '1'};

async function verifyArticleShare(page, article, width) {
  const button=page.getByRole('button',{name:'기사 공유',exact:true});
  assert.equal(await button.count(),1,'one share action');
  await button.waitFor({state:'visible'});
  assert.equal(await button.getAttribute('data-url'),article.url,'share the local article, not its source');
  const box=await button.boundingBox();
  assert(box.width>=44 && box.height>=44,'share touch target');
  assert(await button.evaluate(el=>{
    const r=el.getBoundingClientRect();
    return r.left>=0 && r.right<=innerWidth && !!el.closest('.boardViewHeader');
  }),'share action stays within the header');
  await page.locator('.boardViewWrap').screenshot({path:'/tmp/busan-news-share-'+width+'.png'});

  // Stub only device APIs: test the real deployed click handler without sending a message.
  await page.evaluate(()=>{
    window.__bnShares=[]; window.__bnCopies=[]; window.__bnPrompts=[];
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>window.__bnCopies.push(text)}});
    Object.defineProperty(navigator,'share',{configurable:true,value:data=>{
      window.__bnShares.push({data,active:navigator.userActivation.isActive});
      return new Promise(resolve=>{window.__bnFinishShare=resolve;});
    }});
    window.prompt=(message,url)=>{window.__bnPrompts.push({message,url});return null;};
    history.replaceState(null,'',location.href+'&device=mobile&stx=private-search#reading');
  });
  await button.click();
  assert.equal(await button.isDisabled(),true,'prevent duplicate share while the sheet is open');
  await button.evaluate(el=>el.click());
  assert.deepEqual(await page.evaluate(()=>window.__bnShares),[
    {data:{title:article.title,text:article.title,url:article.url},active:true}
  ],'native share gets title and a clean canonical URL in the tap gesture');
  await page.evaluate(()=>window.__bnFinishShare());
  await page.waitForFunction(()=>!document.querySelector('.bn-article-share').disabled);

  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{
    throw new DOMException('cancelled','AbortError');
  }}));
  await button.click();
  await page.waitForFunction(()=>!document.querySelector('.bn-article-share').disabled);
  assert.deepEqual(await page.evaluate(()=>[window.__bnCopies,window.__bnPrompts]),[[],[]],'cancel has no clipboard or dialog side effect');

  await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
  await button.focus();
  await page.keyboard.press('Enter');
  await page.waitForFunction(()=>window.__bnCopies.length===1);
  assert.deepEqual(await page.evaluate(()=>window.__bnCopies),[article.url]);
  assert.match(await page.getByRole('status').filter({hasText:'기사 링크를 복사했습니다'}).innerText(),/붙여넣어/);

  await page.evaluate(()=>{
    Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('blocked','NotAllowedError');}});
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}});
  });
  await button.click();
  await page.waitForFunction(()=>window.__bnPrompts.length===1);
  assert.equal(await page.evaluate(()=>window.__bnPrompts[0].url),article.url);
  assert.equal(await button.isEnabled(),true,'the action remains usable after failure');
  console.log('PASS native share payload, tap activation, duplicate guard, cancellation, keyboard copy and denied-permission fallback',width);
}

async function verifyCheckViews(browser, article) {
  const listing = await browser.newPage();
  const listURL = new URL('/bbs/board.php', origin);
  listURL.search = new URLSearchParams({bo_table:new URL(article.url).searchParams.get('bo_table'), sfl:'wr_subject', stx:article.title});
  const readHits = async () => {
    await listing.goto(listURL.href, {waitUntil:'domcontentloaded'});
    const row = listing.locator('.cardBox').filter({
      has:listing.locator('.bo_tit a[href*="wr_id=' + article.id + '"]')
    });
    assert.equal(await row.count(), 1, 'exact article counter');
    return Number((await row.locator('.col-hit').innerText()).replaceAll(',', ''));
  };
  try {
    const before = await readHits();
    for (const device of ['pc', 'mobile']) {
      // Separate sessions also catch a guard that only suppresses repeat views.
      const client = await request.newContext({extraHTTPHeaders:checkHeaders});
      try {
        const url = new URL(article.url);
        url.searchParams.set('device', device);
        for (let repeat = 0; repeat < 2; repeat++) {
          const response = await client.get(url.href);
          assert.equal(response.status(), 200);
          assert.equal(response.headers()['x-busan-news-view'], 'excluded');
        }
      } finally { await client.dispose(); }
    }
    const after = await readHits();
    assert.equal(after, before, 'diagnostic visits changed the article counter');
    console.log('PASS diagnostic views', article.id, 'before', before, 'after', after, 'four requests in two sessions');
  } finally { await listing.close(); }
}

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
      {...devices['Pixel 7'], reducedMotion:'reduce', viewport:{width:390,height:844}},
      {viewport:{width:1440,height:920}}
    ]) {
      const width=options.viewport.width, touch=!!options.hasTouch;
      const page=await browser.newPage({...options, extraHTTPHeaders:checkHeaders});
      await page.goto(origin+'/',{waitUntil:'domcontentloaded'});
      const strip=page.locator('#contentsWrap > .kvWrap + #bn-news-strip');
      await strip.waitFor({state:'visible'});
      const feed=await (await page.request.get(await strip.getAttribute('data-feed'))).json();
      const boardMenu=page.locator('.sideGnb a[href*="bo_table=busan_news"]').filter({hasText:'OpenAI 뉴스룸'}).first();
      assert(await boardMenu.count(),'renamed news menu missing');
      const boardURL=await boardMenu.evaluate(a=>a.href);
      assert(!(await strip.innerText()).includes('챗지기자'),'fixed reporter caption');
      const fits=await strip.evaluate(el=>el.getBoundingClientRect().right<=innerWidth+1 &&
        el.parentElement.querySelector('.grid-container')?.getBoundingClientRect().top>=el.getBoundingClientRect().bottom-1);
      assert(fits,'home strip alignment');
      if (feed.length) {
        if (!touch) await verifyCheckViews(browser, feed.reduce((a,b) => Number(a.id)>Number(b.id) ? a : b));
        const links=strip.locator('.bn-news-group:not([aria-hidden]) a');
        await links.first().waitFor({state:'visible'});
        assert.deepEqual(await links.allTextContents(),feed.map(x=>x.title));
        assert.deepEqual(await links.evaluateAll(nodes=>nodes.map(a=>a.href)),feed.map(x=>x.url));
        // Autoplay must start in a fresh browser before any tap, even with reduced motion.
        await assertMoves(page);
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
        if (touch) {
          // A fresh home load must start even if the previous visit was paused.
          await page.reload({waitUntil:'domcontentloaded'});
          await assertMoves(page);
        } else {
          await play.click();
          await assertMoves(page);
        }
        const link=article.url;
        const articleResponse = await page.goto(link,{waitUntil:'domcontentloaded'});
        assert.equal(articleResponse.headers()['x-busan-news-view'], 'excluded');
        const sectionNames={busan_news_company:'회사·그룹 소식',busan_news_union:'노동조합 소식',busan_news_law:'노동법·판례',busan_news_world:'세계 노동 동향'};
        await page.getByRole('heading',{name:sectionNames[article.board]||'OpenAI 뉴스룸',exact:true}).first().waitFor({state:'visible'});
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
        await verifyArticleShare(page,article,width);
        console.log('PASS scrolling titles and source card',width,feed.length,link,url.hostname);
      } else {
        await strip.getByText('최근 한 달 새 소식이 없습니다').waitFor();
      }
      await page.goto(boardURL,{waitUntil:'domcontentloaded'});
      await page.getByRole('heading',{name:'OpenAI 뉴스룸',exact:true}).first().waitFor({state:'visible'});
      assert((await page.title()).includes('OpenAI 뉴스룸'));
      for(const name of ['회사·그룹 소식','노동조합 소식','노동법·판례','세계 노동 동향']) await page.locator('.bn-hub-section').getByRole('heading',{name,exact:true}).waitFor({state:'visible'});
      assert.equal(await page.locator('.bn-hub-section').count(),4);
      assert.equal(await page.locator('.bn-article-share').count(),0,'article sharing is absent on the list');
      console.log('PASS newsroom menu and board title',width,boardURL);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});

