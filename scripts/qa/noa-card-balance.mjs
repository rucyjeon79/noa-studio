/* Browser evidence for count/width changes using copies of observed public cards; no server writes. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifyCardBalance({context,phase,base,out,report}){
 const cases=[];
 for(const width of [320,390,430,768,1024,1280,1920]){
  const page=await context.newPage();await page.setViewportSize({width,height:1000});
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.body.dataset.noaHomeReady==='true'&&window.NoaCardLayout&&document.querySelector('#noa-featured.noa-balanced'));
  const originals=await page.locator('#noa-featured > a').evaluateAll(cards=>cards.map(c=>({video:c.dataset.video,href:c.getAttribute('href'),text:c.textContent})));
  assert(originals.length===10);
  await page.evaluate(()=>{const h=document.createElement('section');h.id='balance-count-fixture';h.setAttribute('aria-label','카드 수별 검증');document.querySelector('main').prepend(h);window.__balanceCards=[...document.querySelectorAll('#noa-featured>a')].map(c=>c.cloneNode(true));});
  for(const count of [3,4,5,6,7,8,9,10]){
   await page.evaluate(n=>{const h=document.getElementById('balance-count-fixture');h.replaceChildren();const g=document.createElement('div');g.className='noa-card-grid';g.id='balance-sample';g.append(...window.__balanceCards.slice(0,n).map(c=>c.cloneNode(true)));h.append(g);window.NoaCardLayout.refresh();},count);
   await page.waitForFunction(n=>{const h=document.getElementById('balance-sample');return h.dataset.noaRows&&h.dataset.noaRows.split('+').reduce((s,v)=>s+Number(v),0)===n;},count);
   const result=await measure(page);
   validate(result,count,originals);
   cases.push({width,count,...result});
   if(count===7||count===9||count===10){await page.locator('#balance-sample').scrollIntoViewIfNeeded();await settleImages(page,'#balance-sample');await page.screenshot({path:path.join(out,'balance-'+count+'-'+width+'.jpg'),type:'jpeg',quality:82});}
  }
  if(width===1280){
   await page.locator('#balance-sample').evaluate(h=>{h.style.width='568px';window.NoaCardLayout.refresh();});
   await page.waitForFunction(()=>document.getElementById('balance-sample').dataset.noaRows==='2+2+2+2+2');
   const result=await measure(page);validate(result,10,originals);assert.equal(result.featured,false);
   const first=page.locator('#balance-sample>a').first();await first.focus();assert.equal(await first.evaluate(e=>document.activeElement===e),true);
   await settleImages(page,'#balance-sample');await page.screenshot({path:path.join(out,'balance-compact-container-two-columns-1280.jpg'),type:'jpeg',quality:85});
   const href=await first.getAttribute('href'),id=await first.getAttribute('data-video');await first.click();
   await page.waitForURL(base+href);await page.waitForFunction(id=>document.getElementById('yt-frame')?.src.includes('/embed/'+id),id);
   assert.equal(await page.locator('#yt-frame').count(),1);
   cases.push({width,count:10,constrainedContainer:true,linkAndPlayer:true,...result});
  }
  await page.close();
 }
 // Compact menus must never acquire media presentation; changing their count rebalances them.
 const menuPage=await context.newPage();await menuPage.setViewportSize({width:768,height:900});await menuPage.goto(base+'/noa-my.php');
 await menuPage.waitForFunction(()=>window.NoaCardLayout);
 await menuPage.evaluate(()=>{const menu=document.createElement('nav');menu.id='balance-menu';menu.className='noa-workspace';for(let n=0;n<10;n++){const a=document.createElement('a');a.href='#menu-'+n;a.textContent='메뉴 '+(n+1);menu.append(a);}document.querySelector('main').prepend(menu);window.NoaCardLayout.refresh();});
 await menuPage.waitForFunction(()=>document.getElementById('balance-menu').dataset.noaRows);
 assert.equal(await menuPage.locator('#balance-menu .noa-balanced-feature').count(),0);
 await menuPage.close();
 await fs.writeFile(path.join(out,'card-balance-report.json'),JSON.stringify({ok:true,phase,fixture:'Observed public cards copied in browser memory only',cases},null,2));
 report.push({phase,cardBalanceCases:cases.length,menuFeatured:false});
}
async function measure(page){return page.locator('#balance-sample').evaluate(h=>{
 const cards=[...h.children],rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};
 return{rows:h.dataset.noaRows,columns:Number(h.dataset.noaColumns),featured:cards[0].classList.contains('noa-balanced-feature'),host:rect(h),gap:parseFloat(getComputedStyle(h).columnGap),viewport:innerWidth,scroll:document.documentElement.scrollWidth,cards:cards.map(c=>({...rect(c),video:c.dataset.video,href:c.getAttribute('href'),text:c.textContent}))};
 });}
function validate(result,count,originals){
 assert(result.scroll<=result.viewport+1,'horizontal overflow');assert.equal(result.cards.length,count);
 const sizes=result.rows.split('+').map(Number);assert.equal(sizes.reduce((s,v)=>s+v,0),count);
 if(result.columns>1)assert(sizes.slice(result.featured?1:0).every(n=>n>1),'orphan row');
 for(let i=0;i<count;i++){const c=result.cards[i];assert.equal(c.video,originals[i].video);assert.equal(c.href,originals[i].href);assert.equal(c.text,originals[i].text);assert(c.width>=132&&c.height>=44);assert(c.x>=result.host.x-1&&c.right<=result.host.right+1);}
 if(result.featured){assert(Math.abs(result.cards[0].x-result.host.x)<=1,'featured left origin');assert(Math.abs(result.cards[0].width-(result.cards[1].width*2+result.gap))<=1,'oversized representative');assert(result.cards[0].height<=result.cards[1].height*1.4,'tall representative');}
 for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){const a=result.cards[i],b=result.cards[j];assert(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,'card overlap');}
}
async function settleImages(page,selector){await page.locator(selector+' img').evaluateAll(async images=>{for(const img of images){img.loading='eager';await Promise.race([img.decode().catch(()=>{}),new Promise(r=>setTimeout(r,4000))]);}});}
