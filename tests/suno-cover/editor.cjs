const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:360,height:800}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const local='http://127.0.0.1:8101';
  await page.route('**/noa-inline-edit.php',r=>r.continue({headers:{...r.request().headers(),origin:'https://noastudio.ai.kr'}}));
  await page.route('https://noastudio.ai.kr/noa-app/jukebox/stream.php?**',async route=>{
   const response=await page.request.get(local+'/fixture-cover.php'+new URL(route.request().url()).search);
   await route.fulfill({response});
  });
  await page.goto(local+'/cover.html');
  const selector={type:'song',source:'music',key:'story:cover-fixture'};
  const endpoint='/noa-inline-edit.php?'+new URLSearchParams(selector);
  await page.evaluate(url=>fetch(url+'&auth=admin'),endpoint);
  const open=()=>page.evaluate(s=>editor.openRecord(s),selector);
  await open();
  const field=page.locator('[data-record-field=sunoUrl]'),toggle=field.locator('button.noa-edit-edit');
  async function save(source,ready){
   await toggle.click();await field.locator('input').fill(source);await toggle.click();
   await page.waitForFunction(()=>document.querySelector('[data-record-field=sunoUrl]').dataset.locked==='true');
   if(ready)await field.locator('.noa-suno-cover[data-status=ready] img').waitFor();
   else await field.locator('.noa-suno-cover[data-status=missing]').waitFor();
   const saved=await page.evaluate(async url=>(await fetch(url)).json(),endpoint);
   assert.equal(saved.fields.sunoUrl,source);assert.equal(Boolean(saved.sunoCover),ready);return saved;
  }
  const first=await save('https://suno.com/s/first',true);
  const next=await save('https://suno.com/s/replacement',true);
  assert.notEqual(first.sunoCover,next.sunoCover);assert.equal(first.revision+1,next.revision);
  await page.reload();await open();await field.locator('.noa-suno-cover img').waitFor();
  const failed=await save('https://suno.com/s/unavailable',false);
  const retried=await save('https://suno.com/s/unavailable',false);
  assert.equal(retried.revision,failed.revision+1);assert.deepEqual(errors,[]);
  console.log('EDITOR_SAVE_REPLACE_REOPEN_RETRY_VERIFIED');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
