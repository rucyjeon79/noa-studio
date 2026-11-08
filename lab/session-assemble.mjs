/** Local media tool operated by ChatGPT; N80 owns the task, plan and receipts. */
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,writeFile,mkdtemp,rm,stat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import {validateSubtitles,selectSubtitleWindow,subtitleAss,subtitleFile} from './subtitles.mjs';
async function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{stdio:['ignore','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err=(err+b).slice(-8000));p.on('error',reject);p.on('close',code=>code===0?resolve(out):reject(Error(command+': '+err)));});}
async function sha(file){const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');}
async function probe(file){return JSON.parse(await run('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]));}
const encode=['-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-threads','2','-r','24','-fps_mode','cfr','-video_track_timescale','12288'];
export function outputDimensions(format,resolution=720){
 if(!['landscape','shorts'].includes(format)||![720,1080].includes(resolution))throw Error('invalid_output_resolution');
 const long=resolution===1080?1920:1280;return format==='shorts'?[resolution,long]:[long,resolution];
}
export async function assemble(m,output){
 const fps=24,layout=m.layout,format=m.format;
 if(!layout?.ready||layout.fps!==fps||!['landscape','shorts'].includes(format)||!Array.isArray(m.scenes)||m.scenes.length!==layout.scenes.length||!Number.isFinite(m.duration)||m.duration<=0||m.duration>3600)throw Error('invalid_manifest');
 const [w,h]=outputDimensions(format,m.outputResolution??720);
 if(await sha(m.audio.path)!==m.audio.sha256)throw Error('audio_checksum_mismatch');
 const selection=m.selection??null,sourceDuration=m.sourceDuration??m.duration;
 if(!Number.isFinite(sourceDuration)||(!selection&&sourceDuration!==m.duration))throw Error('invalid_source_duration');
 if(selection&&(format!=='shorts'||!Number.isFinite(selection.start)||!Number.isFinite(selection.end)||selection.start<0||selection.end>sourceDuration||m.duration<49||m.duration>59||Math.abs(selection.end-selection.start-m.duration)>.00001))throw Error('invalid_short_selection');
 const audio=await probe(m.audio.path);if(!audio.streams.some(s=>s.codec_type==='audio')||Math.abs(Number(audio.format.duration)-sourceDuration)>.15)throw Error('audio_duration_mismatch');
 const overlap=layout.overlapFrames;
 if(!Number.isInteger(overlap)||overlap<0||overlap>48||layout.targetFrames!==Math.ceil(m.duration*fps))throw Error('invalid_timeline');
 const subtitles=selectSubtitleWindow(validateSubtitles(m.subtitles,m.audio.sha256,sourceDuration),selection);
 const temp=await mkdtemp(path.join(os.tmpdir(),'n80-assemble-'));
 try{
  const norm=[],parts=[];
  let cursor=0;
  for(let i=0;i<m.scenes.length;i++){
   const row=layout.scenes[i],clip=m.scenes[i];
   if(clip.n!==row.n||clip.sha256!==row.sha256||await sha(clip.path)!==row.sha256||row.startFrame!==(i?cursor-overlap:0)||!Number.isInteger(row.frames)||row.frames<1)throw Error('scene_checksum_or_timeline_mismatch');
   const p=await probe(clip.path),v=p.streams.find(s=>s.codec_type==='video');
   if(!v||Math.floor(Number(v.duration??p.format.duration)*fps+1e-5)<row.frames|| (i&&row.frames<=overlap))throw Error('clip_too_short');
   cursor=row.startFrame+row.frames;
   const file=path.join(temp,`normal-${i}.mp4`);norm.push(file);
   // Pad rather than crop: provider marks and the entire approved frame remain visible.
   await run('ffmpeg',['-v','error','-nostdin','-i',clip.path,'-vf',`fps=${fps},scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2,setsar=1,trim=end_frame=${row.frames},setpts=PTS-STARTPTS`,...encode,file]);
  }
  if(cursor!==layout.targetFrames)throw Error('timeline_does_not_cover_song');
  async function segment(args,filter,frames){if(frames<=0)return;const file=path.join(temp,`part-${parts.length}.mp4`);await run('ffmpeg',['-v','error','-nostdin',...args,'-filter_complex_threads','1','-filter_complex',filter,'-frames:v',String(frames),...encode,file]);const proof=await probe(file);if(Number(proof.streams.find(s=>s.codec_type==='video')?.nb_frames)!==frames)throw Error('transition_frame_count');parts.push(file);}
  for(let i=0;i<norm.length;i++){
   const row=layout.scenes[i],start=i?overlap:0,end=row.frames-(i<norm.length-1?overlap:0);
   await segment(['-i',norm[i]],`[0:v]trim=start_frame=${start}:end_frame=${end},setpts=PTS-STARTPTS`,end-start);
   if(i<norm.length-1&&overlap){
    await segment(['-i',norm[i],'-i',norm[i+1]],`[0:v]trim=start_frame=${row.frames-overlap},setpts=PTS-STARTPTS,fps=24,settb=1/24[a];[1:v]trim=end_frame=${overlap},setpts=PTS-STARTPTS,fps=24,settb=1/24[b];[a][b]blend=all_expr='A*(1-min(1,N/${overlap}))+B*min(1,N/${overlap})':shortest=1`,overlap);
   }
  }
  const list=path.join(temp,'parts.txt');await writeFile(list,parts.map(f=>`file '${f.replaceAll("'","'\\''")}'`).join('\n'));
  const fade=Math.min(.5,m.duration/2);
  let subtitleFilter='';
  if(subtitles){const file=path.join(temp,'subtitles.ass');if(!/^[a-zA-Z0-9_./-]+$/.test(file))throw Error('unsafe_subtitle_path');await writeFile(file,subtitleAss(subtitles,format));subtitleFilter=`,ass=filename='${file}'`;}

  await run('ffmpeg',['-v','error','-nostdin','-f','concat','-safe','0','-i',list,...(selection?['-ss',String(selection.start)]:[]),'-i',m.audio.path,'-map','0:v:0','-map','1:a:0','-vf',`setpts=N/(24*TB),fade=t=in:st=0:d=${fade},fade=t=out:st=${Math.max(0,m.duration-fade)}:d=${fade}${subtitleFilter}`,'-t',String(m.duration),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-threads','2','-r','24','-fps_mode','cfr','-video_track_timescale','12288','-c:a','aac','-b:a','192k','-movflags','+faststart','-y',output]);
  // Decode every frame and the full original-audio mapping, not just the container header.
  await run('ffmpeg',['-v','error','-xerror','-nostdin','-i',output,'-map','0:v:0','-map','0:a:0','-f','null','-']);
  const p=await probe(output),v=p.streams.find(s=>s.codec_type==='video'),a=p.streams.find(s=>s.codec_type==='audio');
  if(!v||!a||Number(v.nb_frames)!==layout.targetFrames||v.width!==w||v.height!==h||Math.abs(Number(v.duration)-m.duration)>.125||Math.abs(Number(a.duration)-m.duration)>.125)throw Error('final_validation_failed');
  if((await stat(output)).size>512*1048576)throw Error('final_file_too_large');
  if(subtitles){await writeFile(output+'.srt',subtitleFile(subtitles,'srt'));await writeFile(output+'.vtt',subtitleFile(subtitles,'vtt'));}
  return {file:output,sha256:await sha(output),bytes:(await stat(output)).size,width:w,height:h,duration:Number(v.duration),verification:{...(selection?{selection}:{}),...(subtitles?{subtitlesBurned:true,subtitleSha256:subtitles.sha256}:{}),decoded:true,audioMapped:true,sourceAudioSha256:m.audio.sha256,sceneHashes:layout.scenes.map(s=>s.sha256)}};
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 if(process.argv.length!==4)throw Error('Usage: node session-assemble.mjs manifest.json output.mp4');
 const receipt=await assemble(JSON.parse(await readFile(process.argv[2],'utf8')),path.resolve(process.argv[3]));
 await writeFile(process.argv[3]+'.receipt.json',JSON.stringify(receipt,null,2));process.stdout.write(JSON.stringify(receipt)+'\n');
}
