import {chromium} from 'playwright';
import assert from 'node:assert/strict';import fs from 'node:fs/promises';
const b=await chromium.launch(),origin='http://127.0.0.1:8098',proof=[];await fs.mkdir('database-proof',{recursive:true});
for(const role of ['','member','super']){
 const c=await b.newContext();if(role)await c.addCookies([{name:'test_role',value:role,url:origin}]);
 const p=await c.newPage(),r=await p.goto(origin+'/noa-app/database/');assert.equal(r.status(),role==='super'?200:403);
 if(role==='super'){
  const token=await p.locator('#csrf').inputValue();
  for(const [body,status]of [[{action:'status'},403],[{csrf:'wrong',action:'query',sql:'SELECT * FROM songs'},403],[{csrf:token,action:'query',sql:'DELETE FROM members'},400],[{csrf:token,action:'query',sql:'SELECT SLEEP(3) FROM songs'},400]]){const resp=await c.request.post(origin+'/noa-app/database/',{data:body});assert.equal(resp.status(),status);}
  const before=(await(await c.request.post(origin+'/noa-app/database/',{data:{csrf:token,action:'query',sql:'SELECT COUNT(*) AS total FROM members'}})).json()).rows;
  assert.equal(Number(before[0][0]),1);
  for(const width of [320,390,1280]){
   await p.setViewportSize({width,height:900});await p.reload();await p.getByText('DB 연결 상태 확인 완료',{exact:true}).waitFor();
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await p.screenshot({path:`database-proof/status-${width}.png`});
   await p.getByRole('button',{name:'SQL 조회 콘솔',exact:true}).click();await p.locator('#sql').fill('SELECT id,title FROM songs LIMIT 3');await p.locator('#run').click();await p.getByText('SQL 조회 완료',{exact:true}).waitFor();assert.equal(await p.locator('#query-result tbody tr').count(),3);
   await p.screenshot({path:`database-proof/console-${width}.png`});
   await p.getByRole('button',{name:'테이블 목록',exact:true}).click();await p.getByText('테이블 목록 조회 완료',{exact:true}).waitFor();await p.locator('#tables').getByRole('button',{name:'songs',exact:true}).click();await p.getByText('구조 조회 완료',{exact:true}).waitFor();assert((await p.locator('#structure').innerText()).includes('COLUMN_NAME'));
   await p.getByRole('button',{name:'데이터 조회',exact:true}).click();await p.getByText('데이터 조회 완료',{exact:true}).waitFor();
   await p.getByRole('button',{name:'백업 관리',exact:true}).click();await p.getByText('백업 목록 조회 완료',{exact:true}).waitFor();await p.locator('#backup').click();await p.getByText(/백업 생성 및 SHA-256 확인 완료/).waitFor();assert.equal(await p.locator('.backup-item').count()>=1,true);
   await p.locator('.backup-item').first().getByRole('button',{name:'복원 영향 확인',exact:true}).click();await p.getByText('복원 영향 확인 완료 · 실행 전 별도 승인이 필요합니다.',{exact:true}).waitFor();assert((await p.locator('#restore-plan').innerText()).includes('"executionEnabled": false'));
   await p.getByRole('button',{name:'DB 연결 상태',exact:true}).click();await p.getByText('DB 연결 상태 확인 완료',{exact:true}).waitFor();proof.push({width,render:true,query:true,structure:true,browse:true,backup:true,restorePlan:true});
  }
 }
 await c.close();
}
await fs.writeFile('database-proof/result.json',JSON.stringify({auth:true,csrf:true,blockedWrites:true,proof},null,2));await b.close();console.log('HTTP auth/CSRF/security + desktop/mobile UI passed');
