const assert = require('node:assert/strict');
const {chromium} = require('playwright');
const path = require('node:path');

(async () => {
 const browser = await chromium.launch({executablePath:process.env.CHROME_PATH||undefined,channel:process.env.CHROME_PATH?undefined:'chrome',args:['--no-sandbox']});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://noastudio.ai.kr/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/fixture')return route.fulfill({contentType:'text/html',body:'<main id="host"><button class="noa-browse-card" id="next">다음 목록</button></main>'});
   if(url.pathname==='/noa-inline-edit.php')return route.fulfill({json:{ok:true,writeKey:'story:fixture',kind:'story',packageType:'story',revision:1,context:{},fields:{title:'Side by Side'}}});
   const file=url.pathname.slice(1);
   if(['noa-browse-edit.js','noa-record-form.js','noa-record-form.css'].includes(file))return route.fulfill({path:path.resolve('deploy',file)});
   return route.fulfill({json:{ok:true}});
  });
  await page.goto('https://noastudio.ai.kr/fixture');
  await page.evaluate(()=>{
   window.NoaBrowse={renderPath(){},names:{},groups:[]};
   window.closedCount=0;window.visits=0;
   document.getElementById('next').onclick=()=>visits++;
  });
  await page.addScriptTag({url:'/noa-record-form.js'});
  await page.addScriptTag({url:'/noa-browse-edit.js'});
  await page.evaluate(()=>{window.editor=NoaBrowseEdit.mount({host:document.getElementById('host'),standalone:true,onClose:()=>closedCount++});});
  const open=()=>page.evaluate(()=>editor.openRecord({type:'song',source:'music',key:'story:fixture'}));
  await open();
  await page.getByRole('button',{name:'곡정보창 닫기',exact:true}).click();
  assert.equal(await page.locator('.noa-edit-form').count(),0);
  assert.equal(await page.evaluate(()=>editor.isEditing()),false);
  await page.locator('#next').click();
  assert.equal(await page.evaluate(()=>visits),1);
  await open();
  await page.locator('#next').click();
  assert.equal(await page.evaluate(()=>visits),2);
  assert.equal(await page.locator('.noa-field-toolbar').count(),0);
  await open();
  await page.locator('input[name="title"]').evaluate(el=>el.dispatchEvent(new Event('input',{bubbles:true})));
  page.once('dialog',dialog=>dialog.dismiss());
  await page.getByRole('button',{name:'곡정보창 닫기',exact:true}).click();
  assert.equal(await page.evaluate(()=>editor.isEditing()),true);
  page.once('dialog',dialog=>dialog.accept());
  await page.getByRole('button',{name:'곡정보창 닫기',exact:true}).click();
  assert.equal(await page.locator('.noa-edit-form').count(),0);
  assert.equal(await page.evaluate(()=>closedCount),3);
  assert.deepEqual(errors,[]);
  console.log('Editor closes completely, releases navigation and preserves declined unsaved edits');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
