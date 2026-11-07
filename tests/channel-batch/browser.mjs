import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser = await chromium.launch({channel:'chrome', args:['--no-sandbox']});
const site = 'https://noastudio.ai.kr';
const output = 'explorer-proof/candidate';
try {
  const context = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.addCookies([{name:'qa_owner',value:'qa_owner_a',domain:'noastudio.ai.kr',path:'/'}]);
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== site) return route.abort();
    const response = await fetch('http://127.0.0.1:18080'+url.pathname+url.search, {
      method:request.method(), headers:{...await request.allHeaders(),host:'noastudio.ai.kr'},
      body:['GET','HEAD'].includes(request.method()) ? undefined : request.postDataBuffer(),
      redirect:'manual'
    });
    await route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:Buffer.from(await response.arrayBuffer())});
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror',e=>problems.push(e.message));
  page.on('response', async response=>{
    if (response.url().includes('channel-batch.php') || response.url().includes('/noa-gpt.php?op=batch')) {
      console.log('batch endpoint', new URL(response.url()).search, response.status());
      if (response.status()>=400) console.log('batch error', (await response.text()).slice(0,160));
    }
  });
  await page.goto(site+'/noa-ai-lab.php?tool=batch');
  const batch = page.locator('#creator-batch');
  assert(await batch.evaluate(node=>node.open));
  await page.locator('[data-batch-node="channel"]').waitFor();
  await page.getByRole('button',{name:'모두 펼치기',exact:true}).click();
  const choose=id=>page.locator('input[data-batch-node="'+id+'"]');
  await choose('collection:playlist:batch-ui:1').check();
  await page.waitForFunction(()=>/10\s*곡/.test(document.querySelector('#batch-count').textContent));
  const aiResponse = page.waitForResponse(r=>r.url().includes('op=batchPreview') && r.request().method()==='POST');
  await choose('collection:playlist:batch-ui:2').check();
  await page.waitForFunction(()=>/20\s*곡/.test(document.querySelector('#batch-count').textContent));
  assert(await choose('genre:groovy-airy-pop').isChecked());
  const panel = page.locator('#batch-preview');
  await panel.waitFor();
  assert.equal(await page.locator('#batch-mode').inputValue(),'ai');
  const ai = await (await aiResponse).json();
  assert.equal(ai.eligible,17);
  assert.equal(ai.skipped,3);
  assert.equal(await page.locator('#batch-replace').isChecked(),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1),false);
  assert(await page.locator('#noa-disclosure-close').isHidden(),'global close must not cover batch actions');
  await batch.screenshot({path:output+'/batch-mobile.png'});
  await page.setViewportSize({width:1280,height:900});
  await batch.screenshot({path:output+'/batch-desktop.png'});
  await page.goto(site+'/noa-creator.php?batch=1');
  await page.getByRole('button',{name:'모두 펼치기',exact:true}).click();
  await choose('collection:playlist:batch-ui:1').check();
  const audioResponse = page.waitForResponse(r=>r.url().includes('channel-batch.php?action=preview') && r.request().method()==='POST');
  await choose('collection:playlist:batch-ui:2').check();
  const audio=await (await audioResponse).json();
  assert.equal(audio.missing,20);
  assert.equal(audio.eligible,0);
  await page.locator('#batch-mode').selectOption('upload');
  function wav(){
    const file=Buffer.alloc(32044);
    file.write('RIFF'); file.writeUInt32LE(file.length-8,4); file.write('WAVEfmt ',8);
    file.writeUInt32LE(16,16);file.writeUInt16LE(1,20);file.writeUInt16LE(1,22);
    file.writeUInt32LE(16000,24);file.writeUInt32LE(32000,28);file.writeUInt16LE(2,32);
    file.writeUInt16LE(16,34);file.write('data',36);file.writeUInt32LE(32000,40);
    return file;
  }
  await page.locator('#batch-files').setInputFiles([
    {name:'[GAP]1_같은 멜로디.wav',mimeType:'audio/wav',buffer:wav()},
    {name:'[GAP]3_테스트 노래 3.wav',mimeType:'audio/wav',buffer:wav()},
    {name:'[GAP]같은 멜로디.wav',mimeType:'audio/wav',buffer:wav()},
  ]);
  const ambiguous=page.locator('#batch-file-map li').filter({hasText:'[GAP]같은 멜로디.wav'});
  assert(await page.locator('#batch-run').isDisabled());
  await ambiguous.getByRole('button',{name:'곡 지정'}).click();
  await page.locator('.n80-dialog [data-n80-key="single:batch-ui:2"]').click();
  await page.waitForFunction(()=>!document.querySelector('#batch-run').disabled);
  const finished = new Set();
  page.on('response',r=>{if(r.url().includes('action=uploadFinish')&&r.ok())finished.add(r.request().postData());});
  await page.locator('#batch-run').click();
  for(let n=0;n<120&&finished.size<3;n++)await page.waitForTimeout(250);
  assert.equal(finished.size,3,'three distinct WAV transfers finished and reached the server queue');
  await page.reload();
  await page.locator('#batch-history details[data-kind="audio"] > summary').click();
  await page.waitForFunction(()=>document.querySelector('#batch-history')?.textContent.includes('같은 멜로디'));
  await context.addCookies([{name:'qa_owner',value:'qa_five',domain:'noastudio.ai.kr',path:'/'}]);
  await page.reload();
  await page.locator('[data-batch-node="channel"]').waitFor();
  assert.equal(await page.locator('#batch-mode option[value="ai"]').count(),0);
  assert.equal(await page.locator('#batch-history').getByText('같은 멜로디').count(),0);
  assert.deepEqual(problems,[]);
  console.log('CHANNEL_BATCH_BROWSER_OK 2 ACT, 20 distinct songs, 3 preserved, 3 uploads, history after reload');
} finally {await browser.close();}
