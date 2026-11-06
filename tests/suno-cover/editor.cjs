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
  const open=()=>page.evaluate(s=>{
   document.querySelector('main').classList.add('noa-page');
   return editor.openRecord(s);
  },selector);
  await open();
  const field=page.locator('[data-record-field=sunoUrl]'),toggle=field.locator('button.noa-edit-edit');
  async function aligned(){
   const row=field.locator('.noa-suno-row');
   await page.waitForFunction(()=>{
    const row=document.querySelector('.noa-suno-row');
    const control=row.querySelector('input:not([hidden]),.noa-locked-preview:not([hidden])');
    const box=control.getBoundingClientRect(),cover=row.querySelector('.noa-suno-cover').getBoundingClientRect();
    return box.height>0 && Math.abs(box.height-cover.width)<0.6 && Math.abs(box.top-cover.top)<0.6 && Math.abs(box.bottom-cover.bottom)<0.6;
   },null,{timeout:4000});
   const cover=await row.locator('.noa-suno-cover').boundingBox();
   const control=await row.locator('input:visible,.noa-locked-preview:visible').boundingBox();
   assert(Math.abs(cover.width-cover.height)<0.6);
   assert(control.x-cover.x-cover.width>=9);
   assert(control.x+control.width<=page.viewportSize().width);
   return cover.height;
  }
  async function save(source,ready){
   await toggle.click();await aligned();await field.locator('input').fill(source);await toggle.click();
   await page.waitForFunction(()=>document.querySelector('[data-record-field=sunoUrl]').dataset.locked==='true');
   if(ready)await field.locator('.noa-suno-cover[data-status=ready] img').waitFor();
   else await field.locator('.noa-suno-cover[data-status=missing]').waitFor();
   const saved=await page.evaluate(async url=>(await fetch(url)).json(),endpoint);
   assert.equal(saved.fields.sunoUrl,source);assert.equal(Boolean(saved.sunoCover),ready);return saved;
  }
  const emptyHeight=await aligned();
  const first=await save('https://suno.com/s/3T0G9aGwwrsnYXPz',true);
  await page.setViewportSize({width:320,height:800});
  const wrappedHeight=await aligned();
  assert(wrappedHeight>emptyHeight+8,'a wrapped URL must grow the square');
  await page.setViewportSize({width:1024,height:800});
  const wideHeight=await aligned();
  assert(wideHeight<wrappedHeight,'unwrapping must shrink the square again');
  await page.setViewportSize({width:390,height:800});
  await page.addStyleTag({content:'.noa-page .noa-locked-preview{font-size:22px}'});
  await aligned();
  console.log('SUNO_ROW_HEIGHT',JSON.stringify({emptyHeight,wrappedHeight,wideHeight}));
  const next=await save('https://suno.com/s/replacement',true);
  assert.notEqual(first.sunoCover,next.sunoCover);assert.equal(first.revision+1,next.revision);
  await page.reload();await open();await field.locator('.noa-suno-cover img').waitFor();
  const failed=await save('https://suno.com/s/unavailable',false);
  const retried=await save('https://suno.com/s/unavailable',false);
  assert.equal(retried.revision,failed.revision+1);assert.deepEqual(errors,[]);
  console.log('EDITOR_SAVE_REPLACE_REOPEN_RETRY_VERIFIED');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
