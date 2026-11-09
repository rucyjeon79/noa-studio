/** Bounded media executor; N80's existing campaign owns jobs, leases and review. */
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assemble} from '../../lab/session-assemble.mjs';
import {subtitleDigest} from '../../lab/subtitles.mjs';

const ROOT='/hosting/noastudio/noa-ai-lab/host-runtime';
const sha=async file=>{const h=createHash('sha256');for await(const b of createReadStream(file))h.update(b);return h.digest('hex');};
const json=async file=>JSON.parse(await fs.readFile(file,'utf8'));
const hashPattern=/^[a-f0-9]{64}$/;

export async function verifyPackage(folder,manifestFile,expected){
 if(!hashPattern.test(expected)||await sha(manifestFile)!==expected)throw Error('media_manifest_checksum');
 const entries=await json(manifestFile),root=await fs.realpath(folder);
 if(!entries||Array.isArray(entries)||!Object.keys(entries).length||Object.keys(entries).length>350)throw Error('media_manifest_invalid');
 let bytes=0;
 for(const[name,item]of Object.entries(entries)){
  if(!/^[A-Za-z0-9_./+\-]+$/.test(name)||name.startsWith('/')||name.split('/').includes('..')||!item||!hashPattern.test(item.sha256)||!Number.isSafeInteger(item.bytes)||item.bytes<1)throw Error('media_manifest_path');
  const file=path.join(root,name),info=await fs.lstat(file);
  if(!info.isFile()||info.size!==item.bytes||!((await fs.realpath(file)).startsWith(root+'/'))||await sha(file)!==item.sha256)throw Error('media_package_checksum');
  bytes+=info.size;
 }
 return {verified:true,files:Object.keys(entries).length,bytes};
}

function fontConfig(bundle,job){
 return `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${bundle}/fonts</dir><cachedir>${job}/font-cache</cachedir></fontconfig>`;
}

async function fixture(job){
 const ff=(...args)=>execFileSync('ffmpeg',['-nostdin','-v','error','-y',...args],{timeout:30000,maxBuffer:32768});
 const audio=path.join(job,'source.wav');
 ff('-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','1.5',audio);
 const scenes=[];
 for(const[i,color]of ['red','blue'].entries()){
  const file=path.join(job,`scene-${i+1}.mp4`);
  ff('-f','lavfi','-i',`color=c=${color}:s=320x568:r=24`,'-t','1','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',file);
  scenes.push({n:i+1,path:file,sha256:await sha(file)});
 }
 const audioSha=await sha(audio),subtitles={enabled:true,status:'ready',sourceAudioSha256:audioSha,
  lyricsSha256:createHash('sha256').update('한글 자막 실행 검증').digest('hex'),
  cues:[{line:1,startMs:100,endMs:1400,text:'한글 자막 실행 검증'}]};
 subtitles.sha256=subtitleDigest(subtitles);
 return {format:'shorts',outputResolution:1080,duration:1.5,audio:{path:audio,sha256:audioSha},subtitles,scenes,
  layout:{ready:true,fps:24,overlapFrames:12,targetFrames:36,scenes:scenes.map((s,i)=>({n:s.n,startFrame:i*12,frames:24,sha256:s.sha256}))}};
}

