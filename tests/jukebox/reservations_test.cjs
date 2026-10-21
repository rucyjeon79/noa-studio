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
