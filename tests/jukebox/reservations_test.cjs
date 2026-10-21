// Exercise the shipped cancellation handlers without depending on a browser's
// native file-picker automation support. No DOM events are synthesized in live UI.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('deploy/noa-app/jukebox/upload.js','utf8');
const originalFile={name:'original.wav'},reservation={file:originalFile,state:'paused',hold:true};
const context={selection:{existing:reservation,wasRunning:true},reservations:[reservation],paused:true,render(){},pump(){this.pumped=true},picker:{files:[],addEventListener(name,fn){this[name]=fn}}};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf('function releaseSelection(){'),source.indexOf('function openPicker(')),context);
vm.runInContext("picker.addEventListener('cancel',releaseSelection);",context);
context.picker.cancel();
assert.equal(context.selection,null);assert.equal(context.paused,false);
assert.equal(reservation.hold,false);assert.equal(reservation.state,'waiting');
assert.equal(reservation.file,originalFile);assert.equal(context.reservations.length,1);
context.selection={existing:reservation,wasRunning:false};reservation.hold=true;context.paused=true;
vm.runInContext(source.slice(source.indexOf('picker.onchange='),source.indexOf("artistDialog.addEventListener('cancel'")),context);
context.picker.onchange(); // a chooser returning no file must keep the old File
assert.equal(reservation.file,originalFile);assert.equal(reservation.hold,false);
assert.equal(context.paused,true);assert.equal(context.reservations.length,1);
console.log('PASS picker cancellation/no-file return preserves reservation identity and resumes only the interrupted transfer');

// A server-confirmed completion must survive the next page's storage merge,
// including when the original upload tab has already closed.
let disk=[{id:'reservation-a',key:'song-a',owner:'closed-tab',state:'uploading',uploadId:'upload-a',fingerprint:'source-a'}];
const saved=()=>JSON.parse(JSON.stringify(disk));
const resumed={deviceOwner:'new-tab',storeKey:'reservations',deviceKey:'owners',reservations:[{...disk[0],state:'ready',serverComplete:true,file:null}],notice:{},readSaved:saved,localStorage:{setItem(key,value){if(key==='reservations')disk=JSON.parse(value);},getItem(){return '{}';}}};
vm.createContext(resumed);
vm.runInContext(source.slice(source.indexOf('function persist(){'),source.indexOf('function syncReservations(')),resumed);
vm.runInContext(source.slice(source.indexOf('function syncReservations(){'),source.indexOf('function stopMusic(')),resumed);
resumed.persist();assert.equal(disk[0].state,'ready');assert.equal(disk[0].owner,'closed-tab');assert.equal(disk[0].file,undefined);resumed.syncReservations();assert.equal(resumed.reservations[0].state,'ready');
resumed.reservations=[{...disk[0],state:'uploaded',serverComplete:true}];resumed.persist();assert.equal(disk[0].state,'ready','late acknowledgement cannot demote confirmed ready');
disk=[{...disk[0],state:'waiting',fingerprint:'replacement-source',uploadId:'replacement-upload'}];resumed.reservations=[{...disk[0],fingerprint:'source-a',uploadId:'upload-a',state:'ready',serverComplete:true}];resumed.persist();assert.equal(disk[0].fingerprint,'replacement-source');assert.equal(disk[0].state,'waiting');
resumed.reservations=[{...disk[0],state:'paused',serverComplete:false}];resumed.persist();assert.equal(disk[0].state,'waiting','another tab cannot rewrite an unaccepted active reservation');
console.log('PASS reopened-tab completion persists, storage merge stays terminal, replacement identity and active owner remain protected');

// Queue polling may replace a foreign reservation object while its file is
// fingerprinted. The confirmed selection must attach to the current row.
(async()=>{
 let finishFingerprint;const fingerprintGate=new Promise(resolve=>finishFingerprint=resolve);
 const stale={id:'resume-row',key:'song-a',fingerprint:'same',state:'needs_file',owner:'closed-tab',hold:true};
 const selectedFile={name:'resume.wav',size:2048};
 const race={reservations:[stale],active:null,deviceOwner:'new-tab',notice:{},fingerprint(){return fingerprintGate},persist(){},releaseSelection(){},render(){},pump(){},crypto:{randomUUID(){return 'unexpected-new-row'}},message:code=>code,deviceKey:'owners',readSaved:()=>[{...stale,hold:undefined}],localStorage:{getItem(){return '{}'}}};
 vm.createContext(race);vm.runInContext(source.slice(source.indexOf('async function reserve('),source.indexOf('picker.onchange=')),race);
 vm.runInContext(source.slice(source.indexOf('function syncReservations(){'),source.indexOf('function stopMusic(')),race);
 const pending=race.reserve({existing:stale,key:'song-a'},selectedFile);
 race.syncReservations();finishFingerprint('same');await pending;
 assert.equal(race.reservations.length,1);assert.equal(race.reservations[0].file,selectedFile);assert.equal(race.reservations[0].state,'waiting');assert.equal(race.reservations[0].owner,'new-tab');
 console.log('PASS source reselection survives a queue refresh during fingerprinting');
})().catch(error=>{console.error(error);process.exitCode=1});

(async()=>{
 const row={id:'pending',state:'needs_file',owner:'closed',uploadId:'partial'};let canceled=0,applied=0;
 const c={active:null,deviceOwner:'current',busy:['queued','processing'],notice:{},isUnsent:r=>r.state==='needs_file',reconcile:async()=>({status:'uploading'}),api:async(action)=>{assert.equal(action,'cancel');canceled++},apply(){applied++},persist(){},render(){},message:code=>code};vm.createContext(c);vm.runInContext(source.slice(source.indexOf('async function cancelReservation('),source.indexOf('function releaseSelection(')),c);
 await c.cancelReservation(row);assert.equal(canceled,1);assert.equal(row.state,'replaced');assert.equal(row.owner,'current');assert.equal(row.hold,false);
 const accepted={id:'accepted',state:'needs_file',uploadId:'queued'};c.reconcile=async()=>({status:'processing',job:{id:10},public:{status:'processing'}});await c.cancelReservation(accepted);assert.equal(canceled,1);assert.equal(accepted.state,'uploaded');assert.equal(accepted.serverComplete,true);assert.equal(applied,1);
 const active={state:'needs_file',uploadId:'active'};c.active=active;await c.cancelReservation(active);assert.equal(canceled,1);assert.equal(active.state,'needs_file');
 const failedCancel={state:'needs_file',uploadId:'partial'};c.active=null;c.reconcile=async()=>({status:'uploading'});c.api=async()=>{throw Error('network_unavailable')};await c.cancelReservation(failedCancel);assert.equal(failedCancel.state,'needs_file');assert.equal(failedCancel.hold,false);
 console.log('PASS pending cancellation preserves accepted/active jobs and keeps a reservation on cancellation failure');
})().catch(error=>{console.error(error);process.exitCode=1});
