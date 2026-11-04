import assert from 'node:assert/strict';import test from 'node:test';import '../../deploy/noa-listening-model.js';const model=globalThis.NoaListeningModel;
test('birth input accepts mobile digits and common date separators',()=>{for(const value of ['19900615','1990-06-15','1990.6.15','1990/6/15','1990년 6월 15일','１９９００６１５',' 1990-6-15 '])assert.equal(model.normalizeBirthDate(value),'1990-06-15');});
test('normalization preserves lunar-only days for server validation and rejects malformed input',()=>{assert.equal(model.normalizeBirthDate('20240230'),'2024-02-30');for(const value of ['',null,'900615','19901315','19900600','19900632','1990-06-15abc'])assert.equal(model.normalizeBirthDate(value),'');});
const rows=[{key:'k2',genre:'k',audio:'/a',ep:'2',registeredAt:20,moodTags:['calm']},{key:'j1',genre:'j',audio:'/a',moodTags:['calm']},{key:'k1',genre:'k',audio:'/a',ep:'1',registeredAt:10,moodTags:['energy']},{key:'pending',genre:'k',audio:'',moodTags:['calm']},{key:'whole',genre:'k',audio:'/a',kind:'playlist'},{key:'alias',genre:'k',audio:'/a',orderKey:'k1'}];
test('genre and verified audio remain hard boundaries',()=>assert.deepEqual(model.select(rows,{genre:'k',mood:'calm'}).rows.map(r=>r.key),['k2']));
test('missing explicit mood falls back visibly within playable genre',()=>{const r=model.select(rows,{genre:'k',mood:'focus'});assert(r.fallback);assert.deepEqual(new Set(r.rows.map(x=>x.key)),new Set(['k1','k2']));assert.equal(model.select(rows,{genre:'empty',mood:'calm'}).rows.length,0);});
test('auto fallback is explicit and genre scoped',()=>{const r=model.select(rows,{genre:'k',theme:{mood:'focus'}});assert(r.fallback);assert(r.rows.every(r=>r.genre==='k'));});
test('ACT preserves episode order',()=>assert.deepEqual(model.albums(rows,'k')[0].rows.map(r=>r.ep),['1','2']));
test('popular is real valid plays, no invented zero ranks',()=>assert.deepEqual(model.select(rows,{genre:'k',mode:'popular',popular:{k1:10,k2:2,j1:100}}).rows.map(r=>r.key),['k1','k2']));
test('latest uses known registration date',()=>assert.deepEqual(model.select(rows,{genre:'k',mode:'latest'}).rows.map(r=>r.key),['k2','k1']));
test('library cannot cross genres',()=>assert.deepEqual(model.select(rows,{genre:'k',mode:'library',library:[{tracks:['k1','j1']}]}).rows.map(r=>r.key),['k1']));

