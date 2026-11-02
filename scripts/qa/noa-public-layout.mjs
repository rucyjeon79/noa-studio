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
      console.log(width,path,response.status(),JSON.stringify(layout));
      if(response.status()>=400 || layout.content>layout.width+1)issues.push({width,path,...layout});
    }
    await page.close();
  }
} finally { await browser.close(); }
if(issues.length)throw Error(JSON.stringify(issues));
