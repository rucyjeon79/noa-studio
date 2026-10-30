import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const script=fs.readFileSync('deploy/noa-account.js','utf8');
const source=script.slice(script.indexOf('function hasInternalPrevious('),script.indexOf('\n const back='));
const previous=vm.runInNewContext(source+';hasInternalPrevious',{URL});
test('back uses browser history only for an internal referring page',()=>{
 assert.equal(previous('https://noastudio.ai.kr/noa-music.php','https://noastudio.ai.kr',3),true);
 for(const ref of ['', 'not a url','https://example.com/','https://noastudio.ai.kr.evil.test/'])assert.equal(previous(ref,'https://noastudio.ai.kr',3),false);
 assert.equal(previous('https://noastudio.ai.kr/','https://noastudio.ai.kr',1),false);
});
test('essential navigation remains available without loading account data',()=>{
 const mount=script.indexOf('document.body.prepend(bar)');
 for(const id of ['noa-nav-back','noa-nav-top','noa-nav-all'])assert(script.indexOf(id)<mount);
 assert(mount<script.indexOf('async function update('));
 assert(script.includes("location.assign('/')"));
});
