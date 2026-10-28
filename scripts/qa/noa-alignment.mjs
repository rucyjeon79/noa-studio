import {chromium,webkit} from 'playwright';
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='alignment-proof',base='http://127.0.0.1:8079',report=[];
mkdirSync(out,{recursive:true});
const server=spawn('php',['-S','127.0.0.1:8079','-t','/tmp/noa-pwa-fixture','/tmp/noa-pwa-fixture/router.php'],{stdio:'ignore'});
let browser;
try{
 for(const engine of ['chromium','webkit']){
  browser=await(engine==='webkit'?webkit.launch():chromium.launch({channel:'chrome',args:['--no-sandbox']}));
  for(const width of engine==='webkit'?[390]:[320,390,1280])for(const theme of ['noa-studio','noa-ivory']){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
   await context.addCookies([{name:'qa_role',value:'admin',url:base}]);
   await context.addInitScript(t=>localStorage.setItem('noa-ui-selection',JSON.stringify({theme:t,language:'ko',design:'ios',radius:'soft'})),theme);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/monthly-collections.php?genre=kpop-original');
   await page.locator('.noa-inline-act>.noa-engagement button').first().waitFor();
   const collections=await page.locator('.noa-inline-act').evaluateAll(rows=>rows.map(row=>{
    const b=s=>row.querySelector(s)?.getBoundingClientRect(),title=b('.noa-browse-card strong'),copy=b('.noa-browse-card>span'),cover=b('.noa-browse-card>img'),heart=b(':scope>.noa-engagement svg'),tool=b('.noa-collection-tools button');
    return {textX:title.x,heartX:heart.x,coverX:cover.x,coverTop:cover.y,textTop:title.y,toolTop:tool.y,toolX:tool.x,coverWidth:cover.width,gap:heart.y-copy.bottom};
   }));
   for(const row of collections){assert(Math.abs(row.textX-row.heartX)<1,JSON.stringify(row));assert(Math.abs(row.coverTop-row.textTop)<1,JSON.stringify(row));assert(Math.abs(row.coverTop-row.toolTop)<1,JSON.stringify(row));assert.equal(row.coverWidth,44);assert(row.gap>=0&&row.gap<=6,JSON.stringify(row));assert(Math.abs(row.toolX-collections[0].toolX)<1);}
   await page.locator('.noa-inline-act').first().scrollIntoViewIfNeeded();
   if(await page.locator('.ainoa-message').isVisible())await page.locator('.ainoa-message').waitFor({state:'hidden',timeout:12000});
   await page.screenshot({path:`${out}/collections-${engine}-${width}-${theme}.png`});
   await page.getByRole('button',{name:'ACT 1 수록곡 목록 펼치기',exact:true}).click();
   const detail=page.locator('.noa-inline-act').first().locator('[data-browse-level="4"]');
   await detail.locator('.noa-inline-video-row>.noa-engagement button').first().waitFor();
   const songs=await detail.locator('.noa-inline-video-row').evaluateAll(rows=>rows.map(row=>{
    const b=s=>row.querySelector(s).getBoundingClientRect(),title=b('.noa-inline-title'),cover=b('.noa-inline-cover'),heart=b('.noa-engagement svg'),tool=b('.noa-song-more');
    const rect=row.getBoundingClientRect();return {textX:title.x,heartX:heart.x,coverX:cover.x,top:cover.top-rect.top,bottom:rect.bottom-cover.bottom,height:rect.height,y:rect.y,bottomY:rect.bottom,toolX:tool.x,gap:heart.y-title.bottom};
   }));
   assert.equal(songs.length,10);
   for(let i=1;i<songs.length;i++)assert(Math.abs(songs[i].y-songs[i-1].bottomY)<1,'video dividers must have symmetric row insets');
   for(const row of songs){assert(Math.abs(row.textX-row.heartX)<1,JSON.stringify(row));assert(Math.abs(row.top-row.bottom)<1,JSON.stringify(row));assert(Math.abs(row.height-songs[0].height)<1,JSON.stringify(row));assert(Math.abs(row.coverX-collections[0].coverX)<1,JSON.stringify({row,collection:collections[0]}));assert(row.gap>=0&&row.gap<=8,JSON.stringify(row));assert(Math.abs(row.toolX-songs[0].toolX)<1);}
   await detail.scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/songs-${engine}-${width}-${theme}.png`});
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));
   await page.goto(base+'/noa-world.php?story=1');
   const tabs=page.locator('[aria-label="EP 선택"] a');await tabs.last().waitFor();
   const cells=await tabs.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
   assert.equal(cells.length,10);assert(cells.every(c=>c.width>=44&&c.height>=44&&Math.abs(c.width-cells[0].width)<1));
   assert.equal(new Set(cells.map(c=>c.y)).size,width<760?2:1);
   await page.getByRole('link',{name:'EP.1',exact:true}).click();
   const chapter=page.locator('#ep-1');const buttons=await chapter.locator(':scope>details>summary,:scope>a.noa-action').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};}));
   assert.equal(buttons.length,2);assert(Math.abs(buttons[0].width-buttons[1].width)<1&&Math.abs(buttons[0].y-buttons[1].y)<1,JSON.stringify(buttons));
   await chapter.locator('summary').click();assert(await chapter.locator('details').getAttribute('open')!==null);await chapter.locator('summary').click();
   if(await page.locator('.ainoa-message').isVisible())await page.locator('.ainoa-message').waitFor({state:'hidden',timeout:12000});
   await page.screenshot({path:`${out}/chapter-${engine}-${width}-${theme}.png`});
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));assert.deepEqual(errors,[]);
   await page.goto(base+'/');await page.locator('#noa-featured .noa-engagement').first().waitFor();
   const cards=await page.locator('#noa-featured .noa-engagement-card').evaluateAll(es=>es.map(e=>{
    const b=s=>e.querySelector(s).getBoundingClientRect(),title=b('strong'),meta=b('.noa-card-meta'),heart=b('.noa-engagement svg');
    return{top:e.getBoundingClientRect().top,titleTop:title.top,titleHeight:title.height,metaTop:meta.top,gap:meta.top-title.bottom,heartY:heart.y,heartX:heart.x,titleX:title.x};
   }));
   assert.equal(cards.length,10);
   for(const c of cards){assert.equal(c.titleHeight,20);assert(c.gap>=0&&c.gap<=5,JSON.stringify(c));assert(Math.abs(c.heartX-c.titleX)<1,JSON.stringify(c));const peer=cards.find(p=>Math.abs(p.top-c.top)<1);assert(Math.abs(peer.heartY-c.heartY)<1,JSON.stringify({peer,c}));}
   const banners=await page.locator('[data-home-banner]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{kind:e.dataset.homeBanner,after:e.previousElementSibling?.dataset.homeSection,url:e.href,target:e.target,rel:e.rel,x:r.x,width:r.width,height:r.height,icon:!!e.querySelector('svg'),overflow:e.scrollWidth>e.clientWidth};}));
   assert.deepEqual(banners.map(b=>[b.kind,b.after]),[['goods','notices'],['youtube','world'],['amt','collections']]);
   assert.equal(banners[0].url,'https://marpple.shop/kr/jr_lifestyle');assert.equal(banners[1].url,'https://youtube.com/@ainoa_ramjunpapa?sub_confirmation=1');assert.equal(banners[2].url,'https://www.aimusictown.com/creators/ainoa');
   for(const b of banners){assert(b.icon&&!b.overflow&&b.target==='_blank'&&b.rel.includes('noopener'));assert(Math.abs(b.x-banners[0].x)<1&&Math.abs(b.width-banners[0].width)<1&&Math.abs(b.height-banners[0].height)<1,JSON.stringify(banners));}
   if(await page.locator('.ainoa-message').isVisible())await page.locator('.ainoa-message').waitFor({state:'hidden',timeout:16000});
   if(width===390)for(const b of banners)await page.locator('[data-home-banner='+b.kind+']').screenshot({path:`${out}/banner-${b.kind}-${engine}-${theme}.png`});
   await page.getByRole('heading',{name:'추천 음악',exact:true}).click();await page.screenshot({path:`${out}/home-${engine}-${width}-${theme}.png`});
   assert(!await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth));assert.deepEqual(errors,[]);
   report.push({engine,width,theme,collections,songs,epCells:cells,chapterButtons:buttons,cards,banners});await context.close();
  }
  await browser.close();browser=null;
 }
}finally{if(browser)await browser.close();server.kill();writeFileSync(out+'/report.json',JSON.stringify(report,null,2));}
console.log('SHARED_COLUMNS_AND_EP_ALIGNMENT_OK',report.length);
