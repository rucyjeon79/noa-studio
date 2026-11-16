// Verify emergency stop guards without a live server, credentials, or deployment.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';

const launch=fs.readFileSync('runtime/hub/launch.mjs','utf8');
const bootstrap=fs.readFileSync('scripts/n80_hub_bootstrap.py','utf8');
const php=fs.readFileSync('deploy/noa-app/engine/hub.php','utf8');
const runner=fs.readFileSync('runtime/hub/runner.mjs','utf8');
const guardPos=launch.indexOf("if(control.stop===true||control.paused===true)");
const spawnPos=launch.indexOf("const child=spawn(");
assert(guardPos>0 && guardPos<spawnPos,'launch must refuse stop or pause before spawn');
assert(bootstrap.includes("raise RuntimeError('hub_owner_stop_latched')"),'bootstrap must preserve stop');
assert(bootstrap.indexOf("previous_control=read(ROOT+'/control.json')")<bootstrap.indexOf("mkdir(ROOT)"),
  'bootstrap owner-stop preflight must run before file changes');
assert(!bootstrap.includes("control['stop']=False"),'bootstrap cannot reset owner stop');
assert(php.includes("throw new DomainException('hub_owner_stop_latched')"),'PHP entry must refuse restart');
assert(php.indexOf("hub_owner_stop_latched")<php.indexOf("if(!function_exists('proc_open'))"),
  'PHP must refuse before process creation');
assert(runner.includes("if(read('control.json').stop===true)break;"),'runner must honor stop');

for(const [caseId,flags] of [
  ['stopped',{stop:true,paused:false}],
  ['paused',{stop:false,paused:true}],
  ['both',{stop:true,paused:true}],
]){
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'n80-host-stop-test-'));
 try{
  const candidate=launch.replace("const root='/hosting/noastudio/noa-hub'",
     "const root="+JSON.stringify(tmp));
  assert.notEqual(candidate,launch,'test runner root substitution failed');
  const file=path.join(tmp,'launch.mjs');
  fs.writeFileSync(file,candidate);
  fs.writeFileSync(path.join(tmp,'control.json'),JSON.stringify(flags));
  const result=spawnSync(process.execPath,[file],{encoding:'utf8',timeout:5000});
  assert.notEqual(result.status,0,'stop guard must reject '+caseId);
  assert.match(result.stderr,/hub_owner_stop_latched/,'expected refusal reason '+caseId);
  assert.equal(fs.existsSync(path.join(tmp,'runner.lock')),false,'no runner should spawn');
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
}
console.log('N80_OWNER_STOP_GUARD_PASS',JSON.stringify({
 check:'stop_pause_prevent_detached_launch',cases:3,serverWrites:0,
 sourceGuard:true,bootstrapDoesNotResetStop:true,phpRefusal:true
}));
