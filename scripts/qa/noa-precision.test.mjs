import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync(new URL('../../deploy/noa-ui.js',import.meta.url),'utf8');
const title=vm.runInNewContext(code.slice(code.indexOf('function presentTitle('),code.indexOf('const rankPaths='))+';({presentTitle,movement})');
test('compact titles preserve actual EP and remove only separated display credits',()=>{
 for(const [raw,meta,want]of [
  ['EP.7 아직 그 자리에 | Official MV (KR) | Original Song | 시간은 갔어도',{},'EP.7 · 아직 그 자리에'],
  ['EP.1 | 하루의 끝에 | K-POP Original Song | AI Artist Noa',{},'EP.1 · 하루의 끝에'],
  ['이젠 잊기로 해요 - 김완선 | Cover by AInoa (가사/Lyrics) | High Quality Audio',{},'이젠 잊기로 해요 - 김완선'],
  ['Sway', {ep:38},'EP.38 · Sway'],
  ['Original long title',{displayTitle:'Afterglow',ep:40},'EP.40 · Afterglow'],
  ['내 맘이 지나면',{},'내 맘이 지나면']
 ])assert.equal(title.presentTitle(raw,meta),want);
});
test('ranking changes use the delivered signed Work_DATA snapshot contract',()=>{
 assert.equal(title.movement(null),null);assert.equal(title.movement({rankState:'up'}),null);assert.equal(title.movement({rankState:'unknown',rank:2,previousRank:null,rankDelta:null}),null);
 for(const [rankState,rank,previousRank,rankDelta]of [['up',2,5,3],['down',5,2,-3],['same',2,2,0]])assert.equal(title.movement({rankState,rank,previousRank,rankDelta}).state,rankState);
 assert.equal(title.movement({rankState:'new',rank:7,previousRank:null,rankDelta:null}).state,'new');
 assert.equal(title.movement({rankState:'up',rank:5,previousRank:2,rankDelta:-3}),null);
 assert.equal(title.movement({rankState:'up',rank:2,previousRank:5,rankDelta:4}),null);
 assert.equal(title.movement({rankState:'new',rank:2,previousRank:5,rankDelta:3}),null);
 assert.equal(title.movement({rankState:'down',rank:5,previousRank:2,rankDelta:3}),null);
 assert.equal(title.movement({rankState:'up',rank:2,previousRank:5}),null);
});
