(() => {
  'use strict';
  const text = el => (el.textContent || '').replace(/\s+/g, ' ').trim();
  const exact = (root, label) => [...root.querySelectorAll('a,button,[role="button"],span,div,p,strong,h1,h2,h3,h4,h5')]
    .filter(el => text(el) === label && ![...el.children].some(child => text(child) === label));
  function mark() {
    const links = exact(document, 'NOA STUDIO 바로가기');
    if (!links.length) return false;
    let found = false;
    for (const label of links) {
      const entry = label.closest('a,button,[role="button"]') || label;
      // Only the menu's external-music area: do not style article content.
      if (entry.closest('#bo_v_con,.boardViewWrap,.boardListWrap,footer')) continue;
      let box = entry.parentElement;
      let fallback = null, chosen = null;
      for (let i = 0; box && i < 6; i++, box = box.parentElement) {
        if (box.matches('body,html,#contentsWrap,.wrap,.sideWrap,.sideGnb,nav,ul') ||
            box.querySelector('.sideGnb,.boardListWrap,.grid-container,#contentsWrap') ||
            box.querySelector('a[href*="bo_table="]') ||
            text(box).length > 420) break;
        const hasHeading = text(box).includes('YouTube Music Hi-Fi Player');
        const sub = [...box.querySelectorAll('a,button,[role="button"]')].find(el =>
          /Ainoa\s*구독하기/i.test(text(el)));
        if (sub) fallback = box;
        if (hasHeading && sub) {chosen = box; break;}
        if (hasHeading) chosen = box;
      }
      const card = chosen || fallback;
      if (!card || card === entry) continue;
      card.classList.add('busan-noa-menu-card');
      entry.classList.add('busan-noa-menu-entry');
      for (const title of exact(card, 'YouTube Music Hi-Fi Player')) title.classList.add('busan-noa-menu-title');
      for (const sub of card.querySelectorAll('a,button,[role="button"]')) {
        if (/Ainoa\s*구독하기/i.test(text(sub))) sub.classList.add('busan-noa-menu-subscribe');
      }
      found = true;
    }
    return found;
  }
  function start() {
    mark();
    let pending = false;
    const observer = new MutationObserver(() => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {pending = false; mark();});
    });
    // Drawer widgets can be mounted later. Only observe insertion/removal,
    // never attributes (including our own classes or theme changes).
    observer.observe(document.body, {childList:true,subtree:true});
    window.addEventListener('pagehide', () => observer.disconnect(), {once:true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
