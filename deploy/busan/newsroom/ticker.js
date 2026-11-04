(() => {
  const template = document.getElementById('bn-news-template');
  const hero = document.querySelector('#contentsWrap > .kvWrap');
  if (!template || !hero || document.getElementById('bn-news-strip')) return;
  hero.after(template.content.cloneNode(true));
  const strip = document.getElementById('bn-news-strip');
  const link = strip.querySelector('.bn-news-link');
  const label = link.firstElementChild;
  const button = strip.querySelector('button');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let items = [], index = 0, animation, timer, paused = false, hovering = false;
  function stop() { clearTimeout(timer); if (animation) animation.cancel(); animation = null; }
  function next() { index = (index + 1) % items.length; render(); }
  function advance() {
    stop();
    if (!items.length || paused || hovering || link.matches(':focus') || document.hidden || motion.matches) return;
    const width = link.clientWidth, textWidth = label.offsetWidth;
    const offset = Math.max(0, textWidth - width);
    timer = setTimeout(() => {
      const time = Math.max(6000, (width + textWidth) * 23);
      animation = label.animate([{transform:'translateX(0)'},{transform:'translateX(-'+(textWidth+8)+'px)'}],
        {duration:time, easing:'linear', fill:'forwards'});
      animation.onfinish = next;
    }, offset ? 1100 : 2400);
  }
  function render() {
    stop(); const item = items[index];
    if (item) { link.href=item.url; label.textContent=item.title; link.title=item.title; }
    button.hidden=!items.length;
    const desc=motion.matches ? '다음 뉴스 제목' : paused ? '뉴스 흐름 재생' : '뉴스 흐름 일시정지';
    button.textContent=motion.matches ? '›' : paused ? '▶' : 'Ⅱ';
    button.setAttribute('aria-label',desc); button.title=desc;
    advance();
  }
  async function refresh() {
    try {
      const response=await fetch(strip.dataset.feed,{cache:'no-store'});
      if(!response.ok) return;
      const fresh=await response.json();
      if(!Array.isArray(fresh)) return;
      const current=items[index]?.id;
      const old=items.map(x=>[x.id,x.title]).join('|');
      if(items.length && old===fresh.map(x=>[x.id,x.title]).join('|')) return;
      items=fresh;index=Math.max(0,items.findIndex(x=>x.id===current));
      if(!items.length){link.href=strip.querySelector('.bn-news-all').href;label.textContent='최근 한 달 새 소식이 없습니다';}
      render();
    } catch (_) { /* Keep the last good edition and the board link. */ }
  }
  button.addEventListener('click',()=>{if(motion.matches && items.length)next();else{paused=!paused;render();}});
  link.addEventListener('focus',stop); link.addEventListener('blur',advance);
  link.addEventListener('mouseenter',()=>{hovering=true;stop();});
  link.addEventListener('mouseleave',()=>{hovering=false;advance();});
  motion.addEventListener('change',render);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();advance();});
  new ResizeObserver(advance).observe(link);
  refresh();setInterval(()=>{if(!document.hidden)refresh();},60000);
})();
