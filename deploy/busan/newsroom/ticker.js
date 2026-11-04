(() => {
  const template = document.getElementById('bn-news-template');
  const hero = document.querySelector('#contentsWrap > .kvWrap');
  if (!template || !hero || document.getElementById('bn-news-strip')) return;
  hero.after(template.content.cloneNode(true));
  const strip = document.getElementById('bn-news-strip');
  const track = strip.querySelector('.bn-news-track');
  const button = strip.querySelector('button');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let signature, paused = false, loading = false;

  function setMode() {
    strip.classList.toggle('bn-still', motion.matches);
    strip.classList.toggle('bn-paused', paused);
    button.textContent = paused ? '▶' : 'Ⅱ';
    button.title = paused ? '뉴스 흐름 재생' : '뉴스 흐름 일시정지';
    button.setAttribute('aria-label', button.title);
    button.hidden = motion.matches || !track.querySelector('.bn-news-group');
  }

  function setSpeed() {
    const group = track.querySelector('.bn-news-group');
    if (group) track.style.setProperty('--bn-cycle', Math.max(1, group.offsetWidth / 40) + 's');
  }

  function render(items) {
    const group = document.createElement('div');
    group.className = 'bn-news-group';
    for (const item of items) {
      const link = document.createElement('a');
      link.className = 'bn-news-link';
      link.href = item.url;
      link.textContent = item.title;
      group.append(link);
    }
    if (items.length) {
      const copy = group.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      for (const link of copy.children) link.tabIndex = -1;
      track.replaceChildren(group, copy);
      setSpeed();
    } else {
      track.textContent = '최근 한 달 새 소식이 없습니다';
    }
    setMode();
  }

  async function refresh() {
    if (loading || track.contains(document.activeElement)) return;
    loading = true;
    try {
      const response = await fetch(strip.dataset.feed, {cache:'no-store'});
      if (!response.ok) return;
      const items = await response.json();
      if (!Array.isArray(items)) return;
      const next = JSON.stringify(items);
      if (next !== signature && !track.contains(document.activeElement)) {
        render(items);
        signature = next;
      }
    } catch (_) { /* Keep the last good edition or the board link. */ }
    finally { loading = false; }
  }

  button.addEventListener('click', () => { paused = !paused; setMode(); });
  motion.addEventListener('change', setMode);
  new ResizeObserver(setSpeed).observe(strip.querySelector('.bn-news-window'));
  document.fonts.ready.then(setSpeed);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
})();
