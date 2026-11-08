import assert from 'node:assert/strict';
export async function checkRevisions(page,context,heldJob,width,output){
 const title=page.locator('[data-record-field=title]');
 const idle=()=>page.waitForFunction(()=>!document.querySelector('#creative-record').inert);
 const edit=async value=>{await idle();await title.getByRole('button',{name:'곡 제목 수정',exact:true}).click();await title.locator('[name=title]').fill(value);await title.getByRole('button',{name:'곡 제목 저장',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-record-field=title]').dataset.locked==='true');};
 const submit=async()=>{const before=heldJob();await title.getByRole('button',{name:'다듬기',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-record-field=title]').hasAttribute('data-generating'));await idle();assert.notEqual(heldJob(),before);assert.equal(await title.locator('.creative-compare').count(),0);return heldJob();};
 const worker=async(job,query='')=>{const response=await context.request.get('http://127.0.0.1:8787/creative-test-worker.php?id='+job+query);assert(response.ok());return response.json();};
 await edit('A Song Between the Lines');await title.getByRole('button',{name:'곡 제목 AI 생성',exact:true}).click();
 const request=title.locator('.noa-ai-feedback textarea');await request.fill('더 짧게 줄여죠');
 let job=await submit();let snapshot=await worker(job,'&mode=snapshot');
 assert.deepEqual(snapshot.revisionInput,{field:'title',currentValue:'A Song Between the Lines',request:'더 짧게 줄여죠'});
 await worker(job,'&title=Between%20Lines');await title.locator('.creative-compare').waitFor({timeout:20000});
 assert((await title.locator('.creative-compare').innerText()).includes('Between Lines'));
 await request.fill('영어 한 단어로 줄여줘');assert.equal(await title.locator('.creative-compare').count(),0,'Typing a different request immediately removes the obsolete comparison');
 job=await submit();await worker(job,'&mode=failed');await page.waitForFunction(()=>!document.querySelector('[data-record-field=title]').hasAttribute('data-generating'),null,{timeout:20000});
 assert.equal(await title.locator('.creative-compare').count(),0,'Failed retry never restores a previous result');
 job=await submit();snapshot=await worker(job,'&mode=snapshot');assert.equal(snapshot.revisionInput.currentValue,'A Song Between the Lines','Unaccepted proposal is never the baseline');assert.equal(snapshot.revisionInput.request,'영어 한 단어로 줄여줘');
 await worker(job,'&title=Lines');await title.locator('.creative-compare').waitFor({timeout:20000});await page.screenshot({path:`${output}/latest-revision-${width}.png`,fullPage:true});
 await title.getByRole('button',{name:'수정안 적용',exact:true}).click();await idle();assert.equal(await title.locator('.noa-locked-preview').innerText(),'Lines');
 job=await submit();snapshot=await worker(job,'&mode=snapshot');assert.equal(snapshot.revisionInput.currentValue,'Lines','Next edit uses the last accepted value');await worker(job,'&mode=failed');await page.waitForFunction(()=>!document.querySelector('[data-record-field=title]').hasAttribute('data-generating'),null,{timeout:20000});
 await edit('집으로 가는 마음 · 수정');console.log('CREATIVE_BROWSER_CURRENT_BASELINE_STALE_PROPOSAL_RETRY_OK',width);
}