test('recommended albums rank matching moods while keeping story order',()=>{const albums=model.albums([...rows,{key:'k11',genre:'k',audio:'/a',ep:'11',moodTags:['calm']}],'k',{mood:'calm'});assert.deepEqual(albums.map(a=>a.act),[2,1]);assert.deepEqual(albums[1].rows.map(r=>r.ep),['1','2']);});
test('popular counts include canonical aliases without counting a key twice',()=>{const r=[{...rows[0],browseKeys:['k2','oldk2']},rows[2]];assert.equal(model.select(r,{genre:'k',mode:'popular',popular:{oldk2:4,k1:3}}).rows[0].key,'k2');});
test('stronger word evidence leads inside the selected genre before daily tie breaking',()=>{
 const tracks=[
  {key:'a',genre:'story',audio:'/a',moodTags:['comfort']},
  {key:'b',genre:'story',audio:'/b',moodScores:{comfort:2}},
  {key:'c',genre:'story',audio:'/c',moodScores:{comfort:5}},
  {key:'outside',genre:'pop',audio:'/p',moodScores:{comfort:12}},
  {key:'silent',genre:'story',audio:'',moodScores:{comfort:12}},
 ];
 for(const mood of ['comfort','auto'])assert.deepEqual(model.select(tracks,{genre:'story',mood,theme:{mood:'comfort',localDate:'2026-11-04'}}).rows.map(x=>x.key),['c','b','a']);
});
test('exact recording aliases can supply lyrics without admitting silent or unrelated tracks',()=>{
 const tracks=[
  {key:'word-copy',browseIdentity:'song1',genre:'story',audio:'',moodScores:{focus:4}},
  {key:'play',browseIdentity:'song1',genre:'story',audio:'/s',title:'같은 제목'},
  {key:'duplicate',browseIdentity:'song1',genre:'story',audio:'/s',moodScores:{focus:2}},
  {key:'namesake',genre:'story',audio:'/other',title:'같은 제목'},
  {key:'unlinked',genre:'story',audio:'',moodScores:{focus:10}},
 ];
 const result=model.select(tracks,{genre:'story',mood:'focus'});
 assert.equal(result.fallback,false);assert.deepEqual(result.rows.map(r=>[r.key,r.moodScores.focus]),[['play',4]]);
});
test('personal now uses the next chart mood with audio inside the chosen genre',()=>{
 const theme={personal:true,mood:'focus',rankedMoods:['focus','energy']};
 const tracks=[...rows,{key:'silent-focus',genre:'k',audio:'',moodTags:['focus']},{key:'other-focus',genre:'j',audio:'/j',moodTags:['focus']}];
 const chosen=model.select(tracks,{genre:'k',theme});
 assert.equal(chosen.mood,'energy');assert(!chosen.fallback);assert.deepEqual(chosen.rows.map(r=>r.key),['k1']);
 assert.deepEqual(model.select(tracks,{genre:'k',mood:'calm',theme}).rows.map(r=>r.key),['k2']);
 const unmatched=model.select(tracks,{genre:'k',theme:{...theme,rankedMoods:['focus','comfort']}});
 assert(unmatched.fallback);assert(unmatched.rows.every(r=>r.genre==='k'));
});
test('saju recommendations offer three playable genres and a genre-local queue per card',()=>{
 const theme={personal:true,mood:'calm',rankedMoods:['calm','focus']};
 const tracks=[
  {key:'c1',genre:'c',audio:'/c',moodScores:{calm:6}},
  {key:'a1',genre:'a',audio:'/a',moodScores:{calm:8}},
  {key:'a2',genre:'a',audio:'/a2',moodAffinity:{calm:.8}},
  {key:'b1',genre:'b',audio:'/b',moodAffinity:{calm:.9}},
  {key:'d1',genre:'d',audio:'/d',moodScores:{energy:10}},
  {key:'silent',genre:'none',audio:'',moodScores:{calm:20}},
 ];
 const genres={a:'a',b:'b',c:'c',d:'d',none:'none'};
 const picks=model.genreSuggestions(tracks,theme,genres,'a');
 assert.equal(picks.length,3);assert.deepEqual(new Set(picks.map(p=>p.genre)),new Set(['a','b','c']));
 for(const pick of picks)assert(pick.selection.rows.every(r=>r.genre===pick.genre&&r.audio));
 const energetic=model.genreSuggestions(tracks,{personal:true,mood:'energy',rankedMoods:['energy','comfort']},genres,'a');
 assert.equal(energetic[0].genre,'d');assert.deepEqual(model.genreSuggestions(tracks,{personal:false},genres),[]);
 assert.equal(model.genreSuggestions(tracks,theme,{b:'b',none:'none'}).length,1);
 const manual=model.select(tracks,{genre:'b',theme,mood:'calm'});assert(manual.fallback);
});
test('explicit whole-catalog saju considers all eligible genres independently of the manual selection',()=>{
 const theme={personal:true,mood:'calm',rankedMoods:['calm','focus']};
 const rows=[
  {key:'pop',genre:'pop',audio:'/a',moodTags:['calm']},
  {key:'story',genre:'story',audio:'/b',moodScores:{focus:3}},
  {key:'ambient',genre:'other',audio:'/c',moodAffinity:{calm:.75}},
  {key:'silent',genre:'pop',audio:'',moodScores:{calm:10}},
  {key:'video',genre:'pop',video:'v',audio:'/v',moodScores:{calm:20}},
  {key:'album',genre:'pop',kind:'playlist',audio:'/p',moodScores:{calm:20}},
 ];
 const mix=model.wholeCatalogMix(rows,theme);assert.deepEqual(mix.rows.map(x=>x.key),['story','pop','ambient']);
 assert.deepEqual(model.select(rows,{genre:'pop',theme}).rows.map(x=>x.key),['pop']);
 assert.deepEqual(model.wholeCatalogMix(rows,{personal:false}).rows,[]);
});
test('100 across the catalog and 10 per suggested genre, unique and playable even with sparse matches',()=>{
 const theme={personal:true,mood:'calm',rankedMoods:['calm','focus'],localDate:'2026-11-04'};
 const tracks=Array.from({length:135},(_,i)=>({key:'song-'+i,genre:['a','b','c'][i%3],audio:'/stream/'+i,moodScores:i<6?{calm:1}:{}}));
 tracks.push({...tracks[0],key:'alias',canonicalRecordKey:'song-0'}, {key:'silent',genre:'a',audio:''},{key:'album',genre:'a',audio:'/list',kind:'playlist'});
 const whole=model.wholeCatalogMix(tracks,theme);assert.equal(whole.rows.length,100);assert.equal(new Set(whole.rows.map(x=>x.key)).size,100);assert.equal(whole.matched,6);
 assert(whole.rows.slice(0,6).every(row=>row.moodScores.calm));assert(!whole.rows.some(row=>['silent','alias','album'].includes(row.key)));
 const picks=model.genreSuggestions(tracks,theme,{a:'a',b:'b',c:'c'});assert.equal(picks.length,3);
 for(const pick of picks){assert.equal(pick.selection.rows.length,10);assert(pick.selection.rows.every(x=>x.genre===pick.genre));assert.equal(pick.selection.matched,2);}
 const few=tracks.slice(0,5);assert.equal(model.wholeCatalogMix(few,theme).rows.length,5);assert.equal(model.recommendedGenreMix(few,'a',theme).rows.length,2);
});
