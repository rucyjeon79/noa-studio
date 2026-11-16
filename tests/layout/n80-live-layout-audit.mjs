// N80 read-only visual regression inventory for the live public app.
// GET-only navigation: no login, form submission, playback or production mutation.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const base = (process.env.NOA_LAYOUT_BASE || 'https://noastudio.ai.kr').replace(/\/$/, '');
const out = 'layout-proof/live';
const pages = [
  { id: 'home', route: '/', expectPublic: true },
  { id: 'music', route: '/noa-music.php' },
  { id: 'youtube', route: '/noa-youtube.php' },
  { id: 'world', route: '/noa-world.php' },
  { id: 'sitemap', route: '/noa-sitemap.php', expectPublic: true },
  { id: 'about', route: '/noa-about.php', expectPublic: true },
  { id: 'catalog', route: '/noa-catalog.php' },
];
const viewports = [
  { id: 'phone-small', width: 320, height: 740 },
  { id: 'phone', width: 390, height: 844 },
  { id: 'phone-large', width: 412, height: 915 },
  { id: 'tablet', width: 760, height: 1024 },
  { id: 'phone-landscape', width: 891, height: 411 },
  { id: 'desktop', width: 1024, height: 768 },
  { id: 'wide-desktop', width: 1920, height: 1080 },
];

await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const results = [];

async function inspect(tab) {
  return tab.evaluate(() => {
    const issues = [], advisory = [];
    const root = document.documentElement, body = document.body;
    const vw = window.innerWidth;
    const scrollWidth = Math.max(root.scrollWidth, body?.scrollWidth || 0);
    if (!document.querySelector('main, #container, .noa-main')) issues.push({type:'main_content_missing'});
    const overflow = Math.max(0, scrollWidth - vw);
    if (overflow > 2) issues.push({ type: 'horizontal_overflow', px: Math.round(overflow) });

    const sheet = document.getElementById('noa-design-system');
    const designLoaded = !!sheet?.sheet;
    if (!designLoaded) issues.push({ type: 'shared_design_not_loaded' });

    const visible = el => {
      if (!el?.getClientRects().length) return false;
      const st = getComputedStyle(el);
      return st.display !== 'none' && st.visibility !== 'hidden' && st.opacity !== '0';
    };
    const rect = el => el.getBoundingClientRect();
    if (vw < 1024 && location.pathname === '/' &&
        [...document.querySelectorAll('#noa-ainoa .ainoa-message')].some(visible))
      issues.push({ type: 'unsolicited_compact_message_overlay' });
    const groups = [
      '#noa-account-bar .noa-account-utilities',
      '#noa-account-bar .noa-account-shortcuts',
      '.noa-music-context-nav', '.noa-edit-buttons',
      '.noa-ai-feedback-actions', '.catalog-toolbar', '.creator-actions',
      '.creative-controls', '.noa-record-setup', '.noa-section-head',
      '.np-header'
    ];
    let groupsChecked = 0, controlsChecked = 0;
    for (const selector of groups) {
      for (const group of Array.from(document.querySelectorAll(selector)).slice(0, 10)) {
        if (!visible(group)) continue;
        const bounds = rect(group);
        if (!bounds.width || !bounds.height) continue;
        groupsChecked++;
        if (bounds.left < -2 || bounds.right > vw + 2)
          issues.push({ type: 'group_outside_viewport', group: selector });
        const children = Array.from(group.children).filter(e => {
          if (!visible(e)) return false;
          const p = getComputedStyle(e).position;
          return p !== 'absolute' && p !== 'fixed';
        }).slice(0, 16);
        for (let i = 0; i < children.length; i++) {
          for (let j = i + 1; j < children.length; j++) {
            const a = rect(children[i]), b = rect(children[j]);
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (x > 5 && y > 5) {
              issues.push({ type: 'sibling_overlap', group: selector, area: Math.round(x * y) });
              i = children.length;
              break;
            }
          }
        }
      }
    }

    const importantControls = [
      '.noa-record-setup input:not([type=checkbox]):not([type=radio]):not([type=file])',
      '.noa-record-setup select',
      '.noa-edit-buttons button', '.catalog-toolbar button',
      '.creator-actions button', '.creative-controls button'
    ].join(',');
    for (const el of Array.from(document.querySelectorAll(importantControls)).slice(0, 100)) {
      if (!visible(el)) continue;
      const r = rect(el);
      if (!r.height || !r.width) continue;
      controlsChecked++;
      if (r.height < 42) issues.push({
        type: 'control_too_short',
        control: el.id || el.name || el.className || el.tagName,
        height: Math.round(r.height)
      });
    }

    const stage = root.classList.contains('noa-shell-wide') ? rect(body) : null;
    if (stage && vw >= 1024 && stage.width > Math.min(1920, vw) + 2)
      issues.push({ type: 'stage_too_wide', width: Math.round(stage.width) });

    const footer = document.querySelector('.noa-mobile-footer');
    if (footer && visible(footer)) {
      const r = rect(footer);
      if (r.width > vw + 2) advisory.push({ type: 'footer_wider_than_view', width: Math.round(r.width) });
    }
    const unique = [...new Map(issues.map(i => [JSON.stringify(i), i])).values()];
    return {
      pathname: location.pathname,
      title: document.title,
      viewport: { width: vw, height: window.innerHeight },
      scrollWidth, overflow,
      designLoaded, groupsChecked, controlsChecked,
      issues: unique.slice(0, 30),
      advisory: advisory.slice(0, 10)
    };
  });
}

