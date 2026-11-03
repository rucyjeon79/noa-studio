import assert from 'node:assert/strict';import test from 'node:test';import '../../deploy/noa-listening-model.js';const model=globalThis.NoaListeningModel;
const rows=[{key:'k2',genre:'k',audio:'/a',ep:'2',registeredAt:20,moodTags:['calm']},{key:'j1',genre:'j',audio:'/a',moodTags:['calm']},{key:'k1',genre:'k',audio:'/a',ep:'1',registeredAt:10,moodTags:['energy']},{key:'pending',genre:'k',audio:'',moodTags:['calm']},{key:'whole',genre:'k',audio:'/a',kind:'playlist'},{key:'alias',genre:'k',audio:'/a',orderKey:'k1'}];
test('genre and verified audio remain hard boundaries',()=>assert.deepEqual(model.select(rows,{genre:'k',mood:'calm'}).rows.map(r=>r.key),['k2']));
test('explicit mood does not silently fall back',()=>assert.equal(model.select(rows,{genre:'k',mood:'focus'}).rows.length,0));
test('auto fallback is explicit and genre scoped',()=>{const r=model.select(rows,{genre:'k',theme:{mood:'focus'}});assert(r.fallback);assert(r.rows.every(r=>r.genre==='k'));});
test('ACT preserves episode order',()=>assert.deepEqual(model.albums(rows,'k')[0].rows.map(r=>r.ep),['1','2']));
test('popular is real valid plays, no invented zero ranks',()=>assert.deepEqual(model.select(rows,{genre:'k',mode:'popular',popular:{k1:10,k2:2,j1:100}}).rows.map(r=>r.key),['k1','k2']));
test('latest uses known registration date',()=>assert.deepEqual(model.select(rows,{genre:'k',mode:'latest'}).rows.map(r=>r.key),['k2','k1']));
test('library cannot cross genres',()=>assert.deepEqual(model.select(rows,{genre:'k',mode:'library',library:[{tracks:['k1','j1']}]}).rows.map(r=>r.key),['k1']));
