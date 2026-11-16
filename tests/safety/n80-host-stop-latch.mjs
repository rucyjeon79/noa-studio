// Regression test: resident N80 launch paths are permanently retired.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const launch=fs.readFileSync('runtime/hub/launch.mjs','utf8');
const runner=fs.readFileSync('runtime/hub/runner.mjs','utf8');
const bootstrap=fs.readFileSync('scripts/n80_hub_bootstrap.py','utf8');
const php=fs.readFileSync('deploy/noa-app/engine/hub.php','utf8');
assert(launch.includes('hub_resident_runner_retired'));
assert(!launch.includes('spawn(') && !launch.includes('child_process') && !launch.includes('runner.mjs'));
assert(runner.includes('hub_resident_runner_retired'));
assert(!runner.includes('while(') && !runner.includes('setTimeout') && !runner.includes('https.request') && !runner.includes('child_process'));
assert(bootstrap.includes('hub_resident_runner_retired'));
assert(!bootstrap.includes('transport.open_session') && !bootstrap.includes('channel.exec_command') && !bootstrap.includes("Path('runtime/hub"));
assert(php.includes("throw new DomainException('hub_resident_runner_retired')"));
assert(!php.includes('proc_open') && !php.includes('launch.mjs'));
for (const file of ['runtime/hub/launch.mjs','runtime/hub/runner.mjs']) {
  const run=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:5000});
  assert.notEqual(run.status,0,file+' must not launch');
  assert.match(run.stderr,/hub_resident_runner_retired/,file+' must report retirement');
}
console.log('N80_RESIDENT_LAUNCH_RETIRED_PASS',{caseCount:8,processesStarted:0,hostWrites:0});
