/** Host-owned N80 Auto scheduler. No GitHub APIs, external queues or provider keys. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import https from 'node:https';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function signature(body, key, timestamp, nonce) {
  return crypto.createHmac('sha256', key).update(`N80-HUB-1\n${crypto.createHash('sha256').update(body).digest('hex')}\n${timestamp}\n${nonce}`).digest('hex');
}
export function due(operation, row, state, requested, now) {
  if (state.pending) return now >= (state.nextAt || 0);
  return !state.unconfirmed && (now >= (state.nextAt || 0) || (requested || 0) > (state.requestedAt || 0));
}
function atomic(name, value) {
  const target = path.join(root, name), temp = target + '.tmp-' + crypto.randomBytes(8).toString('hex');
  fs.writeFileSync(temp, JSON.stringify(value), {mode:0o600, flag:'wx'});fs.renameSync(temp,target);
}
function problem(error,stage){const code=String(error?.code||error?.message||'hub_failed');atomic('runner-error.json',{error:/^(?:hub_[a-z_]+|[A-Z_]+)$/.test(code)?code:'hub_failed',stage,at:Math.floor(Date.now()/1000)});}
function read(name, fallback={}) {try{return JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
function call(body, timeout=20000) {
  const data=JSON.stringify(body), key=fs.readFileSync('/hosting/noastudio/noa-ai-lab/worker.key','utf8').trim();
  if(!/^[a-f0-9]{64}$/.test(key))throw new Error('hub_key_invalid');
  const ts=String(Math.floor(Date.now()/1000)), nonce=crypto.randomBytes(16).toString('hex');
  const route=read('transport.json',{route:'https_ipv4'}).route;if(!['https_ipv4','https_loopback','loopback'].includes(route))throw new Error('hub_transport_invalid');
  const local=route==='loopback',client=local?http:https;const hostname=route==='https_ipv4'?'noastudio.ai.kr':'127.0.0.1';
  return new Promise((resolve,reject)=>{
    const req=client.request({hostname,...(!local?{servername:'noastudio.ai.kr'}:{}),family:4,path:'/noa-bridge/hub-worker.php',method:'POST',timeout,
      headers:{Host:'noastudio.ai.kr','Content-Type':'application/json','Content-Length':Buffer.byteLength(data),'X-N80-Time':ts,'X-N80-Nonce':nonce,'X-N80-Signature':signature(data,key,ts,nonce)}},res=>{
      let chunks=[],bytes=0;res.on('data',chunk=>{bytes+=chunk.length;if(bytes>262144){res.destroy();reject(new Error('hub_output_limit'));}else chunks.push(chunk);});
      res.on('end',()=>{try{const result=JSON.parse(Buffer.concat(chunks).toString());if(res.statusCode!==200||result.ok!==true)throw new Error(result.error||'hub_http_failed');resolve(result);}catch(e){reject(e);}});res.on('error',reject);
    });const deadline=setTimeout(()=>req.destroy(new Error('hub_timeout')),timeout);req.once('close',()=>clearTimeout(deadline));req.on('timeout',()=>req.destroy(new Error('hub_timeout')));req.on('error',reject);req.end(data);
  });
}
export async function run() {
  if(root!=='/hosting/noastudio/noa-hub')throw new Error('hub_host_required');
  const lock=path.join(root,'runner.lock');
  try{fs.mkdirSync(lock,{mode:0o700});}catch(e){if(e.code==='EEXIST')return;throw e;}
  fs.writeFileSync(path.join(lock,'pid'),String(process.pid),{mode:0o600});
  const stop=()=>{try{fs.unlinkSync(path.join(lock,'pid'));fs.rmdirSync(lock);}catch{};process.exit(0);};
  process.on('SIGTERM',stop);process.on('SIGINT',stop);
  const operations=read('operations.json'), state=read('scheduler.json');
  let stopping=false;
  process.on('uncaughtException',()=>{atomic('runner-error.json',{error:'hub_runner_failed',at:Date.now()});stop();});
  while(!stopping){
    if(read('control.json').stop===true)break;
    try{
      const beat=await call({action:'heartbeat'}), now=Math.floor(Date.now()/1000);
      if(beat.control.stop===true){stopping=true;break;}
      for(const [op,row] of Object.entries(operations)){
        if(!beat.control.activeOperations.includes(op)||(beat.control.paused&&op!=='hub.verify'))continue;
        const s=state[op]??={};if(!due(op,row,s,beat.requests[op],now))continue;
        s.pending??=Math.floor(Date.now()/1000).toString(16).padStart(8,'0')+crypto.randomBytes(12).toString('hex');atomic('scheduler.json',state);
        try{
          const reply=await call({action:'execute',operation:op,id:s.pending},(row.timeout+10)*1000);
          if(reply.receipt.state==='running') {s.unconfirmed=true;s.nextAt=now+60;} else {s.lastState=reply.receipt.state;s.pending=null;s.unconfirmed=false;s.nextAt=now+(reply.receipt.state==='succeeded'?row.interval:Math.max(row.interval,300));s.requestedAt=beat.requests[op]||0;}
          atomic('scheduler.json',state);
          await call({action:'heartbeat'});
        }catch(error){problem(error,'execute');s.nextAt=now+60;atomic('scheduler.json',state);break; }
      }
    }catch(error){problem(error,'heartbeat'); /* No second executor or credential fallback on an ambiguous response. */ }
    await new Promise(resolve=>setTimeout(resolve,10000));
  }
  stop();
}
if(process.argv[1]===fileURLToPath(import.meta.url))run().catch(error=>{problem(error,'startup');process.exitCode=1;});
