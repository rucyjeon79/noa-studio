/* Public channel navigation reuses the owner's category/genre/collection identity. */
(()=>{'use strict';
const source=document.getElementById('channel-data');if(!source||!window.NoaChannelExplorer)return;
const data=JSON.parse(source.textContent),tree=window.NoaChannelExplorer.build(data.records,data.title),nav=document.getElementById('channel-navigation'),host=document.getElementById('channel-tracks'),search=document.getElementById('channel-search'),result=document.getElementById('channel-result'),empty=document.getElementById('channel-empty'),audio=document.getElementById('channel-audio');
function prune(node){if(!node.children)return true;node.children=node.children.filter(prune);return node.children.length>0;}prune(tree);
const names=window.NoaBrowse?.names||{},label=n=>n.type==='genre'?String(names[n.genre]||n.label).replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu,'').trim():n.label;
let selected=[0,0,0],playing='',columns=3;try{const saved=Number(localStorage.getItem('noa-channel-columns'));if([1,2,3,4].includes(saved))columns=saved;}catch{}
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function songCount(n){const keys=new Set();(function visit(v){if(v.record&&v.type==='song')keys.add(v.record.key);for(const c of v.children||[])visit(c);})(n);return keys.size;}
function drawNavigation(){nav.replaceChildren();let parent=tree;
 for(let level=0;level<3;level++){if(!parent.children.length)break;selected[level]=Math.min(selected[level],parent.children.length-1);const section=node('section',undefined,'channel-filter'),title=node('h3',(level+1)+' · '+['카테고리','세부 장르','곡 묶음'][level]),options=node('div',undefined,'channel-options');section.append(title,options);options.setAttribute('role','group');options.setAttribute('aria-label',title.textContent);
  parent.children.forEach((child,index)=>{const b=node('button',undefined,'channel-option');b.type='button';b.setAttribute('aria-pressed',String(selected[level]===index));b.append(node('span',label(child)),node('small',songCount(child)+'곡'));b.onclick=()=>{selected[level]=index;for(let i=level+1;i<3;i++)selected[i]=0;search.value='';drawNavigation();};options.append(b);});nav.append(section);parent=parent.children[selected[level]];
 }
 document.getElementById('channel-selection').textContent='4 · '+(parent===tree?'곡 목록':label(parent));drawSongs(parent.children||[]);
}
function currentSongs(){let n=tree;for(const i of selected){if(!n.children?.[i])return [];n=n.children[i];}return n.children||[];}
function updatePlayButtons(){for(const b of host.querySelectorAll('[data-play]')){const active=b.dataset.play===playing&&audio&&!audio.paused;b.textContent=active?'일시 정지':'재생';b.setAttribute('aria-pressed',String(active));}}
function drawSongs(songs){host.replaceChildren();const query=search.value.trim().toLocaleLowerCase('ko');const rows=songs.filter(n=>n.type==='song'&&n.label.toLocaleLowerCase('ko').includes(query));
 result.textContent=rows.length+'곡'+(query?' · “'+search.value.trim()+'” 검색 결과':'');empty.hidden=rows.length>0;empty.textContent=tree.children.length?'검색한 곡이 없습니다. 다른 제목으로 찾아보세요.':'아직 공개한 곡이 없습니다.';
 for(const n of rows){const r=n.record,card=node('article',undefined,'channel-track'),img=node('img'),body=node('div',undefined,'channel-track-body');card.dataset.key=r.key;img.src=r.cover||data.fallback;img.alt='';img.loading='lazy';img.width=240;img.height=240;img.onerror=()=>{img.onerror=null;img.src=data.fallback;};body.append(node('small',(r.ep?'EP '+String(r.ep).padStart(2,'0')+' · ':'')+label({type:'genre',genre:r.genre,label:r.genre})),node('h4',r.title));
  const actions=node('div',undefined,'channel-track-actions');if(data.canPlay&&r.audio){const play=node('button','재생');play.type='button';play.dataset.play=r.key;play.setAttribute('aria-label',r.title+' 재생 또는 일시 정지');play.onclick=async()=>{if(playing===r.key&&!audio.paused){audio.pause();return;}if(playing!==r.key){audio.pause();audio.src=r.audio;playing=r.key;}document.getElementById('channel-player').hidden=false;document.getElementById('channel-playing').textContent=r.title;try{await audio.play();result.textContent=r.title+' 재생 중';}catch{result.textContent='재생을 시작하지 못했습니다. 재생 버튼을 다시 누르거나 잠시 후 시도해 주세요.';}updatePlayButtons();};actions.append(play);}
  const video=node('a','YouTube');video.href=r.youtube;video.setAttribute('aria-label',r.title+' YouTube 목록');actions.append(video);body.append(actions);card.append(img,body);host.append(card);
 }updatePlayButtons();
}
function layout(){host.dataset.layout=String(columns);for(const b of document.querySelectorAll('[data-columns]'))b.setAttribute('aria-pressed',String(Number(b.dataset.columns)===columns));document.getElementById('channel-layout-note').hidden=!(columns>2&&matchMedia('(max-width:700px)').matches);}
for(const b of document.querySelectorAll('[data-columns]'))b.onclick=()=>{columns=Number(b.dataset.columns);try{localStorage.setItem('noa-channel-columns',String(columns));}catch{}layout();};matchMedia('(max-width:700px)').addEventListener('change',layout);
search.addEventListener('input',()=>drawSongs(currentSongs()));if(audio){for(const event of ['play','pause','ended'])audio.addEventListener(event,updatePlayButtons);audio.addEventListener('error',()=>{result.textContent='음원을 불러오지 못했습니다. 잠시 후 다시 재생해 주세요.';});}
layout();drawNavigation();
})();
