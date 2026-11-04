const assert = require('node:assert/strict');
const fs = require('node:fs');
const model = require('../../deploy/noa-listening-model.js');
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