try {
  for (const v of viewports) {
    const context = await browser.newContext({
      viewport: { width: v.width, height: v.height },
      deviceScaleFactor: 1,
      hasTouch: v.width < 1024,
      isMobile: v.width < 1024
    });
    const tab = await context.newPage();
    for (const p of pages) {
      const entry = { page: p.id, route: p.route, expectPublic: !!p.expectPublic, viewportId: v.id, requestedSize: [v.width, v.height], coverage: 'unverified', issues: [] };
      try {
        const response = await tab.goto(base + p.route, { waitUntil: 'domcontentloaded', timeout: 25000 });
        entry.httpStatus = response?.status() ?? null;
        if (!response || response.status() >= 400)
          entry.issues.push({ type: 'http_error', status: response?.status() ?? null });

        await tab.waitForFunction(() => {
          const link = document.getElementById('noa-design-system');
          return !!link?.sheet || document.readyState === 'complete';
        }, { timeout: 5000 }).catch(() => {});
        await tab.evaluate(() => document.fonts?.ready).catch(() => {});
        await tab.waitForTimeout(p.id === 'home' && v.width < 1024 ? 1200 : 450);
        const layout = await inspect(tab);
        const measuredIssues = layout.issues;
        delete layout.issues;
        const actualViewport = layout.viewport;
        delete layout.viewport;
        Object.assign(entry, layout, { actualViewport });
        entry.issues.push(...measuredIssues);
        const observed = new URL(tab.url()).pathname;
        entry.observedRoute = observed;
        entry.coverage = observed === p.route ? 'verified' :
          /\/(?:noa-login\.php|bbs\/login\.php)$/.test(observed) ? 'login_required' : 'unexpected_redirect';
        const filename = p.id + '-' + v.id;
        await tab.screenshot({
          path: path.join(out, filename + '-top.jpg'),
          type: 'jpeg', quality: 70, fullPage: false, animations: 'disabled', timeout: 15000
        });
        await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await tab.waitForTimeout(200);
        await tab.screenshot({
          path: path.join(out, filename + '-bottom.jpg'),
          type: 'jpeg', quality: 70, fullPage: false, animations: 'disabled', timeout: 15000
        });
      } catch (error) {
        entry.issues.push({ type: 'test_unavailable', reason: String(error.message || error).slice(0, 180) });
      }
      results.push(entry);
      console.log(p.id, v.id, 'issues:', entry.issues.length);
    }
    await context.close();
  }
} finally {
  await browser.close();
}
const verified = results.filter(r => r.coverage === 'verified');
const gaps = results.filter(r => r.coverage !== 'verified');
const failures = verified.filter(r => r.issues.length);
const expectedPublic = results.filter(r => r.expectPublic);
const publicGaps = expectedPublic.filter(r => r.coverage !== 'verified');
const publicFailures = failures.filter(r => r.expectPublic);
const summary = {
  scope: 'public pages, unauthenticated browser, read-only',
  base, attempted: results.length, verified: verified.length, coverageGaps: gaps.length,
  redirected: results.filter(r => r.coverage === 'unexpected_redirect').length,
  expectedPublic: expectedPublic.length,
  verifiedPublic: expectedPublic.length - publicGaps.length,
  publicCoverageGaps: publicGaps.length,
  restrictedUnverified: gaps.filter(r => !r.expectPublic).length,
  loginRequired: results.filter(r => r.coverage === 'login_required').length,
  viewportCount: viewports.length, pageCount: pages.length,
  failures: failures.length,
  acceptance: publicGaps.length ? 'public_page_unverified' :
    publicFailures.length ? 'public_layout_regression' :
    gaps.length ? 'public_layout_pass_restricted_coverage_excluded' : 'verified_public_pass',
  issueCounts: Object.fromEntries(
    [...new Set(results.flatMap(r => r.issues.map(i => i.type)))].map(type =>
      [type, results.reduce((n, r) => n + r.issues.filter(i => i.type === type).length, 0)]
    )
  ),
  caveat: 'No authenticated screens, payment flows, audio playback, image-diff baseline or human visual approval.'
};
await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ summary, results }, null, 2));
console.log('N80_LAYOUT_REPORT', JSON.stringify(summary));
// Fail closed for expected PUBLIC routes. Restricted pages stay explicitly unverified;
// they do not create noisy daily failures for legitimate authentication redirects.
if (publicFailures.length || publicGaps.length) process.exitCode = 1;
