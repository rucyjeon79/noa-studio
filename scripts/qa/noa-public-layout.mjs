import { chromium } from 'playwright';
const browser = await chromium.launch({channel:'chrome',args:['--no-sandbox']});
const paths = ['/', '/noa-youtube.php', '/noa-music.php', '/noa-lounge.php', '/bbs/board.php?bo_table=notice', '/noa-shop.php', '/noa-points.php', '/noa-vip.php', '/noa-login.php', '/noa-my.php'];
const issues = [];
try {
  for (const width of [360, 1280]) {
    const page = await browser.newPage({viewport:{width,height:840}});
    for (const path of paths) {
      const response = await page.goto('https://noastudio.ai.kr'+path,{waitUntil:'domcontentloaded'});
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({
        width: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        title: document.title,
        outside: [...document.querySelectorAll('main input,main button,main select,main textarea')]
          .filter(el => el.getBoundingClientRect().width && el.getBoundingClientRect().right > innerWidth+1 && !el.closest('[hidden], [aria-hidden="true"]'))
          .slice(0,4).map(el => el.id||el.className||el.tagName)
      }));
      // Compare visible controls against the next independent block on both axes.
      const pairs = [
        ['#points-login','.np-store-layout',20],
        ['#vip-login','#vip-login + .np-history-link',20],
        ['.noa-social-links a:first-child','.noa-social-links a:nth-child(2)',8]
      ];
      for(const [first,second,min] of pairs){
        const a=page.locator(first).first(), b=page.locator(second).first();
        if(!await a.isVisible() || !await b.isVisible())continue;
        const x=await a.boundingBox(), y=await b.boundingBox();
        const gap=Math.max(y.x-x.x-x.width,x.x-y.x-y.width,y.y-x.y-x.height,x.y-y.y-y.height);
        if(gap<min-0.5)issues.push({width,path,first,second,gap,min});
      }
      console.log(width,path,response.status(),JSON.stringify(layout));
      if(response.status()>=400 || layout.content>layout.width+1)issues.push({width,path,...layout});
    }
    await page.close();
  }
} finally { await browser.close(); }
if(issues.length)throw Error(JSON.stringify(issues));
