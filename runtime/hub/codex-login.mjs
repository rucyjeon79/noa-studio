/** One bounded official ChatGPT device login. Tokens remain in host Codex storage. */
import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root='/hosting/noastudio/noa-hub/codex';
const statePath=`${root}/login-status.json`;
const publicKey=process.argv[3];
const atomic=value=>{const temp=statePath+'.tmp-'+process.pid;fs.writeFileSync(temp,JSON.stringify(value),{mode:0o600});fs.renameSync(temp,statePath);};
const read=()=>{try{return JSON.parse(fs.readFileSync(statePath,'utf8'));}catch{return null;}};
const allowed=new Set(['PATH','HOME','LANG','LC_ALL','TMPDIR','SSL_CERT_FILE','SSL_CERT_DIR']);
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>allowed.has(k)));
const status=JSON.parse(fs.readFileSync(`${root}/status.json`,'utf8'));
if(status.nativeVersion!==true||status.version!=='0.167.1')throw new Error('codex_not_verified');
if(status.loginState==='chatgpt'){console.log(JSON.stringify({state:'already_authenticated'}));process.exit(0);}

if(process.argv[2]==='monitor'){
  const lock=`${root}/login.lock`;
  try{fs.mkdirSync(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')process.exit(0);throw e;}
  const startedAt=Math.floor(Date.now()/1000);
  let text='',challenge=false,finished=false;
  atomic({state:'connecting',pid:process.pid,startedAt,generationRequests:0});
  const child=spawn(`${root}/0.167.1/codex`,['--no-daemon','-c','forced_login_method="chatgpt"','login','--device-auth'],{env,stdio:['ignore','pipe','pipe']});
  const finish=(state,detail={})=>{
    if(finished)return;finished=true;clearTimeout(timer);
    atomic({state,startedAt,finishedAt:Math.floor(Date.now()/1000),generationRequests:0,...detail});
    try{fs.rmdirSync(lock);}catch{}
  };
  const timer=setTimeout(()=>{child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),3000).unref();finish('expired');},15*60*1000);
  const collect=data=>{
    text+=data.toString();if(text.length>65536){child.kill('SIGTERM');finish('output_limit');return;}
    const clean=text.replace(/\x1b\[[0-9;]*m/g,'');
    const code=clean.match(/\n\s+([A-Z0-9]{3,10}-[A-Z0-9]{3,10})\s*\n/);
    if(!challenge&&clean.includes('https://auth.openai.com/codex/device')&&code){
      challenge=true;
      const payload=JSON.stringify({url:'https://auth.openai.com/codex/device',code:code[1],expiresAt:startedAt+900});
      const ciphertext=crypto.publicEncrypt({key:publicKey,oaepHash:'sha256'},Buffer.from(payload)).toString('base64');
      atomic({state:'authorization_required',startedAt,expiresAt:startedAt+900,ciphertext,generationRequests:0});
    }
  };
  child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.on('error',e=>finish('login_process_failed',{error:/^[A-Z_]+$/.test(e.code||'')?e.code:'SPAWN_ERROR'}));
  child.on('exit',(code,signal)=>{
    const reason=/device.*(?:not enabled|disabled)/i.test(text)?'device_login_disabled':/dns|lookup|resolve/i.test(text)?'dns_error':/timed out|timeout/i.test(text)?'network_timeout':/403|forbidden/i.test(text)?'access_denied':'login_failed';
    finish(code===0?'authenticated':reason,{exitCode:code,signal});
  });
}else if(process.argv[2]==='start'){
  const previous=read();
  if(previous?.state==='authenticated'){console.log(JSON.stringify(previous));process.exit(0);}
  if(previous&&['connecting','authorization_required'].includes(previous.state)&&Date.now()/1000-previous.startedAt<900){console.log(JSON.stringify(previous));process.exit(0);}
  if(fs.existsSync(`${root}/login.lock`))throw new Error('previous_login_unconfirmed');
  const command=JSON.parse(fs.readFileSync('/hosting/noastudio/noa-hub/node-command.json','utf8'));
  if(!Array.isArray(command)||command.some(a=>a!=='--library-path'&&!/^\/hosting\/noastudio\/noa-ai-lab\/host-runtime\/(?:node-[a-f0-9]{16}|lib-[a-f0-9]{16}(?:\/ld-linux-x86-64[.]so[.]2)?)$/.test(a)))throw new Error('host_node_command_invalid');
  const monitor=spawn(command[0],[...command.slice(1),fileURLToPath(import.meta.url),'monitor',publicKey],{env,detached:true,stdio:'ignore'});monitor.unref();
  const deadline=Date.now()+35000;
  while(Date.now()<deadline){const s=read();if(s&&s.state!=='connecting'){console.log(JSON.stringify(s));process.exit(0);}await new Promise(r=>setTimeout(r,500));}
  console.log(JSON.stringify(read()||{state:'login_start_unconfirmed'}));
}else throw new Error('login_action_invalid');
