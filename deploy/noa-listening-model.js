/* Shared deterministic selection. Genre is a boundary, never a ranking hint. */
(function(root){'use strict';
function normalizeBirthDate(value){
 if(typeof value!=='string')return '';
 const text=value.normalize('NFKC').trim(),parts=text.match(/^(\d{4})(\d{2})(\d{2})$/)||text.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})(?:\s*일|\.)?$/);
 if(!parts||Number(parts[1])<1900||Number(parts[1])>2099||Number(parts[2])<1||Number(parts[2])>12||Number(parts[3])<1||Number(parts[3])>31)return '';
 // Keep lunar dates intact; the server validates them against the selected calendar.
 return parts[1]+'-'+parts[2].padStart(2,'0')+'-'+parts[3].padStart(2,'0');
}
const moodKeys=['calm','focus','energy','comfort'];
function catalog(records,genre,acrossGenres=false){
 const recordings=new Map(),playable=[];
 for(const row of records){
  if((!acrossGenres&&row.genre!==genre)||row.kind==='playlist'||row.video)continue;
  const id=row.browseIdentity||row.canonicalRecordKey||row.orderKey||row.key;
  let recording=recordings.get(id);
  if(!recording){recording={scores:{},affinity:{},track:null};recordings.set(id,recording);}
  // The matching lyrics and playable file can live on different aliases of the same recording.
  for(const mood of moodKeys){
   const score=moodScore(row,mood);
   if(score>(recording.scores[mood]||0))recording.scores[mood]=score;
   const affinity=row.moodAffinity?.[mood];
   if(Number.isFinite(affinity)&&affinity>(recording.affinity[mood]||0))recording.affinity[mood]=affinity;
  }
  if(!recording.track&&row.audio){
   recording.track={...row,moodScores:recording.scores,moodAffinity:recording.affinity};
   playable.push(recording.track);
  }
 }
 return playable;
}
function moodScore(track,mood){
 const score=track.moodScores?.[mood];
 return Number.isFinite(score)?score:(track.moodTags||[]).includes(mood)?1:0;
}
function trackFit(row,mood,personal){
 const direct=moodScore(row,mood);
 const similarity=personal?Math.min(1,row.moodAffinity?.[mood]||0):0;
 return direct+similarity;
}
function availableMood(rows,mood,theme){
 if(mood!=='auto')return mood;
 if(!theme.personal||!Array.isArray(theme.rankedMoods))return theme.mood;
 return theme.rankedMoods.find(candidate=>rows.some(row=>trackFit(row,candidate,true)>0))||theme.mood;
}
function select(records,{genre,mood='auto',mode='now',theme={},popular={},library=[]}){
 const rows=catalog(records,genre),chosen=availableMood(rows,mood,theme);let result=[...rows],fallback=false;
 if(mode==='popular'){const score=r=>[...new Set([r.key,...(r.browseKeys||[])])].reduce((n,key)=>n+Number(popular[key]||0),0);result=result.filter(r=>score(r)>0).sort((a,b)=>score(b)-score(a)||a.key.localeCompare(b.key));}
 else if(mode==='latest')result=result.filter(r=>Number(r.registeredAt)>0).sort((a,b)=>b.registeredAt-a.registeredAt||a.key.localeCompare(b.key));
 else if(mode==='library'){const keys=new Set(library.flatMap(p=>p.tracks||[]));result=result.filter(r=>keys.has(r.key)||(r.browseKeys||[]).some(k=>keys.has(k)));}
 else if(mode==='now'){
  const fit=row=>trackFit(row,chosen,mood==='auto'&&theme.personal);
  const matching=result.filter(r=>fit(r)>0);
  if(matching.length)result=matching;else fallback=result.length>0;
  // Stable daily rotation only within the matching genre/mood. No random cross-genre filler.
  const seed=String(theme.localDate||'')+String(theme.period||'');const hash=s=>{let h=0;for(const c of seed+s)h=(Math.imul(31,h)+c.charCodeAt(0))>>>0;return h;};result.sort((a,b)=>fit(b)-fit(a)||hash(a.key)-hash(b.key));
 }
 return {rows:result.slice(0,40),fallback,mood:chosen};
}
function albums(records,genre,{mood='auto',theme={}}={}){const groups=new Map();for(const r of catalog(records,genre)){const ep=Number(r.ep),act=Number(r.act)||(ep>0?Math.ceil(ep/10):0);if(!act)continue;if(!groups.has(act))groups.set(act,[]);groups.get(act).push(r);}const chosen=availableMood([...groups.values()].flat(),mood,theme);return [...groups].map(([act,rows])=>({act,matches:rows.reduce((total,r)=>total+trackFit(r,chosen,mood==='auto'&&theme.personal),0),rows:rows.sort((a,b)=>Number(a.ep)-Number(b.ep)||a.key.localeCompare(b.key))})).sort((a,b)=>b.matches/ b.rows.length-a.matches/a.rows.length||a.act-b.act);}
const wholeMixLimit=100,genreMixLimit=10;
function sajuMix(candidates,theme,limit){
 if(!theme?.personal||!theme.rankedMoods?.length)return {rows:[],fallback:false,matched:0};
 const [first,second]=theme.rankedMoods;
 const score=row=>{
  const main=trackFit(row,first,true),next=trackFit(row,second,true)*0.7;
  return Math.max(main,next)+0.15*Math.min(main,next);
 };
 // Equal matches rotate without giving a particular genre's key prefix priority.
 const dailyOrder=key=>{
  let hash=2166136261;
  for(const char of (theme.localDate||'')+(theme.period||'')+key)hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return hash>>>0;
 };
 const scored=candidates.map(row=>({row,score:score(row),order:dailyOrder(row.key)}));
 // For songs with sparse text, use the genre's observed fit as a tie breaker.
 const genreTotals=new Map();
 for(const item of scored){
  const sum=genreTotals.get(item.row.genre)||{value:0,count:0};
  sum.value+=item.score;sum.count++;genreTotals.set(item.row.genre,sum);
 }
 const genreAverage=item=>{const sum=genreTotals.get(item.row.genre);return sum.value/sum.count;};
 scored.sort((a,b)=>b.score-a.score||genreAverage(b)-genreAverage(a)||a.order-b.order||a.row.key.localeCompare(b.row.key));
 const batch=scored.slice(0,limit),matched=batch.filter(item=>item.score>0).length;
 const top=batch[0]?.row;
 const mood=top&&trackFit(top,second,true)*0.7>trackFit(top,first,true)?second:first;
 return {rows:batch.map(item=>item.row),fallback:!!batch.length&&!matched,matched,mood};
}
function wholeCatalogMix(records,theme){
 const mix=sajuMix(catalog(records,null,true),theme,wholeMixLimit);
 return {...mix,mood:theme?.mood};
}
function recommendedGenreMix(records,genre,theme){
 return sajuMix(catalog(records,genre),theme,genreMixLimit);
}
function genreSuggestions(records,theme,genres,preferred){
 if(!theme?.personal||!theme.rankedMoods?.length)return [];
 const choices=[];
 for(const genre of Object.keys(genres)){
  const selection=recommendedGenreMix(records,genre,theme);
  if(!selection.rows.length)continue;
  const best=selection.rows.slice(0,3).map(row=>trackFit(row,selection.mood,true));
  const priority=theme.mood===selection.mood?1:0.7;
  const strength=best.reduce((total,score)=>total+score,0)/best.length;
  choices.push({genre,selection,score:priority*(best[0]+strength)/2});
 }
 choices.sort((a,b)=>b.score-a.score||Number(b.genre===preferred)-Number(a.genre===preferred)||a.genre.localeCompare(b.genre));
 return choices.slice(0,3);
}
const api={catalog,select,albums,wholeCatalogMix,recommendedGenreMix,wholeMixLimit,genreMixLimit,genreSuggestions,normalizeBirthDate};if(typeof module==='object')module.exports=api;else root.NoaListeningModel=api;
})(typeof window==='undefined'?globalThis:window);
