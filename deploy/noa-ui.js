/* Shared web/GnuBoard UI. Source song text and legacy preferences are never rewritten. */
(()=>{'use strict';
if(window.NoaUI)return;const root=document.documentElement;const g5=/^\/(bbs|adm)\//.test(location.pathname),admin=/^\/adm\//.test(location.pathname);if(g5)root.classList.add(admin?'noa-admin':'noa-g5');
const icons={home:'M3 10l9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z M9 21v-8h6v8',music:'M9 18V5l12-2v13 M9 8l12-2 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6',playlists:'M4 6h16 M4 11h12 M4 16h8 M17 14l5 3-5 3z',world:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c4 5 4 13 0 18-4-5-4-13 0-18',community:'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0',library:'M4 3h4v18H4z M12 3h4v18h-4z M20 4l3 16',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z'};
icons.user='M20 21v-2a6 6 0 0 0-12 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0';icons.book='M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1z M12 5v16';icons.disc='M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0';icons.mail='M3 5h18v14H3z M3 5l9 8 9-8';icons.mic='M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z M5 10v1a7 7 0 0 0 14 0v-1 M12 18v4 M8 22h8';
icons.search='M21 21l-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0';icons.edit='M16 3l5 5 M4 20l4-1L21 6l-4-4L4 15z';icons.trash='M3 6h18 M8 6V4h8v2 M5 6l1 15h12l1-15 M10 10v7 M14 10v7';icons.more='M5 12h.01 M12 12h.01 M19 12h.01';
icons.download='M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4';
icons.youtube='M3 5h18v14H3z M10 9l6 3-6 3z';
const menu=[['home','홈','/'],['youtube','YouTube','/noa-youtube.php'],['world','세계관','/noa-world.php'],['music','음원','/noa-music.php'],['library','MY','/noa-my.php']];
const words={}
const langIndex={en:0,ja:1,th:2};let config=null,state=null,revision=0,remote=null,dirty=false;
const safeRead=k=>{try{return localStorage.getItem(k)}catch{return null}};const safeWrite=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let language=safeRead('noa-view-lang')||'ko';if(!['ko','ja','en','th'].includes(language))language='ko';
function tr(text){return language==='ko'?text:words[text]?.[langIndex[language]]||text}
function updateLabel(el){if(el.children.length)return;const current=el.textContent.trim();const original=words[current]?current:el.dataset.noaOriginal;if(!original||!words[original])return;if(current!==original&&!words[original].includes(current))return;el.dataset.noaOriginal=original;const translated=tr(original);if(el.textContent!==translated)el.textContent=translated;}
function translateFixedNodes(){document.querySelectorAll('#mb_login h2,#mb_login h3,#mb_login a,#login_fs label,#login_info label,#register_form label,#register_form th,#bo_w label,.tbl_head01 thead th,.btn_bo_user a,.bo_v_com a').forEach(el=>{for(const node of el.childNodes){if(node.nodeType!==Node.TEXT_NODE)continue;const text=node.nodeValue.trim();let original=words[text]?text:node.noaOriginal;if(!original||!words[original]||text!==original&&!words[original].includes(text))continue;node.noaOriginal=original;const translated=node.nodeValue.replace(text,tr(original));if(translated!==node.nodeValue)node.nodeValue=translated;}});}
function markMetadata(){const names=window.NoaBrowse?.names;if(!names)return;for(const node of document.querySelectorAll('.catalog-card small,.catalog-meta,.noa-eyebrow,.noa-card-context')){if(node.children.length)continue;let text=node.textContent;for(const [key,label]of Object.entries(names))text=text.replaceAll(key,label);text=text.replace(/\b(?:unclassified|unknown)\b/g,'음악');if(text!==node.textContent)node.textContent=text;}}
function markLabels(){decorate();markMetadata();translateFixedNodes();document.querySelectorAll('[data-noa-i18n]').forEach(el=>{const text=tr(el.dataset.noaI18n);if(el.textContent!==text)el.textContent=text});document.querySelectorAll('.controls button,#pause-play,#my-playlists h2,#lyrics-label,#player-status,#noa-settings-status,#act-play,#install,#genre option,#type option,#my-select option[value=""],#login_fs label,#login_info a,#login_info label,.noa-page main>p,.noa-footer a').forEach(updateLabel);document.querySelectorAll('#search,#my-title,#mb_login input[placeholder],#register_form input[placeholder]').forEach(el=>{const value=el.dataset.noaPlaceholder||el.getAttribute('placeholder');if(words[value]){el.dataset.noaPlaceholder=value;const next=tr(value);if(el.placeholder!==next)el.placeholder=next}});root.lang=language;}

function icon(key){return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'+icons[key]+'"/></svg>'}
function actionIcon(el){const href=el.getAttribute('href')||'',text=el.textContent.trim();return /삭제/.test(text)?'trash':/검색/.test(text)?'search':/글쓰기|작성|수정/.test(text)?'edit':/옵션/.test(text)?'more':/다운로드|설치 파일|받기/.test(text)?'download':/캐릭터|회원|계정|로그인|로그아웃/.test(text)?'user':/설명|정보|세계관/.test(text)?'book':/커뮤니티|소식/.test(text)?'community':/youtube|영상|MV/.test(text+' '+href)?'youtube':/관리|설정/.test(text)?'settings':/곡|suno|재생|제작|생성/.test(text+' '+href)?'music':'library';}
function decorate(){
 // Existing nodes/URLs/listeners are retained. Exclude card links, document-body citations and native navigation.
 for(const el of document.querySelectorAll('main a,main summary,main button:is(.noa-button.primary,#my-new,#my-add,#my-save,#my-play,#act-play,#lab-text-submit,#noa-settings-save),.noa-g5 .btn_bo_user a,.noa-g5 .btn_bo_user button,.noa-g5 .btn_confirm a,.noa-g5 .btn_confirm button,.noa-g5 .bo_v_nb a,.noa-g5 .bo_v_com a')){
  if(el.matches('[data-noa-icon],.noa-action,.noa-logo,.brand,.noa-music-card,.noa-genre,.noa-world-act,.noa-personal-card,.noa-browse-card,.catalog-card')||el.closest('nav,footer,.noa-world-text,[data-noa-document-link]')||el.querySelector('img,svg')||!el.textContent.trim())continue;
  el.dataset.noaIcon=actionIcon(el);
 }
 if(document.querySelector('.lab-tabs'))for(const a of document.querySelectorAll('.lab-tabs a')){const keys={'#lab-text':'settings','#lab-create':'music','#lab-jobs':'library','#lab-growth':'youtube'};if(keys[a.getAttribute('href')])a.dataset.noaIcon=keys[a.getAttribute('href')];}
 document.querySelectorAll('[data-noa-icon]').forEach(el=>{if(el.querySelector('svg')||!icons[el.dataset.noaIcon])return;const label=document.createElement('span');while(el.firstChild)label.append(el.firstChild);if(el.closest('.btn_bo_user,.btn_confirm,.bo_v_nb,.bo_v_com')&&root.classList.contains('noa-g5')){const name=el.getAttribute('aria-label')||el.title||label.textContent.trim();el.setAttribute('aria-label',name);label.textContent=({'게시판 검색':'검색','게시판 리스트 옵션':'옵션'})[name]||name;}if(el.dataset.noaI18n){label.dataset.noaI18n=el.dataset.noaI18n;delete el.dataset.noaI18n;}el.insertAdjacentHTML('afterbegin',icon(el.dataset.noaIcon));el.append(label);el.classList.add('noa-action');});
 // Explicit section chrome only: song controls and JUKEBOX DOM are never rewritten.
 if(location.pathname==='/noa-music.php')return;
 document.querySelectorAll('main>h1,.lab-heading h1,.lab-panel>h2,.lab-section>h2,.noa-section h2,.noa-section-head h2,.noa-world-prose>h2,.noa-world-heading>h2,#youtube-playlists>h2').forEach(el=>{if(el.dataset.noaHeading)return;el.dataset.noaHeading='true';const text=el.textContent;let key=/NOA WORLD|세계관|프롤로그|에필로그|챕터/.test(text)?'book':/사연|당신의 이야기/.test(text)?'mail':/커버/.test(text)?'mic':/EP|컬렉션/.test(text)?'disc':/목록|플레이리스트|보관함/.test(text)?'playlists':/MY|최근|계정/.test(text)?'user':/관리|작업실|설정/.test(text)?'settings':'music';const label=document.createElement('span');while(el.firstChild)label.append(el.firstChild);if(el.dataset.noaI18n){label.dataset.noaI18n=el.dataset.noaI18n;delete el.dataset.noaI18n;}el.insertAdjacentHTML('afterbegin',icon(key));el.append(label);});
}
function navItem(item){const a=document.createElement('a');a.href=item[2];if(item[0]==='settings'&&location.pathname!=='/noa-settings.php')a.onclick=e=>{e.preventDefault();openSettings();};a.innerHTML=icon(item[0]);const t=document.createElement('span');t.dataset.noaI18n=item[1];t.textContent=tr(item[1]);a.append(t);const target=new URL(item[2],location.origin);const active=location.pathname==='/noa-world.php'?'world':/^\/noa-(?:music|catalog)[.]php$/.test(location.pathname)?'music':location.pathname==='/noa-youtube.php'?(location.search.includes('world=1')?'world':'youtube'):/^\/(?:noa-(?:my|settings|library|editor|ai-lab|theme-admin)|bbs\/)/.test(location.pathname)?'library':'home';if(item[0]===active)a.setAttribute('aria-current','page');return a;}
function shell(){if(admin||document.querySelector('.noa-sidebar'))return;const side=document.createElement('aside');side.className='noa-sidebar';side.innerHTML='<a href="/" class="noa-logo">NOA STUDIO<small>AI ARTIST NOA</small></a>';const nav=document.createElement('nav');nav.className='noa-menu';nav.setAttribute('aria-label','NOA STUDIO');menu.forEach(item=>nav.append(navItem(item)));side.append(nav);const bottom=document.createElement('div');bottom.className='noa-sidebar-bottom';bottom.innerHTML='<span>Music. Stories. Starlight.</span><a href="/noa-download.php">NOA STUDIO · Android ↗</a><a data-noa-login href="/bbs/login.php">'+tr('로그인')+'</a><a data-noa-lab href="/noa-ai-lab.php" hidden>NOA AI LAB · GROWTH</a><a data-noa-admin href="/noa-library.php" hidden>'+tr('관리자')+'</a>';side.append(bottom);document.body.prepend(side);const mobile=document.createElement('nav');mobile.className='noa-mobile-nav';mobile.setAttribute('aria-label','NOA STUDIO mobile');menu.forEach(item=>mobile.append(navItem(item)));document.body.append(mobile);if(g5){const top=document.createElement('header');top.className='noa-g5-top';top.innerHTML='<a class="noa-logo" href="/">NOA STUDIO</a><a data-noa-login href="/bbs/login.php">'+tr('로그인')+'</a>';document.body.insertBefore(top,side.nextSibling);const footer=document.createElement('footer');footer.className='noa-footer';footer.innerHTML='<span>NOA STUDIO · Music. Stories. Starlight.</span><a href="/bbs/content.php?co_id=privacy" data-noa-i18n="개인정보처리방침">개인정보처리방침</a><a href="/bbs/content.php?co_id=provision" data-noa-i18n="이용약관">이용약관</a>';document.body.append(footer);}window.NoaBrand?.apply();markLabels();}
function apply(next){if(!config)return;const theme=config.themes.find(t=>t.id===next.theme);if(!theme)return;state={...next};root.dataset.noaTheme=theme.id;root.dataset.design=next.design||'ios';root.dataset.radius=next.radius||'soft';for(const[k,v]of Object.entries(theme.tokens))root.style.setProperty('--noa-'+k,v);language=['ko','ja','en','th'].includes(next.language)?next.language:language;safeWrite('noa-view-lang',language);safeWrite('noa-ui-selection',JSON.stringify(state));document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.tokens.bg);markLabels();window.dispatchEvent(new Event('noa-theme'));}
function openSettings(){let dialog=document.getElementById('noa-settings-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='noa-settings-dialog';dialog.className='noa-settings-dialog';dialog.innerHTML='<form method=dialog><button aria-label=Close class=noa-dialog-close>×</button></form><h2>테마와 언어</h2><div id=noa-settings-controls></div><p id=noa-settings-status role=status></p>';dialog.querySelector('h2').dataset.noaI18n='테마와 언어';document.body.append(dialog);}settings();dialog.showModal();}
function status(text){const e=document.getElementById('noa-settings-status');if(e)e.textContent=text;}
function settings(){const host=document.getElementById('noa-settings-controls');if(!host||!config||!state)return;host.replaceChildren();const row=document.createElement('div');row.className='noa-settings-row';const options=[['theme','테마',config.themes.map(x=>[x.id,x.name])],['language','언어',[['ko','한국어'],['ja','日本語'],['en','English'],['th','ไทย']]],['radius','모서리',[['soft','둥글게'],['sharp','각지게']]]];for(const[key,name,values]of options){const label=document.createElement('label');const span=document.createElement('span');span.dataset.noaI18n=name;span.textContent=tr(name);const select=document.createElement('select');select.id='noa-'+key;select.setAttribute('aria-label',name);for(const[id,title]of values){if(key==='theme'&&remote&&!remote.defaults.enabled.includes(id))continue;const option=document.createElement('option');option.value=id;option.textContent=tr(title);if(words[title])option.dataset.noaI18n=title;select.append(option);}select.value=state[key];select.onchange=()=>{dirty=true;apply({...state,[key]:select.value});status(remote?.member?'변경한 설정을 계정에 저장할 수 있습니다.':'이 기기에 설정을 저장했습니다.');document.getElementById('noa-settings-save').disabled=false;};label.append(span,select);row.append(label);}host.append(row);const preview=document.createElement('div');preview.className='noa-preview';for(const key of ['bg','surface','raised','accent','text']){const swatch=document.createElement('i');swatch.style.background='var(--noa-'+key+')';preview.append(swatch);}host.append(preview);const save=document.createElement('button');save.id='noa-settings-save';save.className='noa-button';save.style.marginTop='24px';save.dataset.noaI18n=remote?.member?'서버에 저장':'기기에 저장';save.textContent=tr(save.dataset.noaI18n);save.disabled=!dirty;save.onclick=async()=>{if(!remote?.member){dirty=false;save.disabled=true;status('이 기기에 설정을 저장했습니다.');return;}save.disabled=true;try{const r=await fetch('/noa-bridge/ui-preferences.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-CSRF':remote.csrf},body:JSON.stringify({settings:state,expectedRevision:revision})});const j=await r.json();if(!r.ok)throw Error(j.error);revision=j.revision;dirty=false;status('계정에 설정을 저장했습니다.');}catch{save.disabled=false;status('서버에 저장하지 못했습니다. 현재 기기의 설정은 유지됩니다. 새로 불러온 뒤 다시 저장해 주세요.');}};host.append(save);if(remote?.admin){const p=document.createElement('p');p.innerHTML='<a href="/noa-theme-admin.php">테마 정책 · 변경 이력 관리</a>';host.append(p);}markLabels();}
async function init(){shell();try{const r=await fetch('/noa-design.json',{cache:'no-cache'});if(!r.ok)throw Error();config=await r.json();try{const wordsResponse=await fetch('/noa-ui-words.json');if(wordsResponse.ok)Object.assign(words,await wordsResponse.json());}catch{}let local=null;try{local=JSON.parse(safeRead('noa-ui-selection')||'null')}catch{}apply(local&&config.themes.some(t=>t.id===local.theme)?{design:'ios',radius:'soft',...local,language}:{theme:config.defaultTheme,language,design:root.dataset.design||'ios',radius:root.dataset.radius||'soft'});settings();try{const response=await fetch('/noa-bridge/ui-preferences.php',{credentials:'same-origin'});if(!response.ok)throw Error();remote=await response.json();revision=remote.revision;if(!dirty&&remote.settings)apply({...remote.settings,theme:remote.defaults.enabled.includes(remote.settings.theme)?remote.settings.theme:remote.defaults.theme});else if(!dirty&&!local)apply({...state,theme:remote.defaults.theme});document.querySelectorAll('[data-noa-login]').forEach(a=>{a.href=remote.member?'/bbs/member_confirm.php?url=register_form.php':'/bbs/login.php';a.textContent=remote.member?remote.displayName:tr('로그인')});document.querySelectorAll('[data-noa-admin],[data-noa-lab]').forEach(a=>a.hidden=!remote.admin);settings();status(remote.member?'계정에 저장하면 웹과 앱의 동일 설정 화면에서 불러옵니다.':'비로그인 설정은 이 기기에 보관합니다.');}catch{status('서버 설정을 불러오지 못했습니다. 마지막 기기 설정을 유지합니다.');}}catch{status('디자인 설정을 불러오지 못했습니다. 기본 화면을 유지합니다.');}}
window.addEventListener('storage',e=>{if(e.key==='noa-ui-selection'&&e.newValue){try{apply(JSON.parse(e.newValue));settings()}catch{}}});let markPending=false;new MutationObserver(()=>{if(markPending)return;markPending=true;queueMicrotask(()=>{markPending=false;markLabels()});}).observe(document.body||root,{childList:true,subtree:true,characterData:true});window.addEventListener('hashchange',()=>{document.querySelectorAll('.noa-menu,.noa-mobile-nav').forEach(nav=>nav.replaceChildren(...menu.map(navItem)));});window.NoaUI={translate:tr,apply,getState:()=>state};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
/* Count-aware card layout: presentation only. Keep nodes, handlers and source order intact. */
(()=>{'use strict';
if(/^\/noa-app\/(?:jukebox|taxonomy|database)(?:\/|$)/.test(location.pathname))return;
// Display titles are derived from explicit metadata or separated source title fields, never written back.
function presentTitle(original,meta={}){
 const raw=String(original||'').trim(),parts=raw.split(/\s*[|｜]\s*/).filter(Boolean);
 const ep=Number(meta.ep)>0?Number(meta.ep):Number(raw.match(/^\s*EP[.\s]*(\d+)\b/i)?.[1])||0;
 const supplied=typeof meta.displayTitle==='string'&&meta.displayTitle.trim()?meta.displayTitle.trim():typeof meta.songTitle==='string'?meta.songTitle.trim():'';
 const isEpisode=p=>/^EP[.\s]*\d+\s*$/i.test(p);
 const isCredit=p=>/^(?:AI\s*Artist\s*Noa|Cover\s+by\s+(?:AI)?Noa|Official\s+(?:MV|M\/V)|High\s+Quality\s+Audio|Original\s+Song|(?:K-POP|J-POP|POP|Thai)\s+Original\s+Song)(?:\b|\s*\()/i.test(p);
 let title=supplied||(parts.length>1?(parts.find(p=>!isEpisode(p)&&!isCredit(p))||raw):raw);
 title=title.replace(/^EP[.\s]*\d+\s*(?:[·:：—–-]\s*)?/i,'').trim()||raw;
 if(ep)title='EP.'+ep+' · '+title;
 return title||raw;
}
function movement(value){
 if(!value||typeof value!=='object')return null;
 const state=value.rankState,integer=v=>Number.isInteger(v)&&v>=1;
 if(!['up','down','same','new'].includes(state)||!integer(value.rank))return null;
 if(state==='new')return value.previousRank===null&&value.rankDelta===null?{state,delta:null}:null;
 if(!integer(value.previousRank)||!Number.isInteger(value.rankDelta))return null;
 if(value.previousRank-value.rank!==value.rankDelta)return null;
 if((state==='up'&&value.rankDelta<=0)||(state==='down'&&value.rankDelta>=0)||(state==='same'&&value.rankDelta!==0))return null;
 return{state,delta:state==='same'?null:Math.abs(value.rankDelta)};
}
const rankPaths={up:'M22 7l-8.5 8.5-5-5L2 17 M16 7h6v6',down:'M22 17l-8.5-8.5-5 5L2 7 M16 17h6v-6',same:'M5 12h14'};
function setMovement(card,value){
 const valid=movement(value),head=card.querySelector('.noa-card-heading');if(!head)return;
 let badge=head.querySelector('.noa-rank-badge');if(!valid){badge?.remove();return;}
 const key=valid.state+':'+valid.delta;if(badge?.dataset.value===key)return;
 badge?.remove();badge=document.createElement('span');badge.className='noa-rank-badge';badge.dataset.state=valid.state;badge.dataset.value=key;
 const labels={up:'순위 상승',down:'순위 하락',same:'순위 유지',new:'신규 진입'};
 badge.setAttribute('aria-label',labels[valid.state]+(valid.delta!==null?' '+valid.delta+'계단':''));
 if(valid.state==='new')badge.textContent='NEW';else{
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.7');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');const line=document.createElementNS(svg.namespaceURI,'path');line.setAttribute('d',rankPaths[valid.state]);svg.append(line);badge.append(svg);if(valid.delta!==null)badge.append(String(valid.delta));
 }head.append(badge);
}
function prepare(card,meta){
 const title=card.querySelector(':scope>.noa-card-heading>:is(strong,h2,h3),:scope>:is(strong,h2,h3),:scope>span>strong');if(!title)return;
 if(!title.closest('.noa-card-heading')){const heading=document.createElement('span');heading.className='noa-card-heading';title.before(heading);heading.append(title);}
 const raw=title.dataset.noaOriginalTitle||title.textContent.trim(),display=meta?presentTitle(raw,meta):title.dataset.noaDisplayTitle||presentTitle(raw,{ep:card.dataset.ep});
 title.dataset.noaDisplayTitle=display;
 title.dataset.noaOriginalTitle=raw;title.title=raw;if(title.textContent!==display)title.textContent=display;
 card.classList.add('noa-precision-card');
 if(meta&&Object.hasOwn(meta,'rankState'))setMovement(card,meta);
 else if(card.dataset.noaRankMovement){try{setMovement(card,JSON.parse(card.dataset.noaRankMovement));}catch{setMovement(card,null);}}
}
function plan(count,capacity,featured=true){
 const max=Math.max(1,Math.min(5,Math.floor(capacity))),n=Math.max(0,count);
 let columns=Math.min(n||1,max);
 if(n===10)columns=max>=5?5:Math.min(2,max);
 else if(n===9)columns=max>=3?3:Math.min(2,max);
 else if(n===8)columns=max>=4?4:Math.min(2,max);
 else if(n===7)columns=max>=4?4:Math.min(3,max);
 else if(n===5)columns=Math.min(3,max);
 else if(n===6)columns=max>=3?3:Math.min(2,max);
 else if(n===4)columns=Math.min(2,max);
 else if(n===3)columns=max>=3?3:1;
 if(!featured&&columns===2&&n>2&&n%2===1)columns=1;
 const hero=featured&&columns===2&&n>columns&&n%columns===1;
 const remaining=n-(hero?1:0),rows=[];
 if(remaining){
  if(!hero&&columns>1&&remaining>columns&&remaining%columns===1){
   const length=Math.ceil(remaining/columns),small=Math.floor(remaining/length),extra=remaining%length;
   for(let i=0;i<length;i++)rows.push(small+(i<extra?1:0));
  }else for(let left=remaining;left>0;left-=columns)rows.push(Math.min(columns,left));
 }
 return{columns,featured:hero,rows};
}
const specs=[
 ['.noa-card-grid','.noa-music-card',true,168,136,5],
 ['.world-mv-grid','.world-mv-card',true,216,216,4],
 ['.yt-grid','.yt-card',true,216,216,4],
 ['.noa-browse-grid','.noa-browse-card',false,164,136,5],
 ['.noa-genres','.noa-genre',false,164,136,5],
 ['.noa-world-grid','.noa-world-act',false,216,216,4],
 ['.noa-workspace','a',false,144,132,5],
 ['.noa-personal-grid','.noa-personal-card',false,144,132,4],
 ['.catalog-grid','.catalog-card',false,216,216,4],
 ['#youtube-playlists','p',false,180,136,4]
];
const hosts=new Map(),chromeObserved=new WeakSet();let pending=false;
function chromeSpace(){const nav=document.querySelector('.noa-mobile-nav');let navHeight=0;if(nav){if(!chromeObserved.has(nav)){resize.observe(nav);chromeObserved.add(nav);}if(getComputedStyle(nav).display!=='none')navHeight=nav.getBoundingClientRect().height;}style(document.documentElement,'--noa-nav-space',Math.ceil(navHeight)+'px');const player=document.querySelector('.noa-transport');let height=0;if(player){if(!chromeObserved.has(player)){resize.observe(player);chromeObserved.add(player);}if(!player.hidden&&getComputedStyle(player).display!=='none')height=player.getBoundingClientRect().height;}style(document.documentElement,'--noa-player-space',Math.ceil(height)+'px');}

function style(el,key,value){if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);}
function arrange(host,spec){
 const box=getComputedStyle(host),width=host.clientWidth-parseFloat(box.paddingLeft)-parseFloat(box.paddingRight);if(!width||host.hidden)return;
 const cards=[...host.children].filter(e=>e.matches(spec[1])&&!e.hidden&&getComputedStyle(e).display!=='none');
 if(!cards.length){host.classList.remove('noa-balanced');return;}
 const gap=width<=600?12:16,min=width<=600?spec[4]:spec[3];
 if(spec[2])cards.forEach(card=>prepare(card));
 const capacity=Math.min(spec[5],Math.max(1,Math.floor((width+gap)/(min+gap))));
 const layout=plan(cards.length,capacity,spec[2]),offset=host.id==='youtube-playlists'?1:0;
 host.classList.add('noa-balanced');host.dataset.noaColumns=String(layout.columns);host.dataset.noaRows=[...(layout.featured?[1]:[]),...layout.rows].join('+');
 style(host,'--noa-balance-columns',String(layout.columns*2));style(host,'--noa-grid-columns',String(layout.columns));style(host,'--noa-balance-gap',gap+'px');
 style(host,'--noa-card-width',((width-gap*(layout.columns-1))/layout.columns)+'px');
 let i=0,row=1+offset;
 for(const card of host.children)if(!cards.includes(card)&&card.classList.contains('noa-balanced-feature'))card.classList.remove('noa-balanced-feature');
 if(layout.featured){const card=cards[i++];card.classList.add('noa-balanced-feature');style(card,'grid-column','1 / span 4');style(card,'grid-row',String(row++));}
 for(const size of layout.rows){const start=1;for(let col=0;col<size;col++){
  const card=cards[i++];card.classList.remove('noa-balanced-feature');style(card,'grid-column',(start+col*2)+' / span 2');style(card,'grid-row',String(row));
 }row++;}
}
function scan(){pending=false;chromeSpace();for(const spec of specs)for(const host of document.querySelectorAll(spec[0])){
 if(!hosts.has(host)){hosts.set(host,spec);resize.observe(host);}arrange(host,spec);
 }for(const host of hosts.keys())if(!host.isConnected){resize.unobserve(host);hosts.delete(host);}}
function schedule(){if(!pending){pending=true;requestAnimationFrame(scan);}}
const resize=new ResizeObserver(schedule);
new MutationObserver(records=>{if(records.some(r=>r.type==='childList'||r.attributeName==='hidden'||r.attributeName==='style'&&r.target.style.display!==r.target.dataset.noaDisplay)){
 for(const r of records)if(r.attributeName==='style')r.target.dataset.noaDisplay=r.target.style.display;schedule();
}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style']});
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('noa-theme',schedule);
document.documentElement.dataset.noaPrecision='true';
window.NoaCardLayout={plan,presentTitle,movement,prepare,setMovement,refresh:schedule,debug(enabled){document.documentElement.toggleAttribute('data-noa-grid-debug',Boolean(enabled));}};schedule();
})();
/* Semi-Gloss Sculpted Glass: preserve action nodes, handlers, labels and permissions. */
(()=>{'use strict';
if(window.NoaGlass||/^\/noa-app\/(?:jukebox|taxonomy|database)(?:\/|$)/.test(location.pathname))return;
const selector='.noa-button.primary,button[type="submit"].noa-button,.btn_submit,#noa-settings-save,#lab-text-submit,.lab-actions .lab-icon-button:not([aria-label="작업 취소"]),a.noa-button[href*="lab-file.php"][href*="download=1"],.lab-editor-link[href*="download=1"],.noa-transport .controls button,.sound-play,.sound-upload,.jukebox-replace,.jukebox-download,.jukebox-busy,.jukebox-reserve,#my-new,#my-add,#my-save,#my-play,#act-play,.noa-workspace>a[href="/noa-library.php"],.noa-workspace>a[href="/noa-ai-lab.php"]';
const labels={previous:'이전',next:'다음',repeat:'반복',shuffle:'셔플','dock-more':'더보기'};
function labelFor(el){
 if(el.id==='pause-play')return el.getAttribute('aria-pressed')==='true'?'일시정지':'재생';
 if(labels[el.id])return labels[el.id];
 if(el.matches('.sound-play'))return '재생';if(el.matches('.jukebox-busy'))return el.disabled?'처리 중':'파일 변경';if(el.matches('.jukebox-replace'))return '교체';if(el.matches('.sound-upload'))return '업로드';
 if(el.matches('.jukebox-download'))return '다운로드';if(el.matches('.jukebox-busy'))return '처리 중';
 if(el.matches('.lab-icon-button')){const text=el.getAttribute('aria-label')||'';return text.includes('재시도')?'재시도':text.includes('성과')?'성과':text.includes('연결')?'연결':text.includes('승인')||text.includes('검토')?'승인':text;}
 return null;
}
function enhance(scope){
 const nodes=[...(scope.matches?.(selector)?[scope]:[]),...scope.querySelectorAll(selector)];
 for(const el of nodes){
  el.classList.add('noa-glass-control');
  const label=labelFor(el);if(label){const text=window.NoaUI?.translate(label)||label;if(el.dataset.noaGlassLabel!==text)el.dataset.noaGlassLabel=text;}
 }
}
let pending=false;const queued=new Set();
function refresh(scope=document.body){queued.add(scope);if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;for(const node of queued)if(node.isConnected)enhance(node);queued.clear();});}}
new MutationObserver(records=>{for(const r of records){if(r.type==='attributes'&&r.target.matches(selector))refresh(r.target);else if(r.type==='childList')for(const node of r.addedNodes)if(node.nodeType===1)refresh(node);}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['aria-pressed','aria-label','aria-expanded']});
// aria-disabled custom controls are inert without replacing their existing action callbacks.
function blockDisabled(e){if(e.type==='keydown'&&!['Enter',' '].includes(e.key))return;const el=e.target.closest?.('.noa-glass-control[aria-disabled="true"]');if(el){e.preventDefault();e.stopImmediatePropagation();}}
document.addEventListener('click',blockDisabled,true);document.addEventListener('keydown',blockDisabled,true);
window.addEventListener('noa-theme',()=>refresh());document.documentElement.dataset.noaGlass='true';
window.NoaGlass={refresh};refresh();
})();
/* Sound status is display-only. Existing upload/FIFO state and callbacks remain owned by Work_Music. */
(()=>{'use strict';if(!document.body.classList.contains('noa-sound-page'))return;
 const labels={audio_pending:'음원 파일 연결 필요',waiting:'전송 예약',reserved:'전송 예약',uploading:'업로드 중',queued:'최적화 대기',retrying:'최적화 대기',analyzing:'최적화 중',processing:'최적화 중',verifying:'최적화 중',ready:'재생 가능',failed:'재시도 필요'};
 const pending=new Set();let frame=false;
 function render(card){
  const raw=card.dataset.reservationState||card.dataset.jukeboxStatus||'audio_pending',ready=!!card.dataset.audio,known=Object.values(labels).includes(raw)?raw:labels[raw];
  const safe=['전송 일시정지','서버 응답 확인 중','자동 복구 중','파일 재선택 필요'].includes(raw)?raw:null;const state=raw==='ready'&&!ready?'음원 파일 연결 필요':known||safe||(ready?'재생 가능':'음원 파일 연결 필요');
  const text=ready&&['queued','retrying','analyzing','processing','verifying'].includes(raw)?'재생 가능 · 새 음원 최적화 중':state;
  const genre=window.NoaBrowse?.names[card.dataset.genre]||'';
  const node=card.querySelector('.song-select .info small');if(node){const next=[genre,text].filter(Boolean).join(' · ');if(node.textContent!==next)node.textContent=next;}
 }
 function schedule(card){if(!card)return;pending.add(card);if(frame)return;frame=true;requestAnimationFrame(()=>{frame=false;for(const card of pending)if(card.isConnected)render(card);pending.clear();});}
 const host=document.getElementById('songs');if(!host)return;
 new MutationObserver(records=>{for(const r of records)schedule(r.target.closest?.('.song'));}).observe(host,{subtree:true,childList:true,attributes:true,attributeFilter:['data-jukebox-status','data-reservation-state','data-audio']});
 for(const card of host.querySelectorAll('.song'))schedule(card);
 window.addEventListener('noa-theme',()=>{for(const card of host.querySelectorAll('.song'))schedule(card);});
})();
