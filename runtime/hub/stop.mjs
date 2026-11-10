import fs from 'node:fs';
const lock='/hosting/noastudio/noa-hub/runner.lock';
if(!fs.existsSync(lock)){console.log('N80_HUB_STOPPED');process.exit(0);}
if(fs.lstatSync(lock).isSymbolicLink()||fs.realpathSync(lock)!==lock)throw new Error('hub_lock_unsafe');
const pid=Number(fs.readFileSync(lock+'/pid','utf8'));
if(!Number.isSafeInteger(pid)||pid<2||pid===process.pid)throw new Error('hub_lock_invalid');
try{process.kill(pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')throw e;fs.unlinkSync(lock+'/pid');fs.rmdirSync(lock);}
for(let i=0;i<50&&fs.existsSync(lock);i++)await new Promise(r=>setTimeout(r,100));
if(fs.existsSync(lock))throw new Error('hub_stop_unconfirmed');console.log('N80_HUB_STOPPED');
