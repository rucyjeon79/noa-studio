import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {assemble} from '../../lab/session-assemble.mjs';
const dir=path.resolve(process.argv[2]||'/tmp/n80-session-fixture');await mkdir(dir,{recursive:true});
const ff=(...args)=>execFileSync('ffmpeg',['-v','error','-y',...args]);
const hash=async f=>createHash('sha256').update(await readFile(f)).digest('hex');
const audio=path.join(dir,'audio.wav');ff('-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5',audio);
ff('-f','lavfi','-i','color=c=blue:s=512x288','-frames:v','1','-threads','1',path.join(dir,'image.png'));
const scenes=[];for(const [i,color]of ['red','blue'].entries()){const file=path.join(dir,`clip-${i+1}.mp4`);ff('-f','lavfi','-i',`color=c=${color}:s=512x288:r=24`,'-f','lavfi','-i','sine=frequency=1000:sample_rate=48000','-t','3','-c:v','libx264','-pix_fmt','yuv420p','-threads','1','-c:a','aac',file);scenes.push({n:i+1,path:file,sha256:await hash(file)});}
const manifest={format:'landscape',duration:5,audio:{path:audio,sha256:await hash(audio)},layout:{ready:true,fps:24,overlapFrames:24,targetFrames:120,scenes:scenes.map((s,i)=>({n:s.n,startFrame:i*48,frames:72,sha256:s.sha256}))},scenes};
const output=path.join(dir,'final.mp4'),receipt=await assemble(manifest,output);assert.equal(receipt.verification.decoded,true);assert.equal(receipt.duration,5);
await assert.rejects(()=>assemble({...manifest,audio:{...manifest.audio,sha256:'0'.repeat(64)}},output),/checksum/);
await assert.rejects(()=>assemble({...manifest,layout:{...manifest.layout,scenes:manifest.layout.scenes.map((s,i)=>({...s,startFrame:i*49}))}},path.join(dir,'bad.mp4')),/timeline/);
// The clip sound is 1000 Hz; final output must correlate with the original 440 Hz audio.
const pcm=f=>execFileSync('ffmpeg',['-v','error','-i',f,'-map','0:a:0','-ac','1','-ar','48000','-f','f32le','-']);
const ref=pcm(audio),actual=pcm(output);let xy=0,xx=0,yy=0;
for(let n=2048;n<Math.min(ref.length,actual.length)/4-2048;n++){const x=ref.readFloatLE(n*4),y=actual.readFloatLE(n*4);xy+=x*y;xx+=x*x;yy+=y*y;}
assert(xy/Math.sqrt(xx*yy)>.98,'Original song must be mapped, not generated clip audio');
await writeFile(path.join(dir,'receipt.json'),JSON.stringify(receipt));
await writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest));
console.log('Assembly: full decode, exact song endpoint, original audio correlation, source checks and overlap passed.');
