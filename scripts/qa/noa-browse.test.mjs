import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const sandbox={window:{}};vm.runInNewContext(fs.readFileSync(new URL('../../deploy/noa-browse.js',import.meta.url),'utf8'),sandbox);const m=sandbox.window.NoaBrowse;
test('all fifteen existing genres have one category',()=>{const ids=m.groups.flatMap(g=>g[2]);assert.equal(ids.length,15);assert.equal(new Set(ids).size,15);assert.equal(m.groupFor('pop-original'),'original');assert.equal(m.groupFor('your-story'),'story');assert.equal(m.groupFor('cover-reborn'),'cover');assert.equal(m.groupFor('unclassified'),null);});
test('ACT ranges preserve real episode numbers and explicit ACTs',()=>{for(const[ep,act]of[[1,1],[10,1],[11,2],[20,2],[21,3],[30,3],[31,4],[40,4],[41,5]])assert.equal(m.actFor({ep}),act);assert.equal(m.actFor({act:7,ep:1}),7);assert.equal(m.actFor({}),null);});
test('pagination preserves order and never duplicates or loses a key',()=>{const rows=Array.from({length:765},(_,i)=>({key:String(i)}));const pages=[];for(let page=0;page<32;page++)pages.push(...m.slicePage(rows,page));assert.equal(pages.length,765);assert.deepEqual(pages.map(r=>r.key),rows.map(r=>r.key));});
test('saved aliases resolve once, retain stored order and never collapse unrelated titles',()=>{
 const rows=[{key:'short',orderKey:'source-a',canonicalRecordKey:'catalog:native-a',title:'미전송(Unread)'},{key:'main',orderKey:'native-a',canonicalRecordKey:'catalog:native-a',title:'미전송(Unread)',preferredVideo:true},{key:'bloom',orderKey:'b',title:'BLOOM'},{key:'other',orderKey:'c',title:'미전송(Unread)'}],before=JSON.stringify(rows);
 assert.deepEqual(Array.from(m.collectionRows(rows,['source-a','native-a','b','c']),r=>r.key),['main','bloom','other']);
 assert.deepEqual(Array.from(m.collectionRows(rows,['b','catalog:source-a','c']),r=>r.key),['bloom','main','other']);
 assert.equal(JSON.stringify(rows),before,'read projection never mutates or deletes sources');
 assert.equal(m.collectionRows([{key:'a',orderKey:'ambiguous'},{key:'b',orderKey:'ambiguous',canonicalRecordKey:'other'}],['ambiguous']).length,0,'ambiguous alias never picks an arbitrary record');
});
test('verified duplicate video copies use complete native metadata and retain every playlist alias',()=>{
 const rows=[{key:'imported',orderKey:'source',browseIdentity:'verified-video',browseKeys:['native','source'],title:'미전송 | 긴 업로드 제목',preferredVideo:true,comingSoon:true},{key:'native-row',orderKey:'native',browseIdentity:'verified-video',browseKeys:['native','source'],title:'미전송',preferredVideo:true,comingSoon:true,browsePriority:3}];
 assert.equal(m.collectionRows(rows,['source'])[0].key,'native-row');assert.equal(m.collectionRows(rows,['source','native']).length,1);assert.equal(rows.length,2);
});
