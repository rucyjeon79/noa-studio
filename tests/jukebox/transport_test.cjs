const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');const context={module:{exports:{}},setTimeout};vm.createContext(context);vm.runInContext(fs.readFileSync('deploy/noa-app/jukebox/upload-transport.js','utf8'),context);const {Transport,UploadError,decode}=context.module.exports;
async function main(){
 const records=[],delays=[];let trips=0,calls=0;
 const t=new Transport({onRecord:r=>records.push(r),onTrip:()=>trips++,sleep:async ms=>delays.push(ms)});
 await assert.rejects(t.run(async()=>{calls++;return decode('<html>password=never-log-this</html>',{http:503,type:'text/html',stage:'chunk',uploadId:'a'.repeat(32)});}),e=>e.message==='response_html');
 assert.equal(calls,3);assert.equal(trips,1);assert.equal(t.open,true);assert.deepEqual(delays,[1000,2000]);
 assert(!JSON.stringify(records).includes('password'));assert(!JSON.stringify(records).includes('never-log-this'));
 await assert.rejects(t.run(async()=>{calls++;}),/transfer_circuit_open/);assert.equal(calls,3);
 // A health success cannot silently reset three failed transfer requests.
 assert.deepEqual(await t.run(async()=>({ok:true}),{mutating:false}),{ok:true});assert.equal(t.open,true);t.reset();
 let sequence=0;assert.deepEqual(await t.run(async()=>{sequence++;if(sequence===1)throw new UploadError('network_unavailable',{stage:'finish',transient:true});return {done:true};},{recover:async()=>({done:true,recovered:true})}),{done:true,recovered:true});assert.equal(sequence,1);
 t.reset();for(let i=0;i<4;i++)await assert.rejects(t.run(async()=>decode('{"error":"actual_audio_format_mismatch"}',{http:400,type:'application/json',stage:'finish'})),/actual_audio_format_mismatch/);assert.equal(t.open,false);assert.equal(t.failures,0);
 const waits=[];const rate=new Transport({sleep:async ms=>waits.push(ms)});let attempt=0;assert.deepEqual(await rate.run(async()=>{if(++attempt<3)throw new UploadError('http_429',{http:429,stage:'chunk',transient:true,retryAfter:8000});return {sent:true};}),{sent:true});assert.deepEqual(waits,[8000,8000]);assert.equal(rate.failures,0);
 const html=new Transport({sleep:async()=>{}});await assert.rejects(html.run(async()=>decode('<!doctype html>',{http:200,type:'text/html',stage:'init'})),/response_html/);assert.equal(html.open,true);
 const rejectedFile=new Transport({sleep:async()=>{}});let badFileRequests=0;await assert.rejects(rejectedFile.run(async()=>{badFileRequests++;return decode('<!doctype html>',{http:400,type:'text/html',stage:'finish'});},{recover:async()=>{throw new UploadError('actual_audio_format_mismatch',{http:400,stage:'reconcile',format:'json'});}}),/actual_audio_format_mismatch/);assert.equal(badFileRequests,1);assert.equal(rejectedFile.open,false);assert.equal(rejectedFile.failures,0);
 assert.throws(()=>decode('',{http:200,type:'application/json',stage:'finish'}),e=>e.message==='response_empty'&&e.transient);
 assert.throws(()=>decode('{broken',{http:200,type:'application/json',stage:'finish'}),/response_json_invalid/);
 assert.throws(()=>decode('{"error":"AUTH_TOKEN_must_not_be_logged"}',{http:503,type:'application/json',stage:'init'}),e=>e.message==='http_503'&&!JSON.stringify(e.safe()).includes('AUTH_TOKEN'));
 assert.throws(()=>decode('<!doctype html>',{http:409,type:'text/html',stage:'init',serverCode:'temporary_storage_quota_reached'}),e=>e.message==='temporary_storage_quota_reached'&&!e.transient&&e.format==='html');
 assert.throws(()=>decode('<!doctype html>',{http:507,type:'text/html',stage:'finish',serverCode:'hosting_storage_insufficient'}),e=>e.message==='hosting_storage_insufficient'&&e.transient);
 assert.throws(()=>decode('<!doctype html>',{http:400,type:'text/html',stage:'finish',serverCode:'actual_audio_format_mismatch'}),e=>e.message==='actual_audio_format_mismatch'&&!e.transient);
 assert.throws(()=>decode('<!doctype html>',{http:503,type:'text/html',serverCode:'AUTH_TOKEN_must_not_be_logged'}),e=>e.message==='response_html'&&!JSON.stringify(e.safe()).includes('AUTH_TOKEN'));
 console.log('PASS 503/HTML/empty/invalid response classification, sanitized logs, three-strike circuit, explicit resume, lost-ack recovery, 429 backoff and per-song format-error isolation');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
