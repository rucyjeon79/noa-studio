const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');

const origin = 'https://skhnslu-busan.com';
const pages = [
  ['/', '.grid-container'],
  ['/bbs/group.php?gr_id=Busan', '.groupHeader'],
  ['/bbs/content.php?co_id=company', '#busan-content-page'],
  ['/bbs/content.php?co_id=slogan', '#busan-content-page'],
  ['/bbs/register.php', '.registerWrap'],
  ['/bbs/login.php', '.loginWrap'],
  ['/bbs/faq.php', '.faqListWrap'],
];

async function inspect(page, path, selector, width) {
  await page.goto(origin + path, { waitUntil: 'domcontentloaded' });
  const region = page.locator(selector);
  await region.waitFor({ state: 'visible' });
  await page.waitForFunction(() => Array.from(document.styleSheets).some(
    sheet => sheet.href?.includes('/busan-layout.css') && sheet.cssRules.length > 0));
  const box = await region.boundingBox();
  assert(box.width > 0 && box.x >= -1 && box.x + box.width <= width + 1,
    path + ' content extends beyond viewport ' + width + ': ' + JSON.stringify(box));

  if (selector === '.grid-container') {
    const cards = region.locator('.grid-row').first().locator('.widget-header');
    const [left, right] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
    assert(left && right);
    if (width > 860) assert(Math.abs(left.y - right.y) <= 1);
    else assert(Math.abs(left.x - right.x) <= 1 && right.y > left.y);
    const more = await region.locator('.widget-more').first().boundingBox();
    assert(more.height >= 44, 'home touch target');
    const popup = page.locator('#hd_pop .hd_pops:visible').first();
    if (width <= 768 && await popup.count()) {
      const bounds = await popup.boundingBox();
      assert(bounds.x >= -1 && bounds.x + bounds.width <= width + 1, 'popup outside viewport');
    }
  }

  if (selector === '#busan-content-page') {
    const images = region.locator('img');
    assert.equal(await images.count(), 10);
    const sources = new Set();
    for (const image of await images.all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate(el => el.decode());
      const source = await image.getAttribute('src');
      assert(source.includes('/data/editor/'), 'assigned section photograph missing');
      sources.add(source);
    }
    assert.equal(sources.size, 10);
    return sources;
  }
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [390, 768, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const photos = new Set();
      for (const [path, selector] of pages) {
        const sources = await inspect(page, path, selector, width);
        if (sources) for (const source of sources) photos.add(source);
        console.log('PASS', width, path);
      }
      assert.equal(photos.size, 20);
      await context.close();
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
