import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:900}});
 await context.route('**/noa-inline-edit.php',route=>route.continue({headers:{...route.request().headers(),origin:'https://noastudio.ai.kr'}}));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8101/cover.html');
 await page.evaluate(async()=>{await fetch('/noa-inline-edit.php?auth=admin&type=song&source=music&key=story:cover-fixture');});
 const open=()=>page.evaluate(()=>editor.openRecord({type:'song',source:'music',key:'story:cover-fixture'}));
 await open();
 const artist='원곡 가수 '+width;
 await page.getByLabel('원곡 가수',{exact:true}).fill(artist);
 await page.getByLabel('보컬 정보',{exact:true}).selectOption('남녀듀엣');
 await page.getByRole('button',{name:'정보 수정 저장',exact:true}).click();
 try{await page.locator('.noa-edit-form').waitFor({state:'detached',timeout:10000});}catch(e){console.log('SAVE_DIAGNOSTIC',await page.locator('.noa-edit-status').textContent());throw e;}
 await page.reload();await open();
 assert.equal(await page.getByLabel('원곡 가수',{exact:true}).inputValue(),artist);
 assert.equal(await page.getByLabel('보컬 정보',{exact:true}).inputValue(),'남녀듀엣');
 const data=await page.evaluate(async()=>await(await fetch('/noa-inline-edit.php?type=song&source=music&key=story:cover-fixture')).json());
 assert.equal(data.payload.body.originalSinger,artist);assert.equal(data.payload.body.coverArtist,artist);
 assert.equal(data.payload.body.vocal,'남녀듀엣');assert.equal(data.payload.body.sourceVocal,'남녀듀엣');assert.equal(data.payload.body.thumbCast,'duet');
 assert.equal(data.payload.body.untouched,'preserve');
 assert.deepEqual(errors,[]);
 console.log('COVER_SAVE_REOPEN_OK',JSON.stringify({width,realPhpMysql:true,artist:true,vocal:true,aliases:true,reload:true}));
 await context.close();
}}finally{await browser.close();}
