const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const browser = {window: {}};
const script = require.resolve('../../deploy/noa-listening-model.js');
vm.runInNewContext(fs.readFileSync(script, 'utf8'), browser, {filename: script});
const model = browser.window.NoaListeningModel;
const records = JSON.parse(fs.readFileSync(0, 'utf8'));
const pick = model.moodCollections(records);
const used = new Set(), counts = {};
for (const mood of ['calm','focus','comfort','energy','cruise','drive','walk','sleep']) {
  const {rows} = pick(mood);
  counts[mood] = rows.length;
  assert(rows.length <= 100);
  for (const row of rows) {
    assert(!used.has(row.publicVideoId), 'public video repeated between mood queues');
    used.add(row.publicVideoId);
  }
}
assert(used.size > 0, 'no public mood recommendations');
console.log('N80_PUBLIC_MOOD_QUEUES', JSON.stringify({available:records.length, counts, unique:used.size, overlapping:0}));
