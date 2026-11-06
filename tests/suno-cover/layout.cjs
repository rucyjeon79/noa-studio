const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',executablePath:process.env.CHROMIUM_BIN||undefined,args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  for(const width of [320,390,1024]){
   await page.setViewportSize({width,height:780});
   await page.setContent('<main class="noa-page"><form></form></main>');
   await page.addStyleTag({content:fs.readFileSync('deploy/noa-record-form.css','utf8')});
   await page.addScriptTag({path:'deploy/noa-record-form.js'});
   const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZkAAAAASUVORK5CYII=';
   await page.evaluate(image=>{
    const source='https://suno.com/s/example',f=NoaRecordForm.createField('sunoUrl',{value:source});
    document.querySelector('form').append(f.wrap);f.input.setSavedCover(source,image);
   },image);
   await page.waitForSelector('.noa-suno-cover[data-status=ready] img');
   await page.waitForFunction(()=>{
    const box=document.querySelector('input').getBoundingClientRect(),frame=document.querySelector('.noa-suno-cover').getBoundingClientRect();
    return Math.abs(frame.top-box.top)<0.6 && Math.abs(frame.bottom-box.bottom)<0.6;
   });
   const frame=await page.locator('.noa-suno-cover').boundingBox(),input=await page.locator('input').boundingBox();
   assert.equal(frame.height,frame.width);assert(input.x-frame.x-frame.width>=8);assert(input.x+input.width<=width);
   await page.locator('input').fill('https://suno.com/s/other');
   assert.equal(await page.locator('.noa-suno-cover img').count(),0);
   await page.evaluate(()=>document.querySelector('input').setSavedCover('https://suno.com/s/other',''));
   assert(await page.evaluate(()=>document.querySelector('input').coverMissing()));
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
