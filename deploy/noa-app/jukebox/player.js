/* N80 JukeBox owns the single audio element, queue, intent and checkpoint. */
(()=>{
"use strict";if(window.N80JukeBox)return;
const config=document.getElementById("n80-jukebox-data");
if(!config||!document.getElementById("sound-player"))return;
const data=JSON.parse(config.textContent);
if(!Array.isArray(data.records)||!Array.isArray(data.collections))return;
const records=data.records;
const collections=data.collections;
const buttons=[...document.querySelectorAll('.song')],search={value:''},genre={value:''},type={value:''};
let browse=null,filteredQueue=[];const lookup=new Map(records.map(r=>[r.key,r]));let selected=null,player=document.getElementById('sound-player'),ready=true,repeat=false,shuffle=false,pendingAutoplay=false,activeQueue=null,collectionQueue=null,recommendationQueue=null;
const status=document.getElementById('player-status');
const buttonsByKey=new Map(buttons.map(b=>[b.dataset.key,b]));let lastPlaybackSave=0;
let resumePosition=null;
// Tab-local checkpoint: resolve keys against the current authenticated catalog, never stored media URLs.
const resumeKey='noa-playback-session-v1';let changingTrack=false,leavingPage=false,resumeAfterMetadata=false;
function readPlayback(){try{const s=JSON.parse(sessionStorage.getItem(resumeKey)||'null');return s&&typeof s.key==='string'&&Number.isFinite(s.seconds)&&s.seconds>=0&&Number.isFinite(s.at)&&Date.now()-s.at>=0&&Date.now()-s.at<86400000?s:null;}catch{return null;}}
const playbackCheckpoint=readPlayback();
// Attach the source to the exact queue instance; browsing or a personal playlist can replace it.
let listeningSource=null,listeningTracks=null;
function listeningSelection(){
 const owner=recommendationQueue||collectionQueue;
 return !activeQueue&&owner&&owner===listeningTracks?listeningSource:null;
}
const weatherVip=data.weatherVip===true;
const musicMoodLabels={calm:'휴식',focus:'집중',comfort:'위로',energy:'활동',cruise:'편안한 운전',drive:'다이나믹 드라이빙',walk:'산책',sleep:'수면'};
function setListeningSource(scope,genre='',options={}){
 const types={weather:'내 마음 날씨',all:'오늘의 공감 추천',recommendedGenre:'추천 장르',genre:'직접 선택',catalogMood:'전체 장르 · '+(musicMoodLabels[options.mood]||'분위기 추천')};
 const owner=recommendationQueue||collectionQueue;
 if(!Object.hasOwn(types,scope)||!owner||(scope==='weather'&&!weatherVip))return;
 const label=[types[scope],owner.length+'곡',window.NoaBrowse?.names?.[genre]||genre].filter(Boolean).join(' · ');
 listeningSource={scope,genre,mode:options.mode||'now',mood:options.mood||'auto',label};
 listeningTracks=owner;
}
function renderQueueSource(){
 const source=listeningSelection();document.getElementById('dock-weather-feedback').hidden=source?.scope!=='weather';
 for(const id of ['dock-listening-source','dock-queue-source']){
  const tag=document.getElementById(id);tag.hidden=!source||id==='dock-listening-source';tag.textContent=source?.label||'';
 }
}
function savePlayback(){if(changingTrack||leavingPage||!selected?.dataset.audio)return;try{sessionStorage.setItem(resumeKey,JSON.stringify({key:selected.dataset.key,seconds:Number.isFinite(player.currentTime)?player.currentTime:0,playing:!player.paused&&!player.ended,closed:document.querySelector('.noa-transport').hidden,volume:player.volume,repeat,shuffle,recommendation:!!recommendationQueue&&!activeQueue&&!collectionQueue,collectionLoop:!!collectionQueue&&!activeQueue,listening:listeningSelection(),queue:queue().map(b=>b.dataset.key),path:window.NoaPlayerShell?.path()||(location.pathname+location.search+location.hash),at:Date.now()}));}catch{}}
window.addEventListener('noa-player-route',savePlayback);
window.addEventListener('pagehide',()=>{savePlayback();leavingPage=true;});
window.addEventListener('pageshow',()=>{leavingPage=false;});
for(const event of ['playing','pause','seeked','volumechange','ended'])player.addEventListener(event,savePlayback);
window.addEventListener('visibilitychange',savePlayback);

function requestPlayback(){
 if(!selected?.dataset.audio){status.textContent='음원 업로드 대기 중입니다. 업로드한 음원이 연결되면 재생할 수 있습니다.';return;}
 document.querySelector('.noa-transport').hidden=false;pendingAutoplay=true;status.textContent='저장된 음원을 준비하는 중입니다.';
 resumeAfterMetadata=false;const key=selected.dataset.key;if(player.error)player.load();player.preload='auto';const request=player.play();if(request?.catch)request.catch(error=>{if(selected?.dataset.key!==key||error?.name==='AbortError')return;if(error?.name==='NotAllowedError')pendingAutoplay=false;else player.dispatchEvent(new Event('stalled'));status.textContent=error?.name==='NotAllowedError'?'듣던 위치를 복원했어요. 재생 버튼을 누르면 이어집니다.':'음원을 재생하지 못했습니다. 재생 버튼과 파일 연결 상태를 확인해 주세요.';});
}

window.addEventListener('noa-collection-queue',event=>{const keys=event.detail?.keys;if(!Array.isArray(keys)||!keys.includes(event.detail?.key))return;recommendationQueue=null;collectionQueue=[...new Set(keys)].filter(key=>lookup.has(key)&&lookup.get(key).kind!=='playlist');activeQueue=null;renderQueueSource();});
function queue(){if(recommendationQueue&&!activeQueue&&!collectionQueue)return recommendationQueue.map(key=>buttonsByKey.get(key)).filter(b=>b?.dataset.audio);if(collectionQueue&&!activeQueue)return collectionQueue.map(key=>buttonsByKey.get(key)).filter(b=>b?.dataset.audio);const playable=filteredQueue.filter(b=>b.dataset.audio);if(activeQueue)return playable;const playlist=selected&&lookup.get(selected.dataset.key)?.kind==='playlist',sameKind=playable.filter(b=>(lookup.get(b.dataset.key)?.kind==='playlist')===!!playlist);return sameKind.length?sameKind:playable;}
function filter(){
 renderQueueSource();
 let rows=records.filter(r=>r.kind!=='video'&&!r.video&&(!activeQueue||activeQueue.includes(r.key)));
 if(activeQueue)rows.sort((a,b)=>activeQueue.indexOf(a.key)-activeQueue.indexOf(b.key));
 const view=browse?browse.apply(rows,!!activeQueue):{visible:[],queue:rows,stage:'groups'},visible=new Set(view.visible.map(r=>r.key));
 filteredQueue=view.queue.map(r=>buttons.find(b=>b.dataset.key===r.key)).filter(Boolean);
 buttons.forEach(b=>{b.hidden=!visible.has(b.dataset.key);b.style.order=activeQueue?String(activeQueue.indexOf(b.dataset.key)):'';});
 document.getElementById('songs').append(...view.visible.map(r=>buttons.find(b=>b.dataset.key===r.key)).filter(Boolean));
 document.getElementById('songs').hidden=view.stage!=='songs';document.getElementById('result-count').textContent=view.stage==='songs'?view.queue.length+'개 항목 · 재생 대기열 '+queue().length+'개':'';
}
filter();
function musicDisplayTitle(r){return window.NoaBrowse?.displayTitle?.(r)??r.title;}
function renderMusicInfo(r){
 if(!r||!window.NoaBrowse)return;
 window.NoaBrowse.renderPath(document.getElementById('music-classification'),r);
 document.getElementById('music-info-title').textContent='곡 정보 · '+musicDisplayTitle(r);
 document.getElementById('music-info').hidden=false;
}
function renderVocal(r){
 const vocal=String(r.vocal||'').trim();
 const legacy={female:'여자솔로',male:'남자솔로',duet:'남녀듀엣'};
 const label=vocal||legacy[r.cast]||'보컬 정보 미등록';
 document.getElementById('detail-cast').textContent=label;
 document.getElementById('dock-artist').textContent=window.NoaBrowse?.genreName?.(r.genre)||'미분류';
 document.getElementById('cast-noa').hidden=!['female','duet'].includes(r.cast);
 document.getElementById('cast-noel').hidden=!['male','duet'].includes(r.cast);
 if(navigator.mediaSession?.metadata)navigator.mediaSession.metadata.artist=window.NoaBrowse?.genreName?.(r.genre)||'미분류';
}
function select(b,autoplay){
 if(selected===b&&ready){if(autoplay)requestPlayback();return;}
 changingTrack=true;resumeAfterMetadata=false;resumePosition=null;selected=b;pendingAutoplay=autoplay;const r=lookup.get(b.dataset.key);document.querySelector('.player').hidden=true;document.querySelector('.noa-transport').hidden=!r.audio;document.querySelector('[aria-label="곡 상세"]').hidden=true;if(browse)filter();buttons.forEach(x=>x.classList.toggle('selected',x===b));
 document.getElementById('now-title').textContent=musicDisplayTitle(r);document.getElementById('dock-title').textContent=musicDisplayTitle(r);document.getElementById('now-genre').textContent=r.genre.replaceAll('-',' ').toUpperCase();
 document.getElementById('detail-title').textContent=(r.ep?'EP.'+r.ep+' · ':r.act?'ACT.'+r.act+' · ':'')+musicDisplayTitle(r);
 renderMusicInfo(r);
 renderVocal(r);
 document.getElementById('lyrics-label').textContent=r.kind==='playlist'?'ACT 곡 구성 펼치기':'가사 펼치기';document.getElementById('lyrics').textContent=(r.kind==='playlist'?r.tracklist:(r.rawLyrics??r.lyrics))||'등록된 가사가 없습니다.';document.getElementById('song-description').textContent=r.description||'등록된 설명이 없습니다.';for(const id of ['music-description','music-lyrics'])document.getElementById(id).open=false;window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:r}}));
 const members=r.kind==='playlist'?[...r.tracklist.matchAll(/^\s*(?:[0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?\s+)?EP[.\s]*([0-9]{1,3})\b/gm)].map(m=>'single:'+r.genre+':'+m[1].padStart(2,'0')):[];const ordered=[...new Set(members)].filter(key=>lookup.has(key));const actButton=document.getElementById('act-play');actButton.hidden=ordered.length===0;actButton.onclick=()=>{activeQueue=ordered;genre.value=r.genre;type.value='single';search.value='';filter();const first=queue()[0];if(first)select(first,true)};
 const watch=document.getElementById('watch');watch.hidden=!r.suno;if(r.suno)watch.href=r.suno;
 player.pause();
 if(!r.audio){player.removeAttribute('src');player.load();changingTrack=false;status.textContent='음원 업로드 대기 중입니다. 관리자에게 음원 파일 업로드를 요청해 주세요.';return;}
 player.preload=autoplay?'auto':'metadata';player.src=r.audio;player.load();changingTrack=false;
 try{sessionStorage.setItem('noa-last-song',r.key)}catch{}
 status.textContent='저장된 음원 · 추가 인코딩 없이 재생합니다.';
 if(autoplay)requestPlayback();
}

