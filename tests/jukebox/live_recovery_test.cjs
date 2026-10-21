// Authenticated HTTP integration against the production PHP service, restricted
// server-side to private QA cards. This is not a browser/UI automation test.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const context={module:{exports:{}},setTimeout};vm.createContext(context);vm.runInContext(fs.readFileSync('deploy/noa-app/jukebox/upload-transport.js','utf8'),context);
const {Transport,UploadError,decode}=context.module.exports,key=process.env.NOA_JUKEBOX_SERVICE_KEY;
if(!key||key.length!==64)throw Error('private_service_key_required');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
let requestCount=0;const diagnostics=[];
async function raw(action,payload={}){
 const body=JSON.stringify({action,payload}),timestamp=String(Math.floor(Date.now()/1000)),nonce=crypto.randomBytes(16).toString('hex');
 const signature=crypto.createHmac('sha256',key).update('NOA-JUKEBOX-1\nPOST\n'+digest(body)+'\n'+timestamp+'\n'+nonce).digest('hex');requestCount++;
 let response;
 try{response=await fetch('https://noastudio.ai.kr/noa-app/jukebox/service.php',{method:'POST',headers:{'Content-Type':'application/json','X-NOA-Timestamp':timestamp,'X-NOA-Nonce':nonce,'X-NOA-Signature':signature},body,signal:AbortSignal.timeout(90000)});}
 catch{throw new UploadError('network_unavailable',{stage:payload.mode||action,uploadId:payload.id,transient:true});}
 const parsed=decode(await response.text(),{http:response.status,type:response.headers.get('Content-Type'),stage:payload.mode||action,uploadId:payload.id,requestId:response.headers.get('X-NOA-Request-ID'),retryAfter:Number(response.headers.get('Retry-After'))*1000});
 if(parsed.ok!==true||!parsed.result)throw new UploadError('response_schema_invalid',{http:response.status,stage:action,format:'json',transient:true});return parsed.result;
}
function transport(){return new Transport({onRecord:row=>diagnostics.push(row)});}
const control=transport();const get=(a,b)=>control.run(()=>raw(a,b),{mutating:false});
function wav(frequency){const rate=48000,frames=rate*4,bytes=Buffer.alloc(44+frames*4);bytes.write('RIFF');bytes.writeUInt32LE(bytes.length-8,4);bytes.write('WAVEfmt ',8);bytes.writeUInt32LE(16,16);bytes.writeUInt16LE(1,20);bytes.writeUInt16LE(2,22);bytes.writeUInt32LE(rate,24);bytes.writeUInt32LE(rate*4,28);bytes.writeUInt16LE(4,32);bytes.writeUInt16LE(16,34);bytes.write('data',36);bytes.writeUInt32LE(frames*4,40);for(let i=0;i<frames;i++){const sample=Math.round(Math.sin(i/rate*Math.PI*2*frequency)*6000);bytes.writeInt16LE(sample,44+i*4);bytes.writeInt16LE(sample,46+i*4);}return bytes;}
async function main(){
 await get('maintenance');const before=await get('verification_snapshot'),qa='jukebox:qa:fifo-01';
 const checks={};
 for(const [scenario,label] of [['http_503','503_three_strike_pause'],['html_response','html_three_strike_pause'],['storage_insufficient','storage_failure_is_explicit']]){
  const t=transport();let calls=0;await assert.rejects(t.run(()=>{calls++;return raw('qa_probe',{key:qa,mode:scenario});}));assert.equal(calls,3);assert.equal(t.open,true);
  await assert.rejects(t.run(()=>{calls++;return raw('qa_probe',{key:qa,mode:scenario});}),/transfer_circuit_open/);assert.equal(calls,3);checks[label]=true;
 }
 const health=await get('runtime_health');assert(health.storage_available,'storage_not_available_after_rescue');
 const uploads=[];let initRecovered=false,chunkRecovered=false,finishRecovered=false,duplicateSameId=false,resumeSkipped=false,formatIsolated=false;
 for(let i=0;i<10;i++){
  const song='jukebox:qa:fifo-'+String(i+1).padStart(2,'0'),data=wav(280+i*19+Number(BigInt(process.env.GITHUB_RUN_ID||'1')%37n));const hash=digest(data),filename='Recovery-'+String(i+1).padStart(2,'0')+'-'+process.env.GITHUB_RUN_ID+'.wav';let t=transport();
  if(i===2){
   const bad=Buffer.alloc(1024,120),b=await get('qa_upload',{mode:'init',key:song,filename:'Invalid-fixture.wav',bytes:bad.length,fingerprint:digest(bad)});await get('qa_upload',{mode:'chunk',id:b.id,index:0,chunk:bad.toString('base64')});
   await assert.rejects(t.run(()=>raw('qa_upload',{mode:'finish',id:b.id})),/actual_audio_format_mismatch/);assert.equal(t.open,false);const preserved=await get('verification_snapshot');assert.equal(preserved.files[song].sha256,before.files[song].sha256);formatIsolated=true;
  }
  const init={mode:'init',key:song,filename,bytes:data.length,fingerprint:digest(filename+':'+hash)};let u;
  for(let wait=0;;wait++){
   try{u=await t.run(()=>raw('qa_upload',{...init,drop_response:i===0}),{recover:async()=>{const q=await get('qa_upload',{mode:'latest',key:song});if(q.public?.upload?.fingerprint!==init.fingerprint)return null;initRecovered=true;return {id:q.id,status:q.status,chunks:q.chunks,chunkHashes:q.chunkHashes,chunkSize:q.chunkSize};}});break;}
   catch(e){if(!['temporary_storage_quota_reached','http_409'].includes(e.message)||wait>=18)throw e;await new Promise(r=>setTimeout(r,10000));}
  }
  if(i===4){const second=await get('qa_upload',init);assert.equal(second.id,u.id);duplicateSameId=true;}
  const received=new Set(u.chunks),chunkSize=u.chunkSize;let sentChunks=0;
  for(let index=0,offset=0;offset<data.length;index++,offset+=chunkSize){
   const part=data.subarray(offset,offset+chunkSize),partHash=digest(part);
   if(received.has(index)){assert.equal(u.chunkHashes[String(index)],partHash);continue;}
   let attempts=0;await t.run(()=>{attempts++;return raw('qa_upload',{mode:'chunk',id:u.id,index,chunk:part.toString('base64'),drop_response:i===1&&index===0});},{recover:async()=>{const q=await get('qa_upload',{mode:'status',id:u.id});if(q.chunkHashes[String(index)]!==partHash)return null;chunkRecovered=true;return {index,sha256:partHash};}});sentChunks++;
   if(i===1&&index===0)assert.equal(attempts,1);
   if(i===3&&index===0){t=transport();const resumed=await get('qa_upload',{...init,resume_id:u.id});assert.equal(resumed.id,u.id);assert.equal(resumed.chunkHashes['0'],partHash);resumeSkipped=true;}
  }
  const finished=await t.run(()=>raw('qa_upload',{mode:'finish',id:u.id,drop_response:i===0}),{recover:async()=>{const q=await get('qa_upload',{mode:'status',id:u.id});if(q.source_sha256!==hash||!((q.job&&q.source_verified)||(q.status==='ready'&&q.final_verified&&q.source_matches_final)))return null;finishRecovered=true;return q.public;}});
  assert(['queued','analyzing','processing','verifying','ready'].includes(finished.status));const q=await get('qa_upload',{mode:'status',id:u.id});assert.equal(q.source_sha256,hash);uploads.push({key:song,id:u.id,job_id:q.job?.id||null,status:q.status});
 }
 const selftest=await get('qa_selftest');assert.equal(selftest.transaction_rolled_back,true);assert(Object.values(selftest.tests).every(s=>s==='passed'));
 const after=await get('verification_snapshot');let realPreserved=0;for(const [song,file]of Object.entries(before.files)){if(song.startsWith('jukebox:qa:'))continue;assert.equal(after.files[song]?.sha256,file.sha256);realPreserved++;}assert.deepEqual(after.integrity,before.integrity);
 assert(initRecovered&&chunkRecovered&&finishRecovered&&duplicateSameId&&resumeSkipped&&formatIsolated);
 const result={checks:{...checks,init_response_recovered:initRecovered,chunk_response_recovered_without_resend:chunkRecovered,finish_response_recovered_without_reupload:finishRecovered,duplicate_same_upload_id:duplicateSameId,restarted_client_preserves_chunks:resumeSkipped,format_error_isolated:formatIsolated},uploads,registered:uploads.length,confirmed_real_mp3_preserved:realPreserved,integrity_unchanged:true,selftest,request_count:requestCount,diagnostics};
 fs.mkdirSync('jukebox-proof',{recursive:true});fs.writeFileSync('jukebox-proof/recovery-tests.json',JSON.stringify(result));console.log('JUKEBOX_LIVE_RECOVERY_TEST '+JSON.stringify(result));
}
main().catch(error=>{console.error('JUKEBOX_LIVE_RECOVERY_FAILED '+error.message);process.exitCode=1;});
