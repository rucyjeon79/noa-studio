/* Shared deterministic selection. Genre is a boundary, never a ranking hint. */
(function(root){'use strict';
function normalizeBirthDate(value){
 if(typeof value!=='string')return '';
 const text=value.normalize('NFKC').trim(),parts=text.match(/^(\d{4})(\d{2})(\d{2})$/)||text.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})(?:\s*일|\.)?$/);
 if(!parts||Number(parts[1])<1900||Number(parts[1])>2099||Number(parts[2])<1||Number(parts[2])>12||Number(parts[3])<1||Number(parts[3])>31)return '';
 // Keep lunar dates intact; the server validates them against the selected calendar.
 return parts[1]+'-'+parts[2].padStart(2,'0')+'-'+parts[3].padStart(2,'0');
}
const moodKeys=['calm','focus','energy','comfort','cruise','drive','walk','sleep'];
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
  if(!recording.track&&(row.audio||/^[A-Za-z0-9_-]{11}$/.test(row.publicVideoId||''))){
   recording.track={...row,moodScores:recording.scores,moodAffinity:recording.affinity};
   playable.push(recording.track);
  }
 }
 const seenAudio=new Set();
 return playable.filter(row=>{
  if(!row.audioSha)return true;
  if(seenAudio.has(row.audioSha))return false;
  seenAudio.add(row.audioSha);return true;
 });
}
function moodScore(track,mood){
 const score=track.moodScores?.[mood];
 return Number.isFinite(score)?score:(track.moodTags||[]).includes(mood)?1:0;
}
function trackFit(row,mood,personal){
 const direct=moodScore(row,mood);
 const similarity=personal?Math.min(1,row.moodAffinity?.[mood]||0):0;
 // Scene cues rank first. With sparse metadata, blend existing musical moods.
 const calm=moodScore(row,'calm'),energy=moodScore(row,'energy');
 let blend=0;
 if(mood==='cruise')blend=.30*calm+.12*moodScore(row,'comfort')-.20*energy;
 if(mood==='drive')blend=.32*energy+.08*moodScore(row,'focus')-.20*calm;
 if(mood==='sleep')blend=.34*calm+.08*moodScore(row,'comfort')-.45*energy;
 if(mood==='walk')blend=.21*calm+.14*energy;
 return direct+similarity+Math.max(-.9,Math.min(.9,blend));
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
 return rankMix(candidates,theme,limit,first,second);
}
function rankMix(candidates,theme,limit,first,second){
 const score=row=>{
  const main=trackFit(row,first,true);
  if(!second)return main;
  const next=trackFit(row,second,true)*0.7;
  return Math.max(main,next)+0.15*Math.min(main,next);
 };
 // Equal matches rotate without giving a particular genre's key prefix priority.
 const dailyOrder=key=>{
  let hash=2166136261;
  for(const char of (theme.localDate||'')+(theme.period||'')+(second?'':first)+key)hash=Math.imul(hash^char.charCodeAt(0),16777619);
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
 const mood=second&&top&&trackFit(top,second,true)*0.7>trackFit(top,first,true)?second:first;
 return {rows:batch.map(item=>item.row),fallback:!!batch.length&&!matched,matched,mood};
}
function wholeMoodMix(records,mood,theme={}){
 if(!moodKeys.includes(mood))return {rows:[],fallback:false,matched:0};
 return rankMix(catalog(records,null,true),theme,wholeMixLimit,mood);
}
function recordingId(row){return row.audioSha||row.browseIdentity||row.canonicalRecordKey||row.orderKey||row.key;}
// A recording belongs to one primary mood. Only these two neighbors may fill its queue.
const moodNeighbors={
 calm:['comfort','sleep'], focus:['calm','cruise'], comfort:['calm','walk'], energy:['drive','walk'],
 cruise:['calm','walk'], drive:['energy','cruise'], walk:['cruise','energy'], sleep:['calm','comfort']
};
function moodCollections(records,theme={},orderFor){
 const groups=new Set(),identities=new Map();
 for(const row of records){
  if(row.kind==='playlist'||row.video)continue;
  const canonical=row.browseIdentity||row.canonicalRecordKey||row.orderKey||row.key;
  const ids=['key:'+canonical];
  if(row.audioSha)ids.push('sha:'+row.audioSha);
  const videoId=/^[A-Za-z0-9_-]{11}$/.test(row.publicVideoId||'')?row.publicVideoId:'';
  if(videoId)ids.push('video:'+videoId);
  if(row.audio)ids.push('audio:'+row.audio);
  const known=[...new Set(ids.map(id=>identities.get(id)).filter(Boolean))];
  const group=known[0]||{ids:new Set(),rows:[]};
  groups.add(group);
  for(const other of known.slice(1)){
   for(const id of other.ids){group.ids.add(id);identities.set(id,group);}
   group.rows.push(...other.rows);groups.delete(other);
  }
  for(const id of ids){group.ids.add(id);identities.set(id,group);}
  group.rows.push(row);
 }
 const collections=Object.fromEntries(moodKeys.map(m=>[m,[]]));
 const scenes=new Set(['cruise','drive','walk','sleep']);
 const rotation=(theme.localDate||'')+(theme.period||'');
 function hash(text){let h=2166136261;for(const c of text)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
 for(const group of groups){
  const playable=group.rows.filter(r=>r.audio||/^[A-Za-z0-9_-]{11}$/.test(r.publicVideoId||''));
  if(!playable.length)continue;
  const key=group.rows.map(r=>r.canonicalRecordKey||r.orderKey||r.key).sort()[0];
  const fits=moodKeys.map(mood=>{
   const direct=Math.max(0,...group.rows.map(r=>moodScore(r,mood)));
   const affinity=Math.max(0,...group.rows.map(r=>Math.min(1,r.moodAffinity?.[mood]||0)));
   return {mood,direct,affinity,tie:hash(mood+'|'+key)};
  }).sort((a,b)=>b.direct-a.direct||b.affinity-a.affinity||Number(scenes.has(b.mood))-Number(scenes.has(a.mood))||a.tie-b.tie);
  const [best,next]=fits;
  // In the absence of explicit cues require a strong, distinctive learned match.
  if(!best.direct&&(best.affinity<.60||best.affinity-next.affinity<.12))continue;
  const scores=Object.fromEntries(fits.map(fit=>[fit.mood,fit.direct+fit.affinity*.75]));
  collections[best.mood].push({playable,scores,key});
 }
 return function selection(mood,genre){
  const rows=[],tiers=[];
  if(!Object.hasOwn(moodNeighbors,mood))return {rows,tiers};
  for(const source of [mood,...moodNeighbors[mood]]){
   const items=[];
   for(const item of collections[source]){
    const row=genre?item.playable.find(r=>r.genre===genre):item.playable[0];
    if(row)items.push({row,fit:item.scores[mood],sourceFit:item.scores[source],order:hash(rotation+'|'+mood+'|'+item.key)});
   }
   // Keep the chosen mood first. Among borrowed tracks, favor evidence for the listener's actual choice.
   items.sort((a,b)=>b.fit-a.fit||b.sourceFit-a.sourceFit||(genre&&orderFor?orderFor(a.row,b.row):0)||a.order-b.order||a.row.key.localeCompare(b.row.key));
   const batch=items.slice(0,wholeMixLimit-rows.length);
   tiers.push({mood:source,count:batch.length});
   rows.push(...batch.map(item=>item.row));
   if(rows.length===wholeMixLimit)break;
  }
  return {rows,tiers};
 };
}
function manualGenre(records,genre,orderFor,mood){
 const rows=catalog(records,genre);
 if(orderFor)rows.sort(orderFor);
 if(moodKeys.includes(mood)){
  const matches=rows.filter(row=>trackFit(row,mood,false)>0);
  return {rows:matches.length?matches:rows,fallback:!matches.length&&rows.length>0};
 }
 return {rows,fallback:false};
}
// Shuffle a fresh queue once; the player can then step forward, back, or resume in this order.
function shuffledPlayback(rows,firstKey,previous='',last=''){
 if(rows.length<2)return rows.slice();
 let first=firstKey&&rows.find(row=>row.key===firstKey);
 if(!first){
  const eligible=rows.filter(row=>recordingId(row)!==previous&&recordingId(row)!==last);
  const choices=eligible.length?eligible:rows.filter(row=>recordingId(row)!==previous);
  const pool=choices.length?choices:rows;
  first=pool[Math.floor(Math.random()*pool.length)];
 }
 const rest=rows.filter(row=>row!==first);
 for(let i=rest.length-1;i>0;i--){
  const j=Math.floor(Math.random()*(i+1));
  [rest[i],rest[j]]=[rest[j],rest[i]];
 }
 return [first,...rest];
}
function chooseOpener(rows,avoid){
 if(!rows.length||!avoid.has(recordingId(rows[0])))return;
 const index=rows.findIndex(row=>!avoid.has(recordingId(row)));
 if(index>0)rows.unshift(rows.splice(index,1)[0]);
}
function wholeCatalogMix(records,theme,reserved=new Set()){
 const mix=sajuMix(catalog(records,null,true),theme,wholeMixLimit);
 // Keep the strongest 100 picks and play matched songs before catalog fillers.
 // Within each group, alternate genres while another genre is available.
 const rows=[];
 for(const batch of [mix.rows.slice(0,mix.matched),mix.rows.slice(mix.matched)]){
  if(!rows.length)chooseOpener(batch,reserved);
  while(batch.length){
   const next=rows.length?batch.findIndex(row=>row.genre!==rows[rows.length-1].genre):0;
   rows.push(batch.splice(Math.max(0,next),1)[0]);
  }
 }
 chooseOpener(rows,reserved);
 return {...mix,rows,mood:theme?.mood};
}
function recommendedGenreMix(records,genre,theme,orderFor){
 const manual=manualGenre(records,genre,orderFor).rows;
 const mix=sajuMix(manual,theme,genreMixLimit);
 const opening=mix.rows.slice(0,mix.matched||mix.rows.length);
 if(manual.length)chooseOpener(opening,new Set([recordingId(manual[0])]));
 const rows=[...opening,...mix.rows.slice(opening.length)];
 if(manual.length)chooseOpener(rows,new Set([recordingId(manual[0])]));
 return {...mix,rows};
}
function genreSuggestions(records,theme,genres,preferred,orderFor){
 if(!theme?.personal||!theme.rankedMoods?.length)return [];
 const choices=[];
 for(const genre of Object.keys(genres)){
  const selection=recommendedGenreMix(records,genre,theme,orderFor);
  if(!selection.rows.length)continue;
  const best=selection.rows.slice(0,3).map(row=>trackFit(row,selection.mood,true));
  const priority=theme.mood===selection.mood?1:0.7;
  const strength=best.reduce((total,score)=>total+score,0)/best.length;
  choices.push({genre,selection,score:priority*(Math.max(...best)+strength)/2});
 }
 choices.sort((a,b)=>b.score-a.score||Number(b.genre===preferred)-Number(a.genre===preferred)||a.genre.localeCompare(b.genre));
 return choices.slice(0,3);
}
const api={catalog,shuffledPlayback,moodCollections,manualGenre,recordingId,select,albums,wholeMoodMix,wholeCatalogMix,recommendedGenreMix,wholeMixLimit,genreMixLimit,genreSuggestions,normalizeBirthDate};if(typeof module==='object')module.exports=api;else root.NoaListeningModel=api;
})(typeof window==='undefined'?globalThis:window);