function move(direction,ended=false){const q=queue();if(!q.length)return;let i=q.indexOf(selected);if(ended&&repeat&&selected?.dataset.audio){player.currentTime=0;select(selected,true);return}if(shuffle&&q.length>1){const other=q.filter(b=>b!==selected);select(other[Math.floor(Math.random()*other.length)],true);return}if(i<0)i=direction>0?-1:0;let n=i+direction;const target=q[(n+q.length)%q.length];if(ended&&target===selected)player.currentTime=0;select(target,true)}
document.getElementById('sequential').onclick=()=>{repeat=false;shuffle=false;for(const id of ['repeat','shuffle'])document.getElementById(id).setAttribute('aria-pressed','false');document.getElementById('sequential').setAttribute('aria-pressed','true');};
document.getElementById('dock-close').onclick=()=>{pendingAutoplay=false;player.pause();document.querySelector('.noa-transport').hidden=true;resumeAfterMetadata=false;savePlayback();};
function drawDockQueue(){const host=document.getElementById('dock-queue-items');host.replaceChildren();for(const b of queue()){const r=lookup.get(b.dataset.key);if(!r)continue;const item=document.createElement('button');item.type='button';item.className='noa-queue-track';item.dataset.queueKey=r.key;const current=selected===b;item.setAttribute('aria-current',current?'true':'false');const cover=document.createElement(r.thumb?'img':'span');cover.className='noa-queue-cover';if(r.thumb){cover.src=r.thumb;cover.alt='';cover.loading='lazy';}else{cover.textContent='♫';cover.setAttribute('aria-hidden','true');}const label=document.createElement('span');label.className='noa-queue-title';label.textContent=(r.ep?'EP.'+String(r.ep).padStart(2,'0')+' · ':'')+musicDisplayTitle(r);const genreNote=document.createElement('small');genreNote.className='noa-track-genre';genreNote.textContent=window.NoaBrowse?.genreName?.(r.genre)||'미분류';label.append(genreNote);const state=document.createElement('span');state.className='noa-queue-state';state.textContent=current?'현재 곡':'재생';item.append(cover,label,state);item.onclick=()=>{select(b,true);document.getElementById('dock-queue').close();};host.append(item);}if(!host.childElementCount){const empty=document.createElement('p');empty.textContent='재생할 수 있는 곡이 없습니다.';host.append(empty);}}
document.getElementById('dock-list').onclick=()=>{drawDockQueue();document.getElementById('dock-queue').showModal();};
window.addEventListener('noa-shell-track',e=>{const b=buttons.find(b=>b.dataset.key===e.detail.key);if(b){if(browse)browse.reveal(lookup.get(b.dataset.key));select(b,!!e.detail.play);}});
document.getElementById('dock-more').onclick=e=>{const bar=document.querySelector('.noa-transport');const expanded=bar.dataset.expanded!=='true';bar.dataset.expanded=String(expanded);e.currentTarget.setAttribute('aria-expanded',String(expanded));};
document.getElementById('pause-play').onclick=()=>{resumeAfterMetadata=false;if(!player.paused){pendingAutoplay=false;player.pause();}else requestPlayback();};
document.getElementById('seek').oninput=e=>{if(Number.isFinite(player.duration)&&player.duration>0)player.currentTime=player.duration*Number(e.target.value)/1000;};
document.getElementById('volume').oninput=e=>{player.volume=Number(e.target.value)/100;};player.volume=1;
const clock=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
player.addEventListener('loadedmetadata',()=>{const p=resumePosition;resumePosition=null;if(p>0&&p<player.duration)player.currentTime=p;if(resumeAfterMetadata){resumeAfterMetadata=false;requestPlayback();}});
player.addEventListener('timeupdate',()=>{const now=Date.now();if(now-lastPlaybackSave>=2000){lastPlaybackSave=now;savePlayback();}const seconds=player.currentTime,duration=player.duration;if(duration>0){document.getElementById('seek').value=String(Math.round(1000*seconds/duration));document.getElementById('seek-clock').textContent=clock(seconds)+' / '+clock(duration);document.getElementById('dock-current').textContent=clock(seconds);document.getElementById('dock-duration').textContent=clock(duration);}});
for(const event of ['playing','pause','waiting','error'])player.addEventListener(event,()=>{if(!lookup.get(selected?.dataset.key)?.audio)return;const playing=event==='playing';if(playing)window.dispatchEvent(new CustomEvent('noa-media-activity',{detail:{type:'audio',key:selected.dataset.key}}));document.getElementById('pause-play').setAttribute('aria-pressed',String(playing));document.getElementById('pause-play').setAttribute('aria-label',playing?'일시정지':'재생');document.getElementById('pause-play').innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="'+(playing?'M8 5v14M16 5v14':'m8 5 11 7-11 7V5Z')+'"/></svg>';status.textContent=({playing:'저장된 음원 재생 중',pause:'일시정지',waiting:'음원을 불러오는 중입니다.',error:'음원 파일을 재생할 수 없습니다. 파일 형식과 접근 권한을 확인해 주세요.'})[event];});
player.addEventListener('ended',()=>move(1,true));
window.addEventListener('noa-background',()=>{pendingAutoplay=false;player.pause();});
buttons.forEach(b=>{b.querySelector('.song-select').addEventListener('click',()=>select(b,false));b.addEventListener('click',e=>{if(e.target.closest('.sound-play'))select(b,true);});});document.getElementById('previous').onclick=()=>move(-1);document.getElementById('next').onclick=()=>move(1);
for(const id of ['repeat','shuffle'])document.getElementById(id).onclick=e=>{if(id==='repeat')repeat=!repeat;else shuffle=!shuffle;e.currentTarget.setAttribute('aria-pressed',String(id==='repeat'?repeat:shuffle));document.getElementById('sequential').setAttribute('aria-pressed',String(!repeat&&!shuffle))};
window.addEventListener('noa-jukebox-ready',e=>{const d=e.detail,r=lookup.get(d.key),b=buttons.find(b=>b.dataset.key===d.key);if(r&&b){r.audio=d.audio;b.dataset.audio=d.audio;filter();if(selected===b){selected=null;select(b,false);}}});
// Detail hydration never pauses, reloads or replaces the selected audio source.
const detailRequests=new Map(),detailEpochs=new Map();
function ensureMusicDetail(r){
 if(!r?.key||!lookup.has(r.key)||r.detailsLoaded)return;
 if(selected?.dataset.key===r.key){document.getElementById('lyrics').textContent=r.kind==='playlist'?r.tracklist:'가사를 불러오는 중입니다.';document.getElementById('song-description').textContent='설명을 불러오는 중입니다.';}
 let request=detailRequests.get(r.key);
 if(!request){const epoch=detailEpochs.get(r.key)||0;request=fetch('/noa-music-detail.php?key='+encodeURIComponent(r.key),{credentials:'same-origin',cache:'no-store'}).then(async response=>{if(!response.ok)throw Error('detail_unavailable');const data=await response.json();if(data.key!==r.key||typeof data.rawLyrics!=='string'||typeof data.description!=='string')throw Error('detail_invalid');if((detailEpochs.get(r.key)||0)===epoch)Object.assign(r,data,{detailsLoaded:true});return r;}).finally(()=>{if(detailRequests.get(r.key)===request)detailRequests.delete(r.key);});detailRequests.set(r.key,request);}
 request.then(data=>{if(selected?.dataset.key!==r.key)return;document.getElementById('lyrics').textContent=(r.kind==='playlist'?r.tracklist:data.rawLyrics)||'등록된 가사가 없습니다.';document.getElementById('song-description').textContent=data.description||'등록된 설명이 없습니다.';}).catch(()=>{if(selected?.dataset.key!==r.key)return;document.getElementById('lyrics').textContent='가사를 불러오지 못했습니다. 가사를 다시 펼쳐 주세요.';document.getElementById('song-description').textContent='설명을 불러오지 못했습니다. 설명을 다시 펼쳐 주세요.';});
}
window.addEventListener('noa-track-selected',e=>ensureMusicDetail(e.detail.record));
window.addEventListener('noa-inline-record-saved',event=>{const r=lookup.get(event.detail.key);if(!r)return;detailEpochs.set(r.key,(detailEpochs.get(r.key)||0)+1);detailRequests.delete(r.key);const f=event.detail.fields;if(typeof f.title==='string')r.title=f.title;if(typeof f.description==='string')r.description=f.description;if(typeof f.lyrics==='string')r.rawLyrics=f.lyrics;if(typeof f.cast==='string')r.cast=f.cast;if(typeof f.vocal==='string')r.vocal=f.vocal;if(typeof f.originalArtist==='string')r.originalArtist=f.originalArtist;if(selected?.dataset.key===r.key){renderVocal(r);renderMusicInfo(r);for(const id of ['now-title','dock-title','detail-title'])document.getElementById(id).textContent=musicDisplayTitle(r);if(typeof f.lyrics==='string')document.getElementById('lyrics').textContent=f.lyrics;if(typeof f.description==='string')document.getElementById('song-description').textContent=f.description;}});
for(const id of ['music-description','music-lyrics'])document.getElementById(id).addEventListener('toggle',()=>{const r=selected&&lookup.get(selected.dataset.key);if(document.getElementById(id).open&&r&&!r.detailsLoaded)ensureMusicDetail(r);});
let saved='';try{saved=sessionStorage.getItem('noa-last-song')||''}catch{}
const requestedTrack=new URLSearchParams(location.search).get('track');
let resumeNavigation=false;try{const returned=JSON.parse(sessionStorage.getItem('noa-playback-return')||'null');resumeNavigation=window.performance?.getEntriesByType('navigation')[0]?.type==='reload'||!!(returned&&Date.now()-returned.at>=0&&Date.now()-returned.at<30000);}catch{}
const checkpoint=resumeNavigation&&playbackCheckpoint&&(!requestedTrack||requestedTrack===playbackCheckpoint.key)?playbackCheckpoint:null;
const first=buttons.find(b=>b.dataset.key===requestedTrack)||(checkpoint?buttons.find(b=>b.dataset.key===checkpoint.key&&b.dataset.audio):null)||(new URLSearchParams(location.search).get('view')==='all'?buttons.find(b=>b.dataset.key===saved&&!b.hidden):null);
if(first){select(first,false);if(checkpoint&&first.dataset.key===checkpoint.key){
 if(Array.isArray(checkpoint.queue)){activeQueue=[...new Set(checkpoint.queue)].filter(k=>lookup.get(k)?.audio);if(!activeQueue.includes(checkpoint.key))activeQueue=null;if(activeQueue&&checkpoint.recommendation===true){recommendationQueue=activeQueue;activeQueue=null;}else if(activeQueue&&checkpoint.collectionLoop===true){collectionQueue=activeQueue;activeQueue=null;}if(checkpoint.listening)setListeningSource(checkpoint.listening.scope,checkpoint.listening.genre,checkpoint.listening);filter();}
 repeat=checkpoint.repeat===true;shuffle=checkpoint.shuffle===true;
 for(const id of ['repeat','shuffle','sequential'])document.getElementById(id).setAttribute('aria-pressed',String(id==='repeat'?repeat:id==='shuffle'?shuffle:!repeat&&!shuffle));
 if(Number.isFinite(checkpoint.volume)&&checkpoint.volume>=0&&checkpoint.volume<=1){player.volume=checkpoint.volume;document.getElementById('volume').value=String(checkpoint.volume*100);}
 resumePosition=checkpoint.seconds;
 resumeAfterMetadata=checkpoint.playing===true&&!checkpoint.closed;
 document.querySelector('.noa-transport').hidden=checkpoint.closed===true;

}}
window.addEventListener('DOMContentLoaded',()=>{browse=window.NoaBrowse.mount({host:document.getElementById('music-browse'),rows:[...new Map([...collections,...records].map(r=>[r.key,r])).values()],onChange:filter});if(first){browse.focusTrack(first.dataset.key);renderMusicInfo(lookup.get(first.dataset.key));}filter();const personal=document.getElementById('my-playlists');const showPersonal=()=>personal.hidden=location.hash!=='#my-playlists';showPersonal();window.addEventListener('hashchange',showPersonal);});
if('serviceWorker' in navigator)navigator.serviceWorker.register('/noa-sw.js').catch(()=>{});

// A synchronous user-gesture entrypoint shared with home. Never accept media URLs.
function startListeningQueue(keys,scope,genre='',options={}){
 if(scope==='weather'&&!weatherVip)return false;
 const acrossGenres=scope==='all'||scope==='catalogMood'||scope==='weather';
 const recommendationLimit=acrossGenres?100:scope==='recommendedGenre'?10:0;
 if(!Array.isArray(keys)||!keys.length)return false;
 const accepted=[...new Set(keys)].map(k=>lookup.get(k)).filter(r=>r&&r.audio&&!r.video&&r.kind!=='playlist'&&(acrossGenres||r.genre===genre));
 if(!accepted.length)return false;
 const tracks=accepted.map(r=>r.key);
 recommendationQueue=recommendationLimit?tracks.slice(0,recommendationLimit):null;
 collectionQueue=recommendationLimit?null:tracks;
 activeQueue=null;repeat=false;shuffle=false;
 for(const id of ['repeat','shuffle'])document.getElementById(id).setAttribute('aria-pressed','false');
 document.getElementById('sequential').setAttribute('aria-pressed','true');
 const b=buttonsByKey.get(accepted[0].key);if(!b)return false;
 setListeningSource(scope,genre,options);renderQueueSource();
 if(selected===b)player.currentTime=0;
 select(b,true);savePlayback();window.dispatchEvent(new Event('noa-listening-selection'));return true;
}
const weatherFeedback=document.getElementById('dock-weather-feedback');
let weatherPath=[];
function changeWeatherTail(softer){
 if(listeningSelection()?.scope!=='weather'||!selected||!window.NoaListeningModel)return;
 const index=recommendationQueue.indexOf(selected.dataset.key);if(index<0)return;
 const kept=recommendationQueue.slice(0,index+1),prior=new Set(kept.map(k=>NoaListeningModel.recordingId(lookup.get(k))));
 const currentMood=weatherPath[index]||listeningSource.mood||'comfort';
 const gentler={drive:'cruise',energy:'walk',walk:'comfort',cruise:'calm',comfort:'calm',focus:'calm',calm:'calm'};
 const nextMood=softer?(gentler[currentMood]||'calm'):currentMood;
 const matches=NoaListeningModel.wholeMoodMix(records,nextMood).rows;
 const next=matches.filter(r=>r.audio&&!prior.has(NoaListeningModel.recordingId(r))).slice(0,2);
 const message=weatherFeedback.querySelector('[role=status]');
 if(!next.length){message.textContent='이어서 들을 다른 곡이 없어요.';return;}
 recommendationQueue.splice(index+1,recommendationQueue.length,...next.map(r=>r.key));
 weatherPath=weatherPath.slice(0,index+1).concat(next.map(()=>nextMood));
 setListeningSource('weather','',{mood:nextMood});renderQueueSource();savePlayback();drawDockQueue();
 message.textContent='다음 곡은 '+next[0].title+'입니다. 지금 곡이 끝나면 이어져요.';
}
weatherFeedback.querySelector('[data-weather-same]').onclick=()=>changeWeatherTail(false);
weatherFeedback.querySelector('[data-weather-gentler]').onclick=()=>changeWeatherTail(true);

const api={
 engine:"N80 Engine",module:"jukebox",name:"N80 JukeBox",version:1,
 record:key=>{const row=lookup.get(key);return row?{...row}:null;},
 currentKey:()=>selected?.dataset.key||"",
 visibleKeys:()=>filteredQueue.filter(b=>lookup.get(b.dataset.key)?.kind!=="playlist").map(b=>b.dataset.key),
 selectQueue:(keys,autoplay=false)=>{if(!Array.isArray(keys))return 0;activeQueue=[...new Set(keys)].filter(key=>lookup.has(key));filter();const first=queue()[0]||filteredQueue[0];if(first)select(first,autoplay);return queue().length;},
 play:key=>{const row=buttonsByKey.get(key);if(!row||!lookup.get(key)?.audio)return false;select(row,true);return true;},
 pause:()=>{pendingAutoplay=false;resumeAfterMetadata=false;player.pause();savePlayback();},
 close:()=>document.getElementById("dock-close").click(),
 next:()=>move(1),previous:()=>move(-1),
 seek:seconds=>{if(Number.isFinite(seconds)&&Number.isFinite(player.duration))player.currentTime=Math.max(0,Math.min(player.duration,seconds));},
 snapshot:()=>({engine:"N80 Engine",module:"jukebox",key:selected?.dataset.key||"",playing:!player.paused&&!player.ended,desiredPlaying:pendingAutoplay,seconds:player.currentTime,repeat,shuffle,queue:queue().map(row=>row.dataset.key),backend:window.NoaNativeBridge?"android":"browser"}),
 playWeather:(keys,path)=>{
  if(!weatherVip||!Array.isArray(path)||!path.length||!path.every(m=>Object.hasOwn(musicMoodLabels,m)))return false;
  weatherPath=path.slice();weatherFeedback.querySelector('[role=status]').textContent='';
  return startListeningQueue(keys,'weather','',{mood:path[0]});
 },
 catalog:()=>records.map(r=>({...r})),
 showCategories:()=>{
  if(activeQueue){collectionQueue=activeQueue;activeQueue=null;}
  browse?.showCategories();
 },
 listeningSelection,
 playQueue:(keys,genre,options)=>typeof genre==='string'&&startListeningQueue(keys,'genre',genre,options),
 playRecommendedGenre:(keys,genre)=>typeof genre==='string'&&startListeningQueue(keys,'recommendedGenre',genre),
 playMoodMix:(keys,mood)=>Object.hasOwn(musicMoodLabels,mood)&&startListeningQueue(keys,'catalogMood','',{mood}),
 playRecommendedMix:keys=>startListeningQueue(keys,'all')
};

let installPrompt;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;document.getElementById('install').hidden=false});document.getElementById('install').onclick=async()=>{if(installPrompt){await installPrompt.prompt();installPrompt=null;document.getElementById('install').hidden=true}};

