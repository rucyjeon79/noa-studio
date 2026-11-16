// Physical retirement regression: the resident entrypoints must be ABSENT.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const retired=[
  'runtime/hub/launch.mjs',
  'runtime/hub/runner.mjs',
  'runtime/hub/stop.mjs',
  'runtime/hub/probe.mjs',
  'scripts/n80_hub_bootstrap.py',
  'tests/hub/runner.test.mjs',
];
for(const file of retired)assert.equal(fs.existsSync(file),false,
  file+' must be removed, not replaced with a disabled stub');
const hub=fs.readFileSync('deploy/noa-app/engine/hub.php','utf8');
assert(hub.includes("throw new DomainException('hub_resident_runner_retired')"));
assert(!hub.includes('proc_open(')&&!hub.includes('launch.mjs'));
console.log('N80_RESIDENT_SOURCE_REMOVAL_VERIFIED', {
  removedSources: retired.length, processesStarted: 0, hostWrites: 0,
});
