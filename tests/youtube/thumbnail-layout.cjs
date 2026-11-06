const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

async function main() {
  const browser = await chromium.launch({channel: 'chrome', args: ['--no-sandbox']});
  try {
    for (const width of [320, 360, 390, 430, 1280]) {
      const page = await browser.newPage({viewport: {width, height: 850}});
      const site = 'https://fixture.test';
      await page.route(site + '/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname === '/noa-youtube.php') return route.fulfill({
          contentType: 'text/html',
          body: '<!doctype html><html lang="ko" data-noa-precision="ios"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="noa-page" style="margin:0;padding:0 16px"><main id="youtube-browse"></main><script type="application/json" id="noa-engagement-context">{"member":true}</script></body></html>'
        });
        if (url.pathname === '/noa-bridge/engagement.php') {
          const targets = JSON.parse(url.searchParams.get('targets') || '[]');
          return route.fulfill({json: {ok: true, items: targets.map(target => ({...target, likes: 12345, comments: 42}))}});
        }
        return route.fulfill({json: {ok: true, story: [], cover: [], playlists: []}});
      });
      await page.goto(site + '/noa-youtube.php?genre=kpop-original&act=1');
      for (const css of ['noa-ui.css', 'noa-youtube.css', 'noa-engagement.css']) {
        await page.addStyleTag({path: path.resolve('deploy', css)});
      }
      for (const script of ['noa-browse.js', 'noa-engagement.js']) {
        await page.addScriptTag({path: path.resolve('deploy', script)});
      }
      await page.evaluate(() => {
        const thumb = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="navy"/></svg>');
        const rows = [
          {key: 'first', ep: 1, title: '내 맘이 지나면', video: 'video000001'},
          {key: 'second', ep: 2, title: '내일도 우리 · 아주 긴 제목의 미공개 영상', comingSoon: true}
        ].map(row => ({...row, thumb, genre: 'kpop-original', act: 1}));
        let ui;
        ui = window.NoaBrowse.mount({host: document.querySelector('main'), rows, kind: '영상', onChange: () => ui?.apply(rows)});
        ui.apply(rows);
        // Editors get an additional action, which the real menu enhancer folds into More.
        for (const row of document.querySelectorAll('.noa-inline-video-row')) {
          const edit = document.createElement('button');
          edit.className = 'noa-edit-edit';
          row.append(edit);
        }
      });
      const rows = page.locator('.noa-inline-video-row:visible');
      await rows.first().locator('.noa-song-more').waitFor();
      assert.equal(await rows.count(), 2);
      await rows.first().getByText('12.3K', {exact: true}).waitFor();
      const samples = await rows.evaluateAll(items => items.map(row => {
        const bounds = selector => row.querySelector(selector).getBoundingClientRect().toJSON();
        return {
          row: row.getBoundingClientRect().toJSON(), art: bounds('.noa-inline-cover'), title: bounds('.noa-inline-title'),
          like: bounds('.noa-engagement>button:first-of-type'), comment: bounds('.noa-engagement>button:nth-of-type(2)'),
          more: bounds('.noa-song-more'), status: row.querySelector('.noa-inline-song>small')?.getBoundingClientRect().toJSON()
        };
      }));
      assert(samples[1].status);
      for (const {art, title, like, comment, more, status, row} of samples) {
        assert(art.width > 0 && Math.abs(art.width * 9 / 16 - art.height) < 0.1, JSON.stringify(art));
        assert(art.right < title.left && art.right < like.left && like.right <= comment.left + 0.1);
        assert(comment.right <= (status || more).left + 0.1);
        if (status) assert(status.right <= more.left && status.top >= title.bottom);
        assert(more.width >= 44 && more.right <= row.right && row.right <= width);
      }
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      console.log(width, 'px viewport:', samples[0].art.width, 'x', samples[0].art.height);
      await page.close();
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
