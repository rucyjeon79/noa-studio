import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {assemble} from '../../lab/session-assemble.mjs';
import {subtitleDigest,subtitleAss,subtitleFile,wrapSubtitle} from '../../lab/subtitles.mjs';
const dir=path.resolve(process.argv[2]||'/tmp/n80-session-fixture');
const base=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
const lyrics='[Verse]\n별빛이 내려와\n다시 웃어 봐';
const subtitles={enabled:true,status:'ready',sourceAudioSha256:base.audio.sha256,lyricsSha256:createHash('sha256').update(lyrics).digest('hex'),cues:[
 {line:1,startMs:500,endMs:1700,text:'별빛이 내려와',match:1,probability:.95,maxWordGapMs:0},
 {line:2,startMs:2800,endMs:4200,text:'다시 웃어 봐',match:1,probability:.95,maxWordGapMs:0}
]};subtitles.sha256=subtitleDigest(subtitles);
assert(subtitleFile(subtitles,'srt').includes('00:00:00,500 --> 00:00:01,700'));
assert(subtitleFile(subtitles,'vtt').startsWith('WEBVTT\n\n'));
assert.equal(wrapSubtitle('이렇게 길고 긴 한글 가사도 세로 화면 안에서 두 줄로 자연스럽게 보여요','shorts').length,2);
assert(!subtitleAss({...subtitles,cues:[{...subtitles.cues[0],text:'가사{\\pos(0,0)}'}]},'landscape').includes('{\\pos'));
await assert.rejects(()=>assemble({...base,subtitles:{...subtitles,sha256:'0'.repeat(64)}},path.join(dir,'invalid-subtitle.mp4')),/subtitle_checksum/);
await assert.rejects(()=>assemble({...base,subtitles:{...subtitles,status:'needs_review'}},path.join(dir,'unchecked.mp4')),/subtitles_not_ready/);
const pixel=(file,time)=>execFileSync('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-frames:v','1','-vf','crop=iw:ih/3:0:2*ih/3','-pix_fmt','rgb24','-f','rawvideo','-'],{maxBuffer:4*1024*1024});
const whiteCount=b=>{let n=0;for(let i=0;i<b.length;i+=3)if(b[i]>190&&b[i+1]>190&&b[i+2]>190)n++;return n;};
for(const format of ['landscape','shorts']){
 const output=path.join(dir,'subtitle-'+format+'.mp4'),r=await assemble({...base,format,subtitles},output);
 assert.equal(r.verification.subtitleSha256,subtitles.sha256);assert.equal(r.verification.subtitlesBurned,true);assert.equal(r.duration,5);
 assert(whiteCount(pixel(output,1))>100,'Korean text pixels must be visible during the vocal cue');
 assert.equal(whiteCount(pixel(output,2.2)),0,'Instrumental gap must have no caption pixels');
 assert.equal(await readFile(output+'.srt','utf8'),subtitleFile(subtitles,'srt'));
 execFileSync('ffmpeg',['-v','error','-y','-ss','1','-i',output,'-frames:v','1','-threads','1',path.join(dir,'subtitle-'+format+'.png')]);
 await writeFile(path.join(dir,'subtitle-'+format+'.receipt.json'),JSON.stringify(r));
}
await writeFile(path.join(dir,'subtitle-payload.json'),JSON.stringify({sourceAudioSha256:base.audio.sha256,lyricsSha256:subtitles.lyricsSha256,method:'timestamped-asr',model:'isolated-test',cues:subtitles.cues}));
console.log('Subtitles: Korean pixels, vocal-only visibility, two formats, source/digest fencing, SRT/VTT and injection protection passed.');
