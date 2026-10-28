const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');const sandbox={module:{exports:{}},Intl,Date};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../../deploy/noa-voice.js'),'utf8'),sandbox);const {compose}=sandbox.module.exports;
test('54 varied greetings keep exact facts with time, season and emotion',()=>{
 const values=new Set();for(let index=0;index<54;index++){
 const text=compose('구독 중 · 12일 · 1,234P',{date:new Date('2026-10-28T00:00:00Z'),index,name:'민지'});values.add(text);assert(text.startsWith('민지님,'));assert.match(text,/가을/);assert.match(text,/아침/);assert(text.endsWith('구독 중 · 12일 · 1,234P'));assert(!/비가|눈이|맑은 날|기온/.test(text));
 }assert.equal(values.size,54);
});
test('Korea time, four seasons, safe literal song context',()=>{for(const [month,season] of [[1,'겨울'],[4,'봄'],[7,'여름'],[10,'가을']]){const text=compose('저장했어요.',{date:new Date(`2026-${String(month).padStart(2,'0')}-01T23:00:00Z`),title:'<img src=x onerror=alert(1)>',index:0});assert(text.includes(season));assert.match(text,/아침/);assert(text.includes('<img'));assert.match(text,/저장했어요/);}});

test('empty boards are not operational alerts',()=>{const {emptyStatus}=sandbox.module.exports;for(const text of ['등록된 글이 없습니다.','아직 등록된 공지사항이 없어요.','표시할 게시판이 없습니다.'])assert(emptyStatus(text));for(const text of ['댓글을 등록하지 못했습니다.','저장을 완료했습니다.','구독 기간이 남아 있지 않아요.'])assert(!emptyStatus(text));});

test('artist voice uses Hangul English, poetic lines and unattributed sayings without changing facts',()=>{
 const values=Array.from({length:54},(_,index)=>compose('정확한 상태: 미확인 12개',{date:new Date('2026-10-28T00:00:00Z'),index}));
 assert(values.every(t=>t.endsWith('정확한 상태: 미확인 12개')));assert(values.every(t=>!/[a-z]/i.test(t)));assert(values.some(t=>t.includes('테이크 유어 타임')));assert(values.some(t=>t.includes('낫 배드')));assert(values.some(t=>t.includes('천 리 길도 한 걸음부터')));assert(values.some(t=>t.includes('사이드 비')));
});

test('operational notices stay direct and exact',()=>{assert.equal(compose('저장 실패 · 다시 시도해 주세요.',{practical:true}),'저장 실패 · 다시 시도해 주세요.');});
