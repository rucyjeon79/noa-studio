import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';

const sha=value=>createHash('sha256').update(value).digest('hex');
export function subtitleDigest(subtitles){
 return sha(subtitles.sourceAudioSha256+'\n'+subtitles.lyricsSha256+'\n'+subtitles.cues.map(c=>`${c.line}:${c.startMs}:${c.endMs}:${c.text}\n`).join(''));
}
export function validateSubtitles(subtitles,audioSha,duration){
 if(!subtitles?.enabled)return null;
 if(subtitles.status!=='ready'||subtitles.sourceAudioSha256!==audioSha||!Array.isArray(subtitles.cues)||!subtitles.cues.length||subtitles.cues.length>500||!/^[a-f0-9]{64}$/.test(subtitles.lyricsSha256))throw Error('subtitles_not_ready');
 let last=0;
 for(const [i,c]of subtitles.cues.entries()){
  if(c.line!==i+1||!Number.isInteger(c.startMs)||!Number.isInteger(c.endMs)||c.startMs<last||c.endMs<=c.startMs||c.endMs>Math.round(duration*1000)||typeof c.text!=='string'||!c.text.trim()||[...c.text].length>240||/[\x00-\x1f]/.test(c.text))throw Error('invalid_subtitle_cues');
  last=c.endMs;
 }
 if(subtitleDigest(subtitles)!==subtitles.sha256)throw Error('subtitle_checksum_mismatch');
 return subtitles;
}
const units=text=>[...text].reduce((n,c)=>n+(/[\u1100-\u11ff\u2e80-\ua4cf\uac00-\ud7af\uf900-\ufaff]/u.test(c)?2:1),0);
export function wrapSubtitle(text,format){
 const maximum=format==='shorts'?32:54,chars=[...text];
 if(units(text)<=maximum)return [text];
 const target=units(text)/2;let width=0,best=0,distance=Infinity;
 for(let i=0;i<chars.length-1;i++){width+=units(chars[i]);const cost=Math.abs(width-target)+(chars[i]===' '?0:3);if(cost<distance){distance=cost;best=i+1;}}
 return [chars.slice(0,best).join('').trim(),chars.slice(best).join('').trim()];
}
export function subtitleAss(subtitles,format){
 const [w,h,size,margin]=format==='shorts'?[720,1280,40,150]:[1280,720,42,60];
 // Require a real Korean font: an installed Latin fallback must never produce tofu.
 const font=execFileSync('fc-match',['-f','%{family}','Noto Sans CJK KR:lang=ko'],{encoding:'utf8'});
 if(!font.includes('Noto Sans CJK KR'))throw Error('korean_subtitle_font_required');
 const stamp=ms=>{const cs=Math.round(ms/10);return `${Math.floor(cs/360000)}:${String(Math.floor(cs/6000)%60).padStart(2,'0')}:${String(Math.floor(cs/100)%60).padStart(2,'0')}.${String(cs%100).padStart(2,'0')}`;};
 const header=`[Script Info]\nScriptType: v4.00+\nPlayResX: ${w}\nPlayResY: ${h}\nWrapStyle: 2\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Noto Sans CJK KR,${size},&H00FFFFFF,&H00FFFFFF,&H00101010,&H60000000,0,0,0,0,100,100,0,0,1,2.5,1,2,48,48,${margin},1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
 return header+subtitles.cues.map(c=>{
  const lines=wrapSubtitle(c.text,format),max=Math.max(...lines.map(units)),fontSize=Math.min(size,Math.floor((w-120)*2/Math.max(1,max)));
  if(fontSize<24)throw Error('subtitle_line_too_long');
  const safe=lines.map(line=>line.replaceAll('\\','＼').replaceAll('{','｛').replaceAll('}','｝')).join('\\N');
  return `Dialogue: 0,${stamp(c.startMs)},${stamp(c.endMs)},Default,,0,0,0,,{\\fs${fontSize}}${safe}\n`;
 }).join('');
}
export function subtitleFile(subtitles,format){
 const stamp=ms=>`${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}${format==='vtt'?'.':','}${String(ms%1000).padStart(3,'0')}`;
 return (format==='vtt'?'WEBVTT\n\n':'')+subtitles.cues.map((c,i)=>`${i+1}\n${stamp(c.startMs)} --> ${stamp(c.endMs)}\n${c.text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')}\n\n`).join('');
}
