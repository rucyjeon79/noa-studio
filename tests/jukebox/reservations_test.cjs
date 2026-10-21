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
