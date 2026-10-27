const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');const sandbox={module:{exports:{}},Intl,Date};vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../../deploy/noa-voice.js'),'utf8'),sandbox);const {compose}=sandbox.module.exports;
test('54 varied greetings keep exact facts with time, season and emotion',()=>{
 const values=new Set();for(let index=0;index<54;index++){
 const text=compose('구독 중 · 12일 · 1,234P',{date:new Date('2026-10-28T00:00:00Z'),index,name:'민지'});values.add(text);assert(text.startsWith('민지님,'));assert.match(text,/가을/);assert.match(text,/아침/);assert(text.endsWith('구독 중 · 12일 · 1,234P'));assert(!/비가|눈이|맑은 날|기온/.test(text));
 }assert.equal(values.size,54);
});
test('Korea time, four seasons, safe literal song context',()=>{for(const [month,season] of [[1,'겨울'],[4,'봄'],[7,'여름'],[10,'가을']]){const text=compose('저장했어요.',{date:new Date(`2026-${String(month).padStart(2,'0')}-01T23:00:00Z`),title:'<img src=x onerror=alert(1)>',index:0});assert(text.includes(season));assert.match(text,/아침/);assert(text.includes('<img'));assert.match(text,/저장했어요/);}});
