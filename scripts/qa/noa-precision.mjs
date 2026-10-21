import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function auditPrecision(page){
 const result=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
  const visible=e=>e&&!e.hidden&&e.getBoundingClientRect().width>0&&getComputedStyle(e).display!=='none';
  const groups=[...document.querySelectorAll('.noa-balanced')].filter(visible).map(h=>{
   const box=getComputedStyle(h),r=rect(h),left=r.x+parseFloat(box.borderLeftWidth)+parseFloat(box.paddingLeft),right=r.right-parseFloat(box.borderRightWidth)-parseFloat(box.paddingRight);
   const cards=[...h.children].filter(e=>visible(e)&&e.style.gridRow).map(e=>({box:rect(e),row:e.style.gridRow,feature:e.classList.contains('noa-balanced-feature'),image:e.querySelector(':scope>.noa-art,:scope>.yt-watch,:scope>.world-thumbnail')?rect(e.querySelector(':scope>.noa-art,:scope>.yt-watch,:scope>.world-thumbnail')):null,title:e.querySelector('.noa-card-heading,:scope>span>strong,:scope>strong,:scope>h2')?rect(e.querySelector('.noa-card-heading,:scope>span>strong,:scope>strong,:scope>h2')):null,meta:e.querySelector(':scope>small,:scope>p')?rect(e.querySelector(':scope>small,:scope>p')):null}));
   const title=h.closest('.noa-section')?.querySelector('.noa-section-head h2');return{id:h.id||h.className,left,right,gap:parseFloat(box.columnGap),titleX:title?rect(title).x:null,cards};
  });
  const hero=document.querySelector('.noa-hero'),art=document.querySelector('.noa-hero-art'),copy=document.querySelector('.noa-hero-copy'),toggle=document.getElementById('noa-hero-toggle'),video=document.getElementById('noa-hero-video');
  const heroInfo=hero?{box:rect(hero),art:rect(art),copy:rect(copy),toggle:rect(toggle),portrait:innerHeight>innerWidth,fit:getComputedStyle(video).objectFit,muted:video.muted,loop:video.loop}:null;
  const main=document.querySelector('main')||document.querySelector('.noa-g5 #wrapper'),nav=document.querySelector('.noa-mobile-nav'),player=document.querySelector('.noa-transport');
  return{hero:heroInfo,viewport:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,sidebar:visible(document.querySelector('.noa-sidebar')),nav:visible(nav)?rect(nav):null,player:visible(player)?rect(player):null,paddingBottom:main?parseFloat(getComputedStyle(main).paddingBottom):0,groups,debug:document.documentElement.hasAttribute('data-noa-grid-debug')};
 });
 assert(result.scroll<=result.viewport+1,'precision overflow '+result.viewport);
 assert.equal(result.debug,false,'debug rulers leaked');
 for(const g of result.groups){
  if(!g.cards.length)continue;
  assert(Math.abs(g.cards[0].box.x-g.left)<=1,'group left origin '+g.id);
  if(g.titleX!==null)assert(Math.abs(g.titleX-g.left)<=1,'heading/card origin '+g.id);
  for(const c of g.cards){assert(c.box.x>=g.left-1&&c.box.right<=g.right+1,'card bounds '+g.id);if(c.image)assert(Math.abs(c.image.height-c.image.width*9/16)<=1,'video ratio '+g.id);}
  const rows=new Map();for(const card of g.cards.filter(c=>!c.feature)){if(!rows.has(card.row))rows.set(card.row,[]);rows.get(card.row).push(card);}
  for(const row of rows.values()){
   assert(Math.abs(row[0].box.x-g.left)<=1,'partial row origin '+g.id);
   for(let i=1;i<row.length;i++){
    const a=row[i-1],b=row[i];assert(Math.abs(b.box.x-a.box.right-g.gap)<=1,'uneven gap '+g.id);
    assert(Math.abs(a.box.bottom-b.box.bottom)<=1,'row bottom mismatch '+g.id);
    for(const role of ['image','title','meta'])if(a[role]&&b[role])assert(Math.abs(a[role].y-b[role].y)<=1,'role baseline '+role+' '+g.id);
   }
  }
 }
 if(result.hero){const h=result.hero;assert.equal(h.fit,'contain','hero face protection');assert.equal(h.muted,true);assert.equal(h.loop,false);assert(h.toggle.x>=h.art.x&&h.toggle.right<=h.art.right+1&&h.toggle.y>=h.art.y&&h.toggle.bottom<=h.art.bottom+1,'hero control bounds');assert(h.toggle.width>=44&&h.toggle.height>=44);if(h.portrait&&result.viewport<=1024){assert(Math.abs(h.art.x-h.copy.x)<=1&&Math.abs(h.art.width-h.copy.width)<=1,'hero media/copy edges');}if(h.portrait&&result.viewport<=760){assert(h.art.height<=result.height*.48,'oversized portrait hero');assert(h.box.bottom<=(result.nav?.y||result.height)-8,'hero copy under navigation');}}
 const reserved=(result.nav?.height||0)+(result.player?.height||0);
 assert(result.paddingBottom>=reserved+23,'bottom controls overlap content reserve '+JSON.stringify({url:page.url(),viewport:result.viewport,paddingBottom:result.paddingBottom,reserved}));
 if(result.viewport<=1024&&result.height<=500){assert.equal(result.sidebar,false,'landscape sidebar');assert(result.nav,'landscape navigation');}
 return{groups:result.groups.length,maxTolerancePx:1,paddingBottom:result.paddingBottom,reserved,sidebar:result.sidebar,hero:result.hero};
}
export async function verifyPrecisionFlow({context,phase,base,out,report}){
 const samples=[];
 for(const route of ['/','/noa-music.php','/noa-world.php?story=1','/noa-youtube.php','/noa-catalog.php','/noa-my.php']){
  const page=await context.newPage();await page.setViewportSize({width:390,height:844});await page.goto(base+route,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.documentElement.dataset.noaPrecision==='true');if(route==='/')await page.waitForFunction(()=>document.body.dataset.noaHomeReady==='true');
  await page.waitForFunction(()=>document.fonts.status==='loaded');
  for(const size of [{width:390,height:844},{width:844,height:390},{width:568,height:320},{width:390,height:844},{width:1920,height:1080}]){
   await page.setViewportSize(size);await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   samples.push({route,...size,...await auditPrecision(page)});
   if(size.height===390)await page.screenshot({path:path.join(out,'precision-landscape-'+(route.replace(/[^a-z0-9]/gi,'-')||'home')+'.jpg'),type:'jpeg',quality:82});
  }
  if(route==='/'){
   await page.locator('#noa-featured').evaluate(h=>h.style.width='568px');await page.evaluate(()=>window.NoaCardLayout.refresh());
   await page.waitForFunction(()=>document.getElementById('noa-featured').dataset.noaRows==='1+3+3+3');
   const before=await auditPrecision(page);await page.locator('#noa-featured').scrollIntoViewIfNeeded();
   await page.evaluate(()=>window.NoaCardLayout.debug(true));assert.equal(await page.locator('html').getAttribute('data-noa-grid-debug'),'');
   await page.screenshot({path:path.join(out,'precision-debug-rulers.jpg'),type:'jpeg',quality:85});await page.evaluate(()=>window.NoaCardLayout.debug(false));assert.equal(await page.locator('html').getAttribute('data-noa-grid-debug'),null);
   assert.equal((await auditPrecision(page)).groups,before.groups);
   // Isolated UI contract fixture: supplied comparisons only, never persisted to the server.
   await page.evaluate(()=>{const h=document.getElementById('noa-featured'),cards=[...h.children];const data=[{rankState:'up',rank:2,previousRank:5,rankDelta:3},{rankState:'down',rank:5,previousRank:2,rankDelta:-3},{rankState:'same',rank:2,previousRank:2,rankDelta:0},{rankState:'new',rank:7,previousRank:null,rankDelta:null}];data.forEach((v,i)=>window.NoaCardLayout.setMovement(cards[i],v));});
   assert.equal(await page.locator('#noa-featured .noa-rank-badge').count(),4);
   const icons=await page.locator('#noa-featured .noa-rank-badge').evaluateAll(bs=>bs.map(b=>({state:b.dataset.state,color:getComputedStyle(b).color,icon:b.querySelector('svg')?.getBoundingClientRect().width||null})));
   assert(icons.filter(i=>i.icon!==null).every(i=>i.icon===16));assert.notEqual(icons[0].color,icons[1].color);
   await page.screenshot({path:path.join(out,'precision-rank-contract-fixture.jpg'),type:'jpeg',quality:84});
   await page.evaluate(()=>document.querySelectorAll('#noa-featured>a').forEach(c=>window.NoaCardLayout.setMovement(c,null)));assert.equal(await page.locator('#noa-featured .noa-rank-badge').count(),0);
  }
  await page.close();
 }
 await fs.writeFile(path.join(out,'precision-report.json'),JSON.stringify({ok:true,phase,tolerancePx:1,orientationSamples:samples,rankingFixtureOnly:true},null,2));
 report.push({phase,precisionOrientationSamples:samples.length,pixelTolerance:1,rankFixtureOnly:true});
}
