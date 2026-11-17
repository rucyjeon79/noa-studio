import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {renderMotion} from '../../lab/session-motion.mjs';
import {assemble} from '../../lab/session-assemble.mjs';
const dir='/tmp/n80-manual-production';await mkdir(dir,{recursive:true});
const ff=(...args)=>execFileSync('ffmpeg',['-v','error','-threads','1','-y',...args]);
const sha=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
const image=dir+'/image.png',audio=dir+'/song.wav';
ff('-f','lavfi','-i','testsrc=size=640x360','-frames:v','1','-threads','1',image);
ff('-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','4',audio);
const imageSha=await sha(image),audioSha=await sha(audio);
await assert.rejects(()=>renderMotion(image,'0'.repeat(64),'landscape',dir+'/bad.mp4'),/checksum/);
for(const format of ['landscape','shorts']){
 const clip=await renderMotion(image,imageSha,format,dir+'/'+format+'-clip.mp4',{seconds:4,resolution:720});
 assert.equal(clip.generativeVideo,false);assert.equal(clip.decoded,true);
 const duration=format==='landscape'?4:2,selection=format==='shorts'?{start:1,end:3}:null;
 const manifest={format,duration,sourceDuration:4,selection,audio:{path:audio,sha256:audioSha},scenes:[{n:1,path:clip.file,sha256:clip.sha256}],layout:{ready:true,fps:24,overlapFrames:0,targetFrames:duration*24,scenes:[{n:1,startFrame:0,frames:duration*24,sha256:clip.sha256}]}};
 const result=await assemble(manifest,dir+'/'+format+'-final.mp4');
 assert.equal(result.duration,duration);assert.equal(result.verification.audioMapped,true);assert.equal(result.verification.decoded,true);
 assert.deepEqual([result.width,result.height],format==='landscape'?[1280,720]:[720,1280]);
 await assert.rejects(()=>assemble({...manifest,format:'landscape',selection:{start:1,end:3}},dir+'/bad.mp4'),/invalid_short_selection/);
}
console.log('Manual production: verified image → motion MP4 → full-song landscape / 2s selected portrait → decoded original-audio final; checksum and landscape crop rejected.');
