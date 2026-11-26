const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const luminance=color=>{
 const m=color.match(/[\d.]+/g);
 assert(m&&m.length>=3,'invalid color '+color);
 const channels=m.slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722;
};
const contrast=(a,b)=>{const l=[luminance(a),luminance(b)].sort((x,y)=>y-x);return (l[0]+.05)/(l[1]+.05);};
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  for(const width of [390,768,1440]){
   const page=await browser.newPage({viewport:{width,height:900}});
   await page.goto('https://skhnslu-busan.com/',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>document.querySelector('.busan-noa-menu-card .busan-noa-menu-entry'),{},{timeout:20000});
   const result=await page.evaluate(()=>{
    const card=document.querySelector('.busan-noa-menu-card');
    const entry=card.querySelector('.busan-noa-menu-entry');
    const subscription=card.querySelector('.busan-noa-menu-subscribe');
    const root=document.documentElement;
    const original=root.getAttribute('data-busan-theme');
    const originalDark=root.classList.contains('darkMode');
    const actions=[entry,subscription];
    const hrefs=actions.map(el=>el?.getAttribute('href'));
    const ink=el=>{const s=getComputedStyle(el);return {color:s.color,fill:s.webkitTextFillColor,background:s.backgroundColor,opacity:s.opacity};};
    const snapshot=()=>({card:ink(card),captionHidden:[...card.querySelectorAll('.busan-noa-menu-title')].every(el=>getComputedStyle(el).display==='none'),
      captionCount:card.querySelectorAll('.busan-noa-menu-title').length,
      buttons:actions.map(el=>({ ...ink(el), minHeight:getComputedStyle(el).minHeight,
        textNodes:[...el.querySelectorAll('span,strong,b,i,small,em,label,div,p')].filter(n=>n.textContent.trim()).map(ink)})),
      staticText:[...card.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,strong,b,small,em,div')].filter(el=>!el.closest('a,button,[role="button"],audio,video,iframe,.busan-noa-menu-title')&&!el.querySelector('a,button,[role="button"],audio,video,iframe')&&el.textContent.trim()).map(ink)});
    // Simulate both native states, including its legacy high-specificity dark rules.
    root.classList.remove('darkMode');root.setAttribute('data-busan-theme','light');const light=snapshot();
    root.classList.add('darkMode');root.setAttribute('data-busan-theme','dark');const dark=snapshot();
    root.classList.remove('darkMode');root.setAttribute('data-busan-theme','light');const restored=snapshot();
    root.classList.toggle('darkMode',originalDark);
    if(original===null)root.removeAttribute('data-busan-theme');else root.setAttribute('data-busan-theme',original);
    return {light,dark,restored,entry:entry.textContent.trim(),subscription:!!subscription,hrefsPreserved:actions.every((el,i)=>el.getAttribute('href')===hrefs[i]),outside:!card.closest('#bo_v_con,.boardViewWrap,.boardListWrap'),menuUnaffected:!card.querySelector('a[href*="bo_table="]')};
   });
   assert(result.outside&&result.menuUnaffected&&result.subscription&&result.hrefsPreserved,'correct narrow external music card');
   assert.equal(result.entry,'NOA STUDIO 바로가기');
   assert.notEqual(result.light.card.background,result.dark.card.background,'theme card background');
   assert.notEqual(result.light.buttons[0].background,result.dark.buttons[0].background,'theme action background');
   assert.deepEqual(result.light,result.restored,'theme round trip');
   for(const theme of ['light','dark']){
     const v=result[theme];
     assert(v.captionCount>0&&v.captionHidden,'retired caption visible');
     assert(contrast(v.card.fill,v.card.background)>=4.5,'card text contrast '+theme);
     for(const b of v.buttons){
       assert(parseFloat(b.minHeight)>=44,'touch target');
       assert(contrast(b.fill,b.background)>=4.5,'button text contrast '+theme+' '+JSON.stringify(b));
       assert(contrast(b.color,b.background)>=4.5,'button color contrast '+theme);
       for(const n of b.textNodes)assert(contrast(n.fill,b.background)>=4.5,'nested text contrast '+theme);
     }
     for(const n of v.staticText)assert(contrast(n.fill,v.card.background)>=4.5,'static text contrast '+theme);
   }
   console.log('PASS live NOA caption hidden, round-trip theme and AA text contrast',width,JSON.stringify({light:result.light.buttons.map(b=>contrast(b.fill,b.background)),dark:result.dark.buttons.map(b=>contrast(b.fill,b.background))}));
   await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
