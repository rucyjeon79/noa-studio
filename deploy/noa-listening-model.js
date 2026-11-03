/* Shared deterministic selection. Genre is a boundary, never a ranking hint. */
(function(root){'use strict';
function catalog(records,genre){const seen=new Set();return records.filter(r=>{if(r.genre!==genre||!r.audio||r.kind==='playlist'||r.video)return false;const id=r.browseIdentity||r.canonicalRecordKey||r.orderKey||r.key;if(seen.has(id))return false;seen.add(id);return true;});}
function select(records,{genre,mood='auto',mode='now',theme={},popular={},library=[]}){
 const rows=catalog(records,genre),chosen=mood==='auto'?theme.mood:mood;let result=[...rows],fallback=false;
 if(mode==='popular'){const score=r=>[...new Set([r.key,...(r.browseKeys||[])])].reduce((n,key)=>n+Number(popular[key]||0),0);result=result.filter(r=>score(r)>0).sort((a,b)=>score(b)-score(a)||a.key.localeCompare(b.key));}
 else if(mode==='latest')result=result.filter(r=>Number(r.registeredAt)>0).sort((a,b)=>b.registeredAt-a.registeredAt||a.key.localeCompare(b.key));
 else if(mode==='library'){const keys=new Set(library.flatMap(p=>p.tracks||[]));result=result.filter(r=>keys.has(r.key)||(r.browseKeys||[]).some(k=>keys.has(k)));}
 else if(mode==='now'){
  const matching=result.filter(r=>(r.moodTags||[]).includes(chosen));
  if(matching.length)result=matching;else if(mood==='auto')fallback=true;else result=[];
  // Stable daily rotation only within the matching genre/mood. No random cross-genre filler.
  const seed=String(theme.localDate||'')+String(theme.period||'');const hash=s=>{let h=0;for(const c of seed+s)h=(Math.imul(31,h)+c.charCodeAt(0))>>>0;return h;};result.sort((a,b)=>hash(a.key)-hash(b.key));
 }
 return {rows:result.slice(0,40),fallback,mood:chosen};
}
function albums(records,genre,{mood='auto',theme={}}={}){const groups=new Map();for(const r of catalog(records,genre)){const ep=Number(r.ep),act=Number(r.act)||(ep>0?Math.ceil(ep/10):0);if(!act)continue;if(!groups.has(act))groups.set(act,[]);groups.get(act).push(r);}const chosen=mood==='auto'?theme.mood:mood;return [...groups].map(([act,rows])=>({act,matches:rows.filter(r=>(r.moodTags||[]).includes(chosen)).length,rows:rows.sort((a,b)=>Number(a.ep)-Number(b.ep)||a.key.localeCompare(b.key))})).sort((a,b)=>b.matches/ b.rows.length-a.matches/a.rows.length||a.act-b.act);}
const api={catalog,select,albums};if(typeof module==='object')module.exports=api;else root.NoaListeningModel=api;
})(typeof window==='undefined'?globalThis:window);
