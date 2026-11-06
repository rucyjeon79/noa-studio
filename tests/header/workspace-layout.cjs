const assert = require('node:assert/strict');
const {existsSync, mkdirSync} = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright');
const fixture = process.argv[2];
const proof = 'workspace-layout-proof';
mkdirSync(proof, {recursive: true});

async function main() {
  const browser = await chromium.launch({channel: 'chrome', args: ['--no-sandbox']});
  try {
    for (const theme of ['noa-ivory', 'noa-studio']) {
      const context = await browser.newContext({serviceWorkers: 'block'});
      await context.addInitScript(t => {
        localStorage.setItem('noa-ui-selection', JSON.stringify({theme: t, language: 'ko', design: 'ios', radius: 'soft'}));
      }, theme);
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        const module = url.pathname.match(/^\/noa-app\/(taxonomy|popularity|database|jukebox)\/$/)?.[1];
        if (module && route.request().method() === 'GET') return route.fulfill({path: path.join(fixture, module + '.html'), contentType: 'text/html; charset=utf-8'});
        if (module) {
          const data = {ok: true, latest: null, connection: {connected:true,version:'8.0',readOnly:1,timeoutMs:3000}, tableCount:5, statistics:{}, policy: {revision: 1, values: {}}, categories: [{category_id: 'story', name: '사연곡', enabled: 1}], rules: [], history: [], productionRules: [], productionHistory: [], relations: [], review: [], logs: [], counts: [{name:'사연곡',songs:48}, {name:'커버곡',songs:37}]};
          return route.fulfill({json: data});
        }
        if (url.pathname === '/noa-bridge/ui-preferences.php') return route.fulfill({json: {member: true, settings: {theme,language:'ko',design:'ios',radius:'soft'}, revision: 1}});
        if (url.pathname === '/noa-assets/papa-logo.png') return route.fulfill({path: 'public/papa-logo.png'});
        const file = path.join('deploy', url.pathname);
        if (/\.(?:css|js|png|woff2|json)$/.test(file) && existsSync(file)) return route.fulfill({path: file});
        return route.fulfill({json: {member: true, ok: true}});
      });
      const page = await context.newPage();
      for (const module of ['taxonomy','popularity','database','jukebox']) {
        await page.goto('https://noa.test/noa-app/' + module + '/');
        await page.waitForFunction(t => document.documentElement.dataset.noaTheme === t,theme);
        await page.getByRole('link',{name:'MY',exact:true}).waitFor();
        if (module === 'database') await page.getByText('자료 저장소 연결 상태 확인 완료',{exact:true}).waitFor();
        if (module === 'taxonomy') await page.getByText('저장된 자료 연결 완료', {exact:true}).waitFor();
        for (const width of [320,360,390,430,768,1280]) {
          await page.setViewportSize({width,height:850});
          const state = await page.evaluate(() => {
            const rect = el => el.getBoundingClientRect().toJSON();
            const rects = selector => Array.from(document.querySelectorAll(selector),rect);
            return {
              header: rect(document.querySelector('#noa-account-bar')),
              buttons: ['#noa-nav-all','.noa-account-brand','#noa-nav-back','#noa-nav-top','#noa-nav-account'].map(s => rect(document.querySelector('#noa-account-bar '+s))),
              nav: rects('main.noa-admin-workspace>header nav a'), actions: rects('main.noa-admin-workspace>.actions>button'),
              tools: rects('main>form.batch>button, main>.tabs>button'),
              metrics: rects('#counts>.metric'), guide: document.querySelector('main>.noa-workspace-guide') && getComputedStyle(document.querySelector('main>.noa-workspace-guide')).position,
              pageWidth: document.documentElement.scrollWidth
            };
          });
          const trace = JSON.stringify({module,width,theme,state});
          assert(state.pageWidth <= width && state.header.height <= 65,trace);
          const center = r => r.y + r.height/2;
          for (const [i,b] of state.buttons.entries()) {
            assert(b.width >= 44 && b.height >= 44 && b.x >= 0 && b.right <= width + 0.5,trace);
            assert(Math.abs(center(b)-center(state.buttons[0])) < 1 && (!i || state.buttons[i-1].right <= b.left + 0.5),trace);
          }
          const last = state.buttons.at(-1);
          assert(width - last.right <= 34,trace);
          if (state.guide) assert(['static','relative'].includes(state.guide),trace);
          if (width <= 600 && state.nav.length) {
            for (const [i,b] of state.nav.entries()) {
              assert(b.height >= 44 && Math.abs(b.width-state.nav[0].width)<1,trace);
              if (i%2) assert(b.top === state.nav[i-1].top && b.left >= state.nav[i-1].right + 4,trace);
            }
            assert(Math.abs(state.nav[0].left-state.actions[0].left)<1 && Math.abs(state.nav[1].right-state.actions.at(-1).right)<1,trace);
            const [a,b] = state.actions.slice(-2);
            assert(a.top === b.top && a.right < b.left && Math.abs(a.width-b.width)<1,trace);
            if (state.metrics.length) assert(Math.abs(state.metrics[0].width-state.metrics[1].width)<1 && state.metrics[0].top===state.metrics[1].top,trace);
          }
          if (width <= 600 && state.tools.length) {
            for (let i = 1; i < state.tools.length; i += 2) {
              const left = state.tools[i-1], right = state.tools[i];
              assert(left.height >= 44 && left.top === right.top && left.right < right.left && Math.abs(left.width-right.width)<1,trace);
            }
          }
          if (width === 390) await page.screenshot({path: proof+'/'+module+'-'+theme+'.png'});
        }
        console.log(theme, module, 'OK');
      }
      await context.close();
    }
  } finally { await browser.close(); }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
