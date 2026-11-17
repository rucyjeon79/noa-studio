/** Explicit local image-motion rendering for ChatGPT-directed N80 sessions. */
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {outputDimensions} from './session-assemble.mjs';
const exec=promisify(execFile);
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex');
export async function renderMotion(image,imageSha256,format,output,{seconds=8,resolution=1080}={}){
 if(!Number.isFinite(seconds)||seconds<.05||seconds>30)throw Error('invalid_motion_duration');
 if(!/^[a-f0-9]{64}$/.test(imageSha256)||await hash(image)!==imageSha256)throw Error('image_checksum_mismatch');
 const [width,height]=outputDimensions(format,resolution),frames=Math.ceil(seconds*24);
 // Fit the entire approved image; never crop the official face to change aspect ratio.
 const filter=`scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black,zoompan=z='1+0.035*on/${Math.max(1,frames-1)}':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=${frames}:s=${width}x${height}:fps=24,format=yuv420p`;
 await exec('ffmpeg',['-v','error','-nostdin','-i',image,'-vf',filter,'-frames:v',String(frames),'-an','-c:v','libx264','-preset','fast','-crf','19','-threads','2','-movflags','+faststart','-y',output],{timeout:180000});
 const {stdout}=await exec('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output]);
 const p=JSON.parse(stdout),v=p.streams.find(s=>s.codec_type==='video');
 if(!v||p.streams.some(s=>s.codec_type==='audio')||v.width!==width||v.height!==height||Number(v.nb_frames)!==frames)throw Error('motion_validation_failed');
 await exec('ffmpeg',['-v','error','-xerror','-i',output,'-f','null','-'],{timeout:180000});
 return {method:'image_motion',generativeVideo:false,sourceImageSha256:imageSha256,sourceUrl:'https://chatgpt.com/',file:output,sha256:await hash(output),bytes:(await stat(output)).size,width,height,duration:Number(v.duration),decoded:true};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const [image,sha,format,output]=process.argv.slice(2);
 if(!output)throw Error('Usage: node session-motion.mjs image image-sha256 landscape|shorts output.mp4');
 console.log(JSON.stringify(await renderMotion(image,sha,format,output)));
}
