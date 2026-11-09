import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root='/hosting/noastudio/noa-hub',lock=path.join(root,'runner.lock');
if(fs.existsSync(lock)){
 if(fs.lstatSync(lock).isSymbolicLink())throw new Error('hub_lock_unsafe');
 const pid=Number(fs.readFileSync(path.join(lock,'pid'),'utf8'));
 if(!Number.isSafeInteger(pid)||pid<2)throw new Error('hub_lock_invalid');
 try{process.kill(pid,0);console.log('N80_HUB_RUNNING');process.exit(0);}catch(e){if(e.code!=='ESRCH')throw e;}
 fs.unlinkSync(path.join(lock,'pid'));fs.rmdirSync(lock);
}
const command=JSON.parse(fs.readFileSync(path.join(root,'node-command.json'),'utf8'));
if(!Array.isArray(command)||command.length<1||command.length>4||command.some(v=>typeof v!=='string'||v.includes('\0')))throw new Error('hub_node_command_invalid');
const child=spawn(command[0],[...command.slice(1),path.join(root,'runtime','runner.mjs')],{detached:true,stdio:'ignore',cwd:root,env:{PATH:'/usr/bin:/bin',LANG:'C.UTF-8'}});
child.unref();console.log('N80_HUB_START_REQUESTED');