async function worker(settingsFile){
 const settings=await json(settingsFile),job=path.dirname(settingsFile),bundle=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
 if(!/^\/hosting\/noastudio\/noa-ai-lab\/host-runtime\/media-job-[a-f0-9]{32}$/.test(job)||await fs.realpath(job)!==job)throw Error('media_job_path');
 // This worker is launched as its own process group. Its own timer survives a
 // lost SSH/parent response and terminates ffmpeg children as well as Node.
 const timer=setTimeout(()=>process.kill(-process.pid,'SIGKILL'),settings.kind==='check'?180000:600000);
 try{
  process.env.PATH=bundle+'/bin';
  process.env.TMPDIR=job;
  process.env.FONTCONFIG_FILE=job+'/fonts.conf';
  process.env.FONTCONFIG_PATH=job;
  process.env.N80_HOST_MEDIA='1';
  await fs.writeFile(process.env.FONTCONFIG_FILE,fontConfig(bundle,job),{mode:0o600});
  const m=settings.kind==='check'?await fixture(job):settings.manifest;
  if(!['check','render'].includes(settings.kind)||m.format!=='shorts'||m.outputResolution!==1080||!(m.duration>0&&m.duration<=60)||!Array.isArray(m.scenes)||m.scenes.length>64)throw Error('media_job_scope');
  if(settings.kind==='render'&&(!/^[a-f0-9]{32}$/.test(m.n80Execution?.id)||!/^[a-f0-9]{32}$/.test(m.n80Execution?.operationId)))throw Error('media_job_identity');
  for(const file of [m.audio?.path,...m.scenes.map(s=>s.path)]){
   if(typeof file!=='string'||!file.startsWith(job+'/')||await fs.realpath(file)!==file||!(await fs.lstat(file)).isFile())throw Error('media_input_path');
  }
  const output=job+'/final.mp4',receipt=await assemble(m,output);
  if(settings.kind==='check'){
   if(receipt.width!==1080||receipt.height!==1920||receipt.verification.decoded!==true||receipt.verification.subtitlesBurned!==true)throw Error('media_check_incomplete');
   // Validate the actual crossfade, not only container duration.
   const pixel=execFileSync('ffmpeg',['-v','error','-ss','0.75','-i',output,'-frames:v','1','-vf','scale=1:1','-pix_fmt','rgb24','-f','rawvideo','-'],{timeout:30000});
   if(!(pixel[0]>60&&pixel[0]<200&&pixel[2]>60&&pixel[2]<200))throw Error('media_crossfade_check_failed');
   const caption=execFileSync('ffmpeg',['-v','error','-ss','0.75','-i',output,'-frames:v','1','-vf','crop=1080:300:0:1500','-pix_fmt','gray','-f','rawvideo','-'],{timeout:30000,maxBuffer:400000});
   if(caption.filter(value=>value>220).length<1000)throw Error('media_subtitle_pixels_missing');
  }
  if(settings.kind==='render')receipt.n80Execution=m.n80Execution;
  await fs.writeFile(job+'/result.json',JSON.stringify(receipt),{mode:0o600});
  return {ok:true,state:settings.kind==='check'?'host_media_verified':'host_media_rendered',kind:settings.kind,
   width:receipt.width,height:receipt.height,duration:receipt.duration,sha256:receipt.sha256,bytes:receipt.bytes,
   decoded:receipt.verification.decoded,subtitlesBurned:receipt.verification.subtitlesBurned===true,
   productionMovie:settings.kind==='render'};
 }finally{clearTimeout(timer);}
}

async function parent(settingsFile){
 const n=await json(ROOT+'/node-current.json');
 if(n.authority!=='N80 Engine'||!hashPattern.test(n.nodeSha256)||typeof n.privateLibraries!=='boolean')throw Error('node_runtime_required');
 const binary=ROOT+'/node-'+n.nodeSha256.slice(0,16),libs=ROOT+'/lib-'+n.nodeSha256.slice(0,16);
 const args=n.privateLibraries?[libs+'/ld-linux-x86-64.so.2','--library-path',libs,binary]:[binary];
 args.push('--max-old-space-size=128',fileURLToPath(import.meta.url),'worker',settingsFile);
 return await new Promise((resolve,reject)=>{
  const child=spawn(args[0],args.slice(1),{detached:true,stdio:['ignore','pipe','pipe'],env:{LANG:'C.UTF-8'}});
  let out='',err='',timedOut=false,limited=false;
  const stop=()=>{if(child.pid)try{process.kill(-child.pid,'SIGKILL')}catch{}};
  const timer=setTimeout(()=>{timedOut=true;stop()},620000);
  child.stdout.on('data',b=>{out+=b;if(out.length>32768){limited=true;stop()}});
  child.stderr.on('data',b=>{err=(err+b).slice(-4000)});
  child.on('error',()=>{clearTimeout(timer);stop();reject(Error('media_spawn_failed'))});
  child.on('close',(code,signal)=>{clearTimeout(timer);stop();
   try{const v=JSON.parse(out);if(code===0&&v.ok===true)return resolve(v);}catch{}
   resolve({ok:false,state:timedOut?'media_process_timeout':limited?'media_output_limit':'media_process_failed',exitCode:code,signal,
    diagnostic:(out+' '+err).replace(/\/[^\s"']+/g,'<path>').slice(-1500)});
  });
 });
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [mode,...args]=process.argv.slice(2);
  const result=mode==='verify'?await verifyPackage(...args):mode==='run'?await parent(args[0]):mode==='worker'?await worker(args[0]):null;
  if(!result)throw Error('media_operation_unknown');
  console.log(JSON.stringify(result));if(result.ok===false)process.exitCode=1;
 }catch(error){console.log(JSON.stringify({ok:false,state:'media_execution_failed',diagnostic:String(error.message).replace(/\/[^\s"']+/g,'<path>').slice(-1500)}));process.exitCode=1;}
}
