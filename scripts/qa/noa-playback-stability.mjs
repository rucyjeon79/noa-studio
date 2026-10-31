import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import assert from 'node:assert/strict';
const script=readFileSync('deploy/noa-app/playback-recovery.js','utf8');
const rate=8000,seconds=25,wav=Buffer.alloc(44+rate*seconds*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);for(let i=0;i<rate*seconds;i++)wav.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*220/rate)*1200),44+i*2);
let requests=0;const open=new Set();
const html=`<button id="start">play</button><audio id="audio" preload="none" src="/audio.wav"></audio><script>${script}</script><script>
const a=document.getElementById('audio');let wanted=false;window.messages=[];
window.recovery=NoaPlaybackRecovery.attach(a,{wanted:()=>wanted,key:()=> 'one',status:m=>messages.push(m)});
document.getElementById('start').onclick=()=>{wanted=true;a.play();};
window.userPause=()=>{wanted=false;a.pause();};
</script>`;
const server=createServer((req,res)=>{
 if(req.url==='/audio.wav'){
  requests++;res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':wav.length,'Cache-Control':'no-store'});
  if(requests===1){res.write(wav.subarray(0,44+rate*2));open.add(res);res.on('close',()=>open.delete(res));}
  else res.end(wav);
 }else {res.writeHead(200,{'Content-Type':'text/html'});res.end(html);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required']});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);await page.click('#start');
 await page.waitForFunction(()=>document.getElementById('audio').currentTime>2,{},{timeout:40000});
 assert.ok(requests>=2,'stalled transfer must be requested again');
 await page.evaluate(()=>userPause());const count=requests;await page.waitForTimeout(1500);assert.equal(await page.evaluate(()=>document.getElementById('audio').paused),true);assert.equal(requests,count);
 console.log('REAL_AUDIO_STALLED_TRANSFER_RESUMED_AND_MANUAL_PAUSE_PRESERVED',JSON.stringify({requests,messages:await page.evaluate(()=>messages)}));
}finally{await browser.close();for(const res of open)res.destroy();server.closeAllConnections();await new Promise(r=>server.close(r));}
