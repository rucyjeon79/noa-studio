const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright');

const thumb = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="100%" height="100%" fill="gray"/></svg>');
const video = (title, pending = false) => `<article class="yt-card ${pending ? 'yt-coming-card' : ''}"><button class="yt-watch"><img src="${thumb}" alt=""><span class="${pending ? 'yt-coming-label' : 'yt-play'}">${pending ? 'Coming Soon' : '▶'}</span></button><h2>${title}</h2><p class="noa-muted">음악 영상</p></article>`;
const song = (key, art) => `<article class="song" data-key="${key}"><button class="song-select">${art ? '<img src="' + thumb + '" alt="" width="56" height="56">' : ''}<span class="cover" ${art ? 'hidden' : ''}>♫</span><span class="info"><strong>${key}</strong><small>POP Original</small></span></button><div class="jukebox-actions"><button class="sound-play">재생</button><a class="jukebox-download" href="#download">다운로드</a></div></article>`;

async function check(browser, width, music) {
  const page = await browser.newPage({viewport: {width, height: 850}});
  try {
    const markup = music
      ? '<section id="music-browse"></section><audio id="sound-player"></audio><div><img id="dock-cover" hidden><span id="dock-cover-empty">♫</span></div><div id="songs" class="grid">' + song('첫 곡', true) + song('둘째 곡', false) + '</div>'
      : '<div id="yt-videos" class="yt-grid">' + video('공개 영상') + video('공개 예정 영상', true) + '</div>';
    await page.setContent(`<!doctype html><html lang="ko" data-noa-precision="ios" data-noa-theme="light"><meta name="viewport" content="width=device-width,initial-scale=1"><body class="noa-page ${music ? 'noa-sound-page' : ''}"><main>${markup}</main></body></html>`);
    const styles = music
      ? ['noa-app/jukebox/upload.css', 'noa-app/p0-media.css', 'noa-music.css', 'noa-ui.css', 'noa-listening.css', 'noa-music-vinyl.css']
      : ['noa-ui.css', 'noa-app/p0-media.css', 'noa-youtube.css'];
    for (const file of [...styles, 'noa-engagement.css', 'noa-starlight.css']) {
      await page.addStyleTag({path: path.resolve('deploy', file)});
    }
    if (music) {
      await page.addScriptTag({path: path.resolve('deploy/noa-music-vinyl.js')});
      await page.waitForSelector('body.noa-record-room');
    }
    const cards = page.locator(music ? '#songs > .song' : '#yt-videos > .yt-card');
    const boxes = await cards.evaluateAll((nodes, music) => nodes.map(node => {
      const box = el => el.getBoundingClientRect().toJSON();
      const art = music ? [...node.querySelector('.song-select').children].find(el => !el.hidden && !el.matches('.info')) : node.querySelector('.yt-watch img');
      return {card: box(node), art: box(art), title: box(node.querySelector(music ? '.info' : 'h2'))};
    }), music);
    const [first, second] = boxes;
    const context = JSON.stringify({width, music, boxes});
    for (const {card, art, title} of boxes) {
      assert(card.width > 0 && art.width > 0 && card.right <= width + 1, context);
      if (music) {
        assert(Math.abs(art.width - art.height) < 1 && art.width >= card.width * 0.90 && title.top >= art.bottom - 1, context);
      } else {
        assert(Math.abs(art.width * 9 / 16 - art.height) < 1 && title.left > art.right, context);
      }
    }
    if (music) {
      assert(first.card.top === second.card.top && first.card.right < second.card.left, context);
      assert(await cards.first().locator('.sound-play').isVisible() && await cards.first().locator('.jukebox-download').isVisible());
    } else {
      assert(first.card.left === second.card.left && first.card.bottom <= second.card.top + 1, context);
    }
    await cards.last().evaluate(el => { el.hidden = true; });
    assert(await cards.last().isHidden(), 'Filtered results must disappear');
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    console.log(width, music ? 'music albums' : 'YouTube list', 'passed');
  } finally {
    await page.close();
  }
}

(async () => {
  const browser = await chromium.launch({channel: 'chrome', args: ['--no-sandbox']});
  try {
    for (const width of [320, 360, 390, 430, 1280]) {
      for (const music of [true, false]) await check(browser, width, music);
    }
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
