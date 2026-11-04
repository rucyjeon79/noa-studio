const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const browser = {window: {}};
const script = require.resolve('../../deploy/noa-listening-model.js');
vm.runInNewContext(fs.readFileSync(script, 'utf8'), browser, {filename: script});
const model = browser.window.NoaListeningModel;
const records = JSON.parse(fs.readFileSync(0, 'utf8'));
const pick = model.moodCollections(records);
const primary = new Set(), heard = new Set(), counts = {}, stages = {};
const moods = ['calm','focus','comfort','energy','cruise','drive','walk','sleep'];
for (const mood of moods) {
  const {rows,tiers} = pick(mood);
  const ids = rows.map(row=>row.publicVideoId);
  if(rows.length>1){
    const first=model.shuffledPlayback(rows);
    const replay=model.shuffledPlayback(rows,'',model.recordingId(first[0]));
    assert.notEqual(first[0].publicVideoId,replay[0].publicVideoId);
    for(const order of [first,replay])assert.deepEqual([...order].map(row=>row.publicVideoId).sort(),[...ids].sort());
  }
  assert.equal(new Set(ids).size, ids.length, 'video repeated within '+mood);
  assert.equal(tiers[0].mood, mood);
  assert.equal(tiers.reduce((sum,tier)=>sum+tier.count,0), ids.length);
  assert(tiers.length<=3 && ids.length<=100);
  for (const id of ids.slice(0,tiers[0].count)) {
    assert(!primary.has(id),'primary video shared by two moods');
    primary.add(id);
  }
  for (const id of ids) heard.add(id);
  counts[mood]=ids.length;
  stages[mood]=tiers;
}
for (const mood of moods) {
  let remaining=100;
  for (const tier of stages[mood]) {
    assert.equal(tier.count,Math.min(remaining,stages[tier.mood][0].count));
    remaining-=tier.count;
  }
  if(remaining)assert.equal(stages[mood].length,3);
}
assert(heard.size>0,'no public mood recommendations');
console.log('N80_PUBLIC_MOOD_QUEUES',JSON.stringify({available:records.length,counts,stages,unique:heard.size,withinQueueDuplicates:0,shuffledReplayVerified:true}));
