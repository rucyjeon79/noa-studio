(()=>{
 const selectors=['#noa-account-bar','.noa-mobile-nav','.noa-mobile-nav a','main','#music-browse','.noa-section-navigation'];
 const props=['display','fontFamily','fontSize','fontWeight','lineHeight','color','backgroundColor','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft','gap'];
 const nodes={};
 for(const selector of selectors)nodes[selector]=[...document.querySelectorAll(selector)].filter(el=>el.getBoundingClientRect().height>0).map(el=>{
  const r=el.getBoundingClientRect(),css=getComputedStyle(el);
  return {box:{x:r.x,width:r.width,...(selector.includes('nav')||selector==='#noa-account-bar'?{height:r.height}:{})},style:Object.fromEntries(props.map(p=>[p,css[p]])),...(el.matches('a')?{text:el.textContent.trim(),href:new URL(el.href).pathname}:{})};
 });
 return {url:location.href,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},theme:document.documentElement.dataset.noaTheme,overflow:document.documentElement.scrollWidth>innerWidth+1,nodes,assets:[...document.querySelectorAll('script[src],link[rel=stylesheet]')].map(el=>el.src||el.href).filter(url=>url.startsWith(location.origin)).sort()};
})()