// The main player owns play intent; retry logic must not override pause/close/track changes.
(()=>{
 if(window.NoaNativeBridge||!window.NoaPlaybackRecovery||typeof player==='undefined')return;
 const recovery=window.NoaPlaybackRecovery.attach(player,{wanted:()=>pendingAutoplay&&!leavingPage&&!changingTrack,key:()=>selected?.dataset.key||'',status:message=>{status.textContent=message;}});
 window.addEventListener('noa-track-selected',()=>recovery.reset());
 window.addEventListener('online',()=>recovery.online());
 window.addEventListener('pagehide',()=>recovery.stop());
})();


Object.defineProperties(globalThis,{
 records:{configurable:true,get:()=>records},
 collections:{configurable:true,get:()=>collections},
 buttons:{configurable:true,get:()=>buttons},
 search:{configurable:true,get:()=>search},
 genre:{configurable:true,get:()=>genre},
 type:{configurable:true,get:()=>type},
 lookup:{configurable:true,get:()=>lookup},
 player:{configurable:true,get:()=>player},
 status:{configurable:true,get:()=>status},
 buttonsByKey:{configurable:true,get:()=>buttonsByKey},
 queue:{configurable:true,get:()=>queue},
 move:{configurable:true,get:()=>move},
 select:{configurable:true,get:()=>select},
 filter:{configurable:true,get:()=>filter},
 drawDockQueue:{configurable:true,get:()=>drawDockQueue},
 requestPlayback:{configurable:true,get:()=>requestPlayback},
 savePlayback:{configurable:true,get:()=>savePlayback},
 musicDisplayTitle:{configurable:true,get:()=>musicDisplayTitle},
 browse:{configurable:true,get:()=>browse,set:value=>{browse=value;}},
 filteredQueue:{configurable:true,get:()=>filteredQueue,set:value=>{filteredQueue=value;}},
 selected:{configurable:true,get:()=>selected,set:value=>{selected=value;}},
 ready:{configurable:true,get:()=>ready,set:value=>{ready=value;}},
 repeat:{configurable:true,get:()=>repeat,set:value=>{repeat=value;}},
 shuffle:{configurable:true,get:()=>shuffle,set:value=>{shuffle=value;}},
 pendingAutoplay:{configurable:true,get:()=>pendingAutoplay,set:value=>{pendingAutoplay=value;}},
 activeQueue:{configurable:true,get:()=>activeQueue,set:value=>{activeQueue=value;}},
 collectionQueue:{configurable:true,get:()=>collectionQueue,set:value=>{collectionQueue=value;}},
 recommendationQueue:{configurable:true,get:()=>recommendationQueue,set:value=>{recommendationQueue=value;}},
 leavingPage:{configurable:true,get:()=>leavingPage,set:value=>{leavingPage=value;}},
 changingTrack:{configurable:true,get:()=>changingTrack,set:value=>{changingTrack=value;}}
});
window.N80JukeBox=Object.freeze(api);
window.NoaMusic=window.N80JukeBox; // Compatibility alias, one owner.
window.dispatchEvent(new CustomEvent("n80-jukebox-ready",{detail:{module:"jukebox"}}));

})();
