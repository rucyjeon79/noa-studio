(() => {
  const template = document.getElementById('bn-news-template');
  const hero = document.querySelector('#contentsWrap > .kvWrap');
  if (!template || !hero || document.getElementById('bn-news-strip')) return;
  hero.after(template.content.cloneNode(true));
  const strip = document.getElementById('bn-news-strip');
  const track = strip.querySelector('.bn-news-track');
  const button = strip.querySelector('button');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const viewport = strip.querySelector('.bn-news-window');
  let signature, loading = false, animation, distance = 0;
  let hovering = false, keyboard = false, tabbing = false;

  function prefersStill() {
    try { return motion.matches && localStorage.getItem('bn-reduced-motion-play') !== 'yes'; }
    catch (_) { return motion.matches; }
  }
  let still = prefersStill(), paused = still;

  function setMode() {
    const staticList = still || keyboard;
    strip.classList.toggle('bn-still', staticList);
    if (animation) {
      if (staticList) animation.currentTime = 0;
      if (paused || hovering || staticList || document.hidden) animation.pause();
      else animation.play();
    }
    button.textContent = paused ? '▶' : 'Ⅱ';
    button.title = paused ? '뉴스 흐름 재생' : '뉴스 흐름 일시정지';
    button.setAttribute('aria-label', button.title);
    button.hidden = !track.querySelector('.bn-news-group');
  }

  function setSpeed() {
    const group = track.querySelector('.bn-news-group');
    const width = group ? group.getBoundingClientRect().width : 0;
    if (width === distance) return;
    const time = animation ? Number(animation.currentTime) : 0;
    if (animation) animation.cancel();
    distance = width;
    animation = width ? track.animate([
      {transform:'translate3d(0,0,0)'}, {transform:'translate3d(-' + width + 'px,0,0)'}
    ], {duration:width * 25, iterations:Infinity, easing:'linear'}) : null;
    if (animation) animation.currentTime = time % (width * 25);
    setMode();
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
    } else {
      track.textContent = '최근 한 달 새 소식이 없습니다';
    }
    setSpeed();
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

  button.addEventListener('click', () => {
    paused = !paused;
    if (motion.matches) {
      still = paused;
      try {
        if (paused) localStorage.removeItem('bn-reduced-motion-play');
        else localStorage.setItem('bn-reduced-motion-play', 'yes');
      } catch (_) { /* The choice still applies for this visit. */ }
    }
    if (!paused) viewport.scrollLeft = 0;
    setMode();
  });
  const onMotionChange = () => { still = prefersStill(); paused = still; setMode(); };
  if (motion.addEventListener) motion.addEventListener('change', onMotionChange);
  else motion.addListener(onMotionChange);

  viewport.addEventListener('pointerenter', event => {
    hovering = event.pointerType === 'mouse' && matchMedia('(hover: hover) and (pointer: fine)').matches;
    setMode();
  });
  viewport.addEventListener('pointerleave', () => { hovering = false; setMode(); });
  viewport.addEventListener('pointerdown', () => { keyboard = false; hovering = false; setMode(); });
  viewport.addEventListener('focusin', () => {
    keyboard = tabbing;
    setMode();
  });
  viewport.addEventListener('focusout', event => {
    if (!viewport.contains(event.relatedTarget) && keyboard) {
      keyboard = false;
      viewport.scrollLeft = 0;
      setMode();
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Tab') tabbing = true;
  });
  document.addEventListener('pointerdown', () => { tabbing = false; }, true);

  if ('ResizeObserver' in window) new ResizeObserver(setSpeed).observe(viewport);
  else window.addEventListener('resize', setSpeed);
  if (document.fonts) document.fonts.ready.then(setSpeed);
  document.addEventListener('visibilitychange', () => { setMode(); if (!document.hidden) refresh(); });
  window.addEventListener('pageshow', () => { hovering = false; setSpeed(); setMode(); refresh(); });
  refresh();
  setInterval(() => { if (!document.hidden) refresh(); }, 60000);
})();
