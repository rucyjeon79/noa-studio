// Regression test: resident N80 launch paths are permanently retired.
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const launch=fs.readFileSync('runtime/hub/launch.mjs','utf8');
const runner=fs.readFileSync('runtime/hub/runner.mjs','utf8');
const bootstrap=fs.readFileSync('scripts/n80_hub_bootstrap.py','utf8');
const php=fs.readFileSync('deploy/noa-app/engine/hub.php','utf8');
assert(launch.includes('hub_resident_runner_retired'));
assert(!/\\bspawn\\s*\\(|child_process|runner[.]mjs|control[.]json/.test(launch));
assert(runner.includes('hub_resident_runner_retired'));
assert(!/\\bwhile\\s*\\(|setTimeout|https[.]request|http[.]request|child_process|scheduler[.]json/.test(runner));
assert(bootstrap.includes('hub_resident_runner_retired'));
assert(!/\\btransport[.]open_session|channel[.]exec_command|Path\\('runtime\\/hub/.test(bootstrap));
assert(php.includes("throw new DomainException('hub_resident_runner_retired')"));
assert(!/proc_open|launch[.]mjs/.test(php));
for(const file of ['runtime/hub/launch.mjs','runtime/hub/runner.mjs']){
  const run=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:5000});
  assert.notEqual(run.status,0,file+' must not launch');
  assert.match(run.stderr,/hub_resident_runner_retired/,file+' must report retirement');
}
console.log('N80_RESIDENT_LAUNCH_RETIRED_PASS',{caseCount:8,processesStarted:0,hostWrites:0});
