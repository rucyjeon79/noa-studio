import assert from 'node:assert/strict';
export async function checkPublishedExpiry(page,context,draftId,savedKey,width,output){
 const setup=await context.request.get('http://127.0.0.1:8787/creative-test-expiry.php?id='+draftId);assert(setup.ok());const {retainedId}=await setup.json();
 // A phone clock two days ahead must not expire a newly fetched row.
 await page.addInitScript(()=>{const actualNow=Date.now.bind(Date);Date.now=()=>actualNow()+172800000;});
 await page.setViewportSize({width,height:900});
 let listCalls=0;const count=req=>{if(req.url().includes('creative.php?action=list'))listCalls++;};page.on('request',count);
 await page.goto('https://noastudio.ai.kr/noa-ai-lab.php?tool=creative');
 const row=page.locator('[data-draft-id="'+draftId+'"]'),retained=page.locator('[data-draft-id="'+retainedId+'"]');
 await row.waitFor({state:'visible'});await retained.waitFor({state:'visible'});
 assert((await row.innerText()).includes('24시간'));
 await page.screenshot({path:`${output}/published-before-expiry-${width}.png`,fullPage:true});
 const calls=listCalls;await row.waitFor({state:'detached',timeout:12000});assert.equal(listCalls,calls,'One deadline removes the row without a background request loop');
 assert(await retained.isVisible(),'A complete unpublished song remains in the library');
 await page.screenshot({path:`${output}/published-after-expiry-${width}.png`,fullPage:true});
 await page.locator('#creative-filter').selectOption('published');
 await page.waitForResponse(r=>r.url().includes('action=list')&&r.url().includes('filter=published'));
 assert.equal(await row.count(),0,'The server also excludes the expired registration');
 await page.goto('https://noastudio.ai.kr/noa-music.php?genre=your-story&track='+encodeURIComponent(savedKey));
 const card=page.locator('[data-key='+JSON.stringify(savedKey)+']');await card.waitFor({state:'attached'});
 assert.equal(await card.getAttribute('data-jukebox-status'),width===1280?'ready':'audio_pending','Registered song and media remain in their category');
 page.off('request',count);console.log('CREATIVE_BROWSER_PUBLISHED_EXPIRY_NO_POLL_SONG_PRESERVED_OK',width);
}
