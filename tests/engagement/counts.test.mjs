import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../../deploy/noa-engagement.js',import.meta.url),'utf8');
const code=source.match(/function compactCount\(value\)\{[^\n]+/)[0];
const ctx={};vm.createContext(ctx);vm.runInContext(code,ctx);
test('counts preserve thresholds without exaggerating totals',()=>{
 for(const [n,want] of [[0,'0'],[999,'999'],[1000,'1K'],[1250,'1.2K'],[12500,'12.5K'],[999999,'999.9K'],[1000000,'1M']])assert.equal(ctx.compactCount(n),want);
});
