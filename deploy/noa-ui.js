/* Shared web/GnuBoard UI. Source song text and legacy preferences are never rewritten. */
(()=>{'use strict';
if(window.NoaUI)return;const root=document.documentElement;const themeOnly=!!document.currentScript?.hasAttribute('data-noa-theme-only');if(themeOnly)root.dataset.noaThemeOnly='true';const g5=/^\/(bbs|adm)\//.test(location.pathname),admin=/^\/adm\//.test(location.pathname);if(g5)root.classList.add(admin?'noa-admin':'noa-g5');
const icons={home:'M12 3c1.2 5.4 3.6 7.8 9 9-5.4 1.2-7.8 3.6-9 9-1.2-5.4-3.6-7.8-9-9 5.4-1.2 7.8-3.6 9-9Z',music:'M9 18V5l12-2v13 M9 8l12-2 M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M18 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6',playlists:'M4 6h16 M4 11h12 M4 16h8 M17 14l5 3-5 3z',world:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c4 5 4 13 0 18-4-5-4-13 0-18',community:'M21 11a8 8 0 0 1-8 8H5l-3 3V11a9 9 0 0 1 19 0',library:'M4 3h4v18H4z M12 3h4v18h-4z M20 4l3 16',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z'};
icons.user='M20 21v-2a6 6 0 0 0-12 0v2 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0';icons.book='M12 5C8 2 4 3 2 4v16c4-2 7-1 10 1 3-2 6-3 10-1V4c-2-1-6-2-10 1z M12 5v16';icons.disc='M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0';icons.mail='M3 5h18v14H3z M3 5l9 8 9-8';icons.mic='M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0z M5 10v1a7 7 0 0 0 14 0v-1 M12 18v4 M8 22h8';
icons.search='M21 21l-4.35-4.35 M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0';icons.edit='M16 3l5 5 M4 20l4-1L21 6l-4-4L4 15z';icons.trash='M3 6h18 M8 6V4h8v2 M5 6l1 15h12l1-15 M10 10v7 M14 10v7';icons.more='M5 12h.01 M12 12h.01 M19 12h.01';
icons.download='M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4';
icons.play='m8 5 11 7-11 7V5Z';
icons.login='M14 3h7v18h-7 M3 12h12 M9 6l6 6-6 6';
icons.sitemap='M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4';icons.notice='M4 9h4l12-5v16l-12-5H4z M8 15l2 6h4l-2-5';
icons.shop='M4 8h16l1 13H3L4 8Z M8 8V6a4 4 0 0 1 8 0v2';
icons.youtube='M3 5h18v14H3z M10 9l6 3-6 3z';
let access={home:true,member:false,music:false,admin:false};try{access=JSON.parse(document.getElementById('noa-access')?.textContent||'null')||access;}catch{}
function menu(){return [['youtube','유튜브','/noa-youtube.php'],['music','음원','/noa-music.php'],['home','홈','/'],['community','커뮤니티','/noa-lounge.php'],['shop','SHOP','/noa-shop.php']];}
function sectionFor(path){
 if(/^\/noa-(?:youtube|world)[.]php$/.test(path))return 'youtube';
 if(/^\/noa-(?:music|catalog|my)[.]php$/.test(path))return 'music';
 if(/^\/noa-(?:lounge|community|creator-lab)[.]php$/.test(path)||/^\/bbs\/(?:board|write|new|search)[.]php$/.test(path))return 'community';
 if(/^\/noa-(?:shop|vip|points|membership)[.]php$/.test(path)||/^\/(?:mobile\/)?shop\//.test(path))return 'shop';
 return ['/','/index.php'].includes(path)?'home':'';
}
function sectionNavigation(){
 const section=sectionFor(location.pathname);root.dataset.noaArea=section||'account';
 if(!section||section==='home'||/^\/(?:mobile\/)?shop\//.test(location.pathname))return;
 const host=document.querySelector('main')||document.querySelector('#container');if(!host||document.getElementById('noa-section-navigation'))return;
 const routes={youtube:[['영상','/noa-youtube.php'],['세계관 · MV','/noa-world.php'],['음원 듣기','/noa-music.php']],music:[['음원','/noa-music.php'],['나의 재생목록','/noa-my.php'],['사연곡 신청','/noa-lounge.php?category=story&view=list#ec-content'],['음악 이야기','/noa-lounge.php?category=music']],community:[['별무리 라운지','/noa-lounge.php'],['CREATOR LAB','/noa-creator-lab.php']],shop:[['굿즈','/noa-shop.php'],['VIP 이용권','/noa-vip.php'],['포인트 충전','/noa-points.php'],['보관한 상품','/noa-shop.php?view=cart']]};
 const nav=document.createElement('nav');nav.id='noa-section-navigation';nav.className='noa-section-navigation';nav.setAttribute('aria-label',tr(menu().find(x=>x[0]===section)[1])+' 관련 메뉴');
 for(const [label,href]of routes[section]){const a=document.createElement('a');a.href=href;a.textContent=label;const u=new URL(href,location.origin);if(u.pathname===location.pathname&&u.search===location.search&&u.hash===location.hash)a.setAttribute('aria-current','page');nav.append(a);}host.prepend(nav);
}
let drawerMember=null;
function refreshNavigation(){document.querySelectorAll('.noa-primary-nav,.noa-mobile-nav').forEach(nav=>{const items=nav.matches('.noa-mobile-nav')?menu():[...menu().filter(x=>x[0]==='home'),...menu().filter(x=>x[0]!=='home')];nav.replaceChildren(...items.map(item=>navItem(item)));});document.getElementById('noa-drawer-search')?.dispatchEvent(new Event('input'));}
window.addEventListener('noa-membership-status',event=>{const logged=!!event.detail?.member;drawerMember=logged?{balance:event.detail.balance,rank:event.detail.name,admin:event.detail.admin}:null;if(access.member!==logged){access.member=logged;if(!logged)access.music=false;refreshNavigation();}});
const words=Object.create(null);
const interfaceWords=Object.create(null),bindings=new WeakMap();
const protectedUi='script,style,noscript,svg,code,pre,textarea,[contenteditable]:not([contenteditable=false]),[translate=no],.notranslate,#noa-header-clock,.noa-card-heading,.noa-hero-pick strong,.catalog-card h3,.noa-notice-summary strong,.noa-notice-excerpt,.noa-notice-body p,.noa-feed-row strong,.noa-feed-row small,#bo_v_con,.bo_v_con,.bo_vc_w,.sv_member,.member,.sound-title,.song-title,#lyrics,.lyrics,[data-song-title],[data-user-content]';
const patterns=[
 [/^(.+) 추천 음악$/,'{0} 추천 음악'],[/^(.+) 음악 만나기$/,'{0} 음악 만나기'],[/^지금은 (.+)$/,'지금은 {0}'],[/^자동 테마 · 현재 (.+)$/,'자동 테마 · 현재 {0}'],[/^인기 점수 ([+\d.,KM]+)$/,'인기 점수 {0}'],[/^음원 ([\d.,KM]+)$/,'음원 {0}'],[/^인기 ([\d.,KM]+)점$/,'인기 {0}점'],[/^최근 조회수 ([+\d.,KM]+)$/,'최근 조회수 {0}'],[/^([\d.\s]+) 공개$/,'{0} 공개'],[/^(.+) 페이지$/,'{0} 페이지']
];
function uiPhrase(s){
 if(language==='ko'||!/[가-힣]/.test(s))return s;
 const exact=interfaceWords[s]?.[langIndex[language]];if(exact)return exact;
 for(const [re,key] of patterns){const m=s.match(re),template=interfaceWords[key]?.[langIndex[language]];if(m&&template)return template.replace('{0}',uiPhrase(m[1]));}
 const separated=s.split(/(\s*·\s*|\s*[↗→]\s*|\s+\d[\d,]*P\b)/);if(separated.length>1)return separated.map((part,i)=>i%2?part:uiPhrase(part)).join('');
 return s;
}
function bindUi(node,slot,current,write){
 if(!current)return;let slots=bindings.get(node),old=slots?.[slot],source=old&&current===old.output?old.source:current;
 const trimmed=source.trim(),phrase=uiPhrase(trimmed),next=phrase===trimmed?source:source.replace(trimmed,()=>phrase);
 if(next!==current){if(!slots)bindings.set(node,slots=Object.create(null));slots[slot]={source,output:next};write(next);}else if(old&&current!==old.output)delete slots[slot];
}
function renderUi(scope){
 if(!scope||!catalogReady||admin)return;
 const element=scope.nodeType===1?scope:scope.parentElement;if(!element||element.closest(protectedUi))return;
 function visit(n){
  if(n.nodeType===3){bindUi(n,'text',n.nodeValue,v=>{if(n.parentElement?.matches('option:not([value])'))n.parentElement.value=n.parentElement.value;n.nodeValue=v;});return;}
  if(n.nodeType!==1||n.matches(protectedUi))return;
  for(const key of ['aria-label','placeholder','title','alt'])if(n.hasAttribute(key))bindUi(n,key,n.getAttribute(key),v=>n.setAttribute(key,v));
  for(let c=n.firstChild;c;c=c.nextSibling)visit(c);
 }
 visit(scope);
}
let catalogReady=false;const langIndex={en:0,ja:1,th:2};let config=null,state=null,revision=0,remote=null,dirty=false;
const themeStorageKey='noa-ui-selection-v2';
const safeRead=k=>{try{return localStorage.getItem(k)}catch{return null}};const safeWrite=(k,v)=>{try{localStorage.setItem(k,v)}catch{}};
let language=safeRead('noa-view-lang')||'ko';if(!['ko','ja','en','th'].includes(language))language='ko';
function tr(text){return language==='ko'?text:words[text]?.[langIndex[language]]||text}
function updateLabel(el){if(el.children.length)return;const current=el.textContent.trim();const original=words[current]?current:el.dataset.noaOriginal;if(!original||!words[original])return;if(current!==original&&!words[original].includes(current))return;el.dataset.noaOriginal=original;const translated=tr(original);if(el.textContent!==translated)el.textContent=translated;}
function translateFixedNodes(){document.querySelectorAll('#mb_login h2,#mb_login h3,#mb_login a,#login_fs label,#login_info label,#register_form label,#register_form th,#bo_w label,.tbl_head01 thead th,.btn_bo_user a,.bo_v_com a').forEach(el=>{for(const node of el.childNodes){if(node.nodeType!==Node.TEXT_NODE)continue;const text=node.nodeValue.trim();let original=words[text]?text:node.noaOriginal;if(!original||!words[original]||text!==original&&!words[original].includes(text))continue;node.noaOriginal=original;const translated=node.nodeValue.replace(text,tr(original));if(translated!==node.nodeValue)node.nodeValue=translated;}});}
function markMetadata(){const names=window.NoaBrowse?.names;if(!names)return;for(const node of document.querySelectorAll('.catalog-card small,.catalog-meta,.noa-eyebrow,.noa-card-context')){if(node.children.length)continue;let text=node.textContent;for(const [key,label]of Object.entries(names))text=text.replaceAll(key,label);text=text.replace(/\b(?:unclassified|unknown)\b/g,'음악');if(text!==node.textContent)node.textContent=text;}}
function markLabels(){if(themeOnly)return;decorate();markMetadata();translateFixedNodes();document.querySelectorAll('[data-noa-i18n]').forEach(el=>{const text=tr(el.dataset.noaI18n);if(el.textContent!==text)el.textContent=text});document.querySelectorAll('.controls button,#pause-play,#my-playlists h2,#lyrics-label,#player-status,#noa-settings-status,#act-play,#install,#genre option,#type option,#my-select option[value=""],#login_fs label,#login_info a,#login_info label,.noa-page main>p,.noa-footer a').forEach(updateLabel);document.querySelectorAll('#search,#my-title,#mb_login input[placeholder],#register_form input[placeholder]').forEach(el=>{const value=el.dataset.noaPlaceholder||el.getAttribute('placeholder');if(words[value]){el.dataset.noaPlaceholder=value;const next=tr(value);if(el.placeholder!==next)el.placeholder=next}});root.lang=language;}

function icon(key){return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'+icons[key]+'"/></svg>'}
function actionIcon(el){const href=el.getAttribute('href')||'',text=el.textContent.trim();return /사이트맵|전체 서비스|noa-sitemap/.test(text+' '+href)?'sitemap':/공지/.test(text)?'notice':/삭제/.test(text)?'trash':/검색/.test(text)?'search':/글쓰기|작성|수정/.test(text)?'edit':/옵션/.test(text)?'more':/다운로드|설치 파일|받기/.test(text)?'download':/캐릭터|회원|계정|로그인|로그아웃/.test(text)?'user':/설명|정보|세계관/.test(text)?'book':/커뮤니티|소식/.test(text)?'community':/youtube|영상|MV/.test(text+' '+href)?'youtube':/관리|설정/.test(text)?'settings':/곡|suno|재생|제작|생성/.test(text+' '+href)?'music':'library';}
// Action footers, forms and storefront controls may render after the page shell.
const actionScopes=[
 '#ecosystem .ec-actions button','#ecosystem .ec-shop-secondary button','#ecosystem .ec-buy',
 '.ec-dialog form button','.noa-gifts button','.noa-membership-layout form button',
 '.noa-points-page button[data-add]','.noa-point-packs button','.noa-point-checkout button[type=submit]',
 '.noa-login-form button','.noa-g5 .btn_confirm button','.noa-g5 #bo_sch button',
 '.noa-page button.noa-button','.lp-view-switch button'
].join(',');
function markAction(el){
 const name=el.textContent.trim();
 if(!name||/^[+−–0-9]+$/.test(name))return;
 el.classList.add('noa-labelled-command');
 if(el.querySelector('svg,img,i')||el.hasAttribute('data-noa-glass-label'))return;
 const key=/카트|구매|결제|충전/.test(name)?'shop':/앨범/.test(name)?'disc':/목록|담기/.test(name)?'playlists':
  /보내|선물|발송/.test(name)?'mail':/저장|변경|신청|작성|등록/.test(name)?'edit':actionIcon(el);
 el.insertAdjacentHTML('afterbegin',icon(key));
}
function watchActions(){
 const scan=node=>{
  if(node.nodeType!==1)return;
  if(node.matches(actionScopes))markAction(node);
  node.querySelectorAll(actionScopes).forEach(markAction);
 };
 scan(document.body);
 new MutationObserver(changes=>{
  for(const change of changes){
   if(change.target.matches?.(actionScopes))markAction(change.target);
   for(const node of change.addedNodes)scan(node);
  }
 }).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',watchActions);else watchActions();
function decorate(){
 if(document.querySelector('[data-world-editorial]'))return;
 for(const el of document.querySelectorAll('#my-recent a,#my-recent-youtube a'))if(!el.querySelector('svg'))el.dataset.noaIcon=el.closest('#my-recent-youtube')?'youtube':'play';
 // Existing nodes/URLs/listeners are retained. Exclude card links, document-body citations and native navigation.
 for(const el of document.querySelectorAll('main a,main summary,main button:is(.noa-button.primary,#my-new,#my-add,#my-save,#my-play,#act-play,#lab-text-submit,#noa-settings-save),.noa-g5 .btn_bo_user a,.noa-g5 .btn_bo_user button,.noa-g5 .btn_confirm a,.noa-g5 .btn_confirm button,.noa-g5 .bo_v_nb a,.noa-g5 .bo_v_com a')){
  if(el.matches('.nl-music-discovery>summary,[data-noa-icon],.noa-action,.noa-logo,.brand,.noa-music-card,.noa-genre,.noa-world-act,.noa-personal-card,.noa-browse-card,.catalog-card,.noa-feed-row')||el.closest('nav,footer,.noa-world-text,[data-noa-document-link],#bo_list table,#bo_list .bo_list,#bo_list .bo_tit,#bo_list .td_subject,#bo_v_con,#bo_vc article')||el.querySelector('img,svg')||!el.textContent.trim())continue;
  el.dataset.noaIcon=actionIcon(el);
 }
 if(document.querySelector('.lab-tabs'))for(const a of document.querySelectorAll('.lab-tabs a')){const keys={'#lab-text':'settings','#lab-create':'music','#lab-jobs':'library','#lab-growth':'youtube'};if(keys[a.getAttribute('href')])a.dataset.noaIcon=keys[a.getAttribute('href')];}
 document.querySelectorAll('[data-noa-icon]').forEach(el=>{if(el.querySelector('svg')||!icons[el.dataset.noaIcon])return;const label=document.createElement('span');while(el.firstChild)label.append(el.firstChild);if(el.closest('.btn_bo_user,.btn_confirm,.bo_v_nb,.bo_v_com')&&root.classList.contains('noa-g5')){const name=el.getAttribute('aria-label')||el.title||label.textContent.trim();el.setAttribute('aria-label',name);label.textContent=({'게시판 검색':'검색','게시판 리스트 옵션':'옵션'})[name]||name;}if(el.dataset.noaI18n){label.dataset.noaI18n=el.dataset.noaI18n;delete el.dataset.noaI18n;}el.insertAdjacentHTML('afterbegin',icon(el.dataset.noaIcon));el.append(label);el.classList.add('noa-action');});
 // Explicit section chrome only: song controls and JUKEBOX DOM are never rewritten.
 if(location.pathname==='/noa-music.php')return;
 document.querySelectorAll('main>h1,.lab-heading h1,.lab-panel>h2,.lab-section>h2,.noa-section h2,.noa-section-head h2,.noa-world-prose>h2,.noa-world-heading>h2,#youtube-playlists>h2').forEach(el=>{if(el.dataset.noaHeading)return;el.dataset.noaHeading='true';const text=el.textContent;let key=/공지/.test(text)?'notice':/사이트맵|전체 서비스/.test(text)?'sitemap':/NOA WORLD|세계관|프롤로그|에필로그|챕터/.test(text)?'book':/사연|당신의 이야기/.test(text)?'mail':/커버/.test(text)?'mic':/EP|컬렉션/.test(text)?'disc':/목록|플레이리스트|보관함/.test(text)?'playlists':/MY|최근|계정/.test(text)?'user':/관리|작업실|설정/.test(text)?'settings':'music';const label=document.createElement('span');while(el.firstChild)label.append(el.firstChild);if(el.dataset.noaI18n){label.dataset.noaI18n=el.dataset.noaI18n;delete el.dataset.noaI18n;}el.insertAdjacentHTML('afterbegin',icon(key));el.append(label);});
}
function navItem(item,drawer=false){const a=document.createElement('a');a.href=item[2];a.dataset.noaNav=item[0];a.setAttribute('aria-label',tr(item[1]));const need=['music','youtube','world'].includes(item[0])?'member':null;if(need&&!access[need]){a.removeAttribute('href');a.tabIndex=0;a.setAttribute('role','button');a.setAttribute('aria-disabled','true');a.dataset.noaCondition=need==='music'?'음원은 이용 기간이 남은 VIP회원·VIP 크리에이터가 들을 수 있어요. MY에서 이용권과 잔여 기간을 확인해 주세요.':'로그인한 회원에게 열리는 메뉴예요. 로그인 후 다시 만나 주세요.';}if(item[0]==='settings'&&location.pathname!=='/noa-settings.php')a.onclick=e=>{e.preventDefault();openSettings();};a.innerHTML=icon(item[0]);const t=document.createElement('span');t.dataset.noaI18n=item[1];t.textContent=tr(item[1]);a.append(t);const target=new URL(item[2],location.origin);const active=drawer&&location.pathname==='/noa-world.php'?'world':sectionFor(location.pathname);if(item[0]==='user'||item[0]==='login')a.dataset.noaAccountNav=item[0];if(item[0]===active)a.setAttribute('aria-current','page');return a;}
function shell(){if(themeOnly||admin||document.querySelector('.noa-sidebar'))return;const side=document.createElement('dialog');side.id='noa-menu-drawer';side.className='noa-sidebar noa-menu-drawer';side.setAttribute('aria-label','전체 메뉴');side.innerHTML='<a href="/" class="noa-logo" aria-label="NOA STUDIO 홈"><img class="noa-brand-mark" src="/noa-assets/papa-logo.png" alt="" width="48" height="48"><span class="noa-brand-copy">NOA STUDIO<small>AI ARTIST NOA</small></span></a>';const nav=document.createElement('nav');nav.className='noa-menu';nav.setAttribute('aria-label','NOA STUDIO');side.append(nav);const bottom=document.createElement('footer');bottom.className='noa-sidebar-bottom';bottom.setAttribute('aria-label','스튜디오 안내');bottom.innerHTML='<div class="noa-sidebar-signature"><strong>NOA STUDIO</strong><span>Music. Stories. Starlight.</span></div><nav class="noa-sidebar-legal" aria-label="회사 및 이용 안내"><a href="/noa-about.php">회사소개</a><a href="/noa-world.php" class="noa-footer-world">세계관</a><a href="/noa-terms.php" aria-label="이용약관">약관</a><a href="/noa-privacy.php" aria-label="개인정보처리방침">이용방침</a></nav><section class="noa-sidebar-visitors" aria-label="방문자 집계"><p>방문자</p><dl><div><dt>오늘</dt><dd data-visit="today">—</dd></div><div><dt>어제</dt><dd data-visit="yesterday">—</dd></div><div><dt>전체</dt><dd data-visit="total">—</dd></div></dl></section>';let counts=null;try{counts=JSON.parse(document.getElementById('noa-visitor-counts')?.textContent||'null');}catch{}bottom.querySelectorAll('[data-visit]').forEach(el=>{const value=counts?.[el.dataset.visit];if(/^\d+$/.test(String(value)))el.textContent=BigInt(value).toLocaleString('ko-KR');else el.setAttribute('aria-label','집계 정보 없음');});root.classList.add('noa-has-sidebar','noa-shell-wide');side.append(bottom);document.body.prepend(side);const mobile=document.createElement('nav');mobile.className='noa-mobile-nav';mobile.setAttribute('aria-label','NOA STUDIO mobile');menu().forEach(item=>mobile.append(navItem(item)));document.body.append(mobile);if(g5){const top=document.createElement('header');top.className='noa-g5-top';top.innerHTML='<a class="noa-logo" href="/">NOA STUDIO</a><a data-noa-login href="/bbs/login.php">'+tr('로그인')+'</a>';document.body.insertBefore(top,side.nextSibling);const footer=document.createElement('footer');footer.className='noa-footer';footer.innerHTML='<span>NOA STUDIO · Music. Stories. Starlight.</span><a href="/bbs/content.php?co_id=privacy" data-noa-i18n="개인정보처리방침">개인정보처리방침</a><a href="/bbs/content.php?co_id=provision" data-noa-i18n="이용약관">이용약관</a>';document.body.append(footer);}const mobileFooter=bottom.cloneNode(true);
 mobileFooter.classList.add('noa-mobile-footer');
 bottom.querySelector('.noa-sidebar-legal').remove();
 const visitorPanel=bottom.querySelector('.noa-sidebar-visitors');
 visitorPanel.querySelector('p').textContent='방문자 별자리';
 visitorPanel.setAttribute('aria-label','방문자 별자리');
 if(sectionFor(location.pathname)==='home'||document.getElementById('noa-home-action-layout')){
  mobileFooter.querySelector('.noa-sidebar-visitors').remove();
  mobileFooter.classList.add('noa-home-footer');
 }
 const signature=mobileFooter.querySelector('.noa-sidebar-signature');
 const landscape=document.createElement('img');landscape.className='noa-footer-landscape';landscape.alt='';landscape.width=640;landscape.height=160;
 const appearance=document.createElement('div');appearance.className='noa-footer-themes';appearance.setAttribute('role','group');appearance.setAttribute('aria-label','테마 선택');
 for(const [choice,label] of [['auto','자동'],['noa-ivory','라이트'],['noa-studio','다크']]){
  const pick=document.createElement('button');pick.type='button';pick.dataset.footerTheme=choice;pick.textContent=label;
  pick.disabled=!config;pick.onclick=()=>{
   if(!state)return;
   dirty=true;safeWrite('noa-device-theme',choice);apply({...state,theme:choice});settings();
  };appearance.append(pick);
 }
 const heading=document.createElement('div');heading.className='noa-footer-heading';
 const scene=document.createElement('div');scene.className='noa-footer-scene';
 heading.append(signature,appearance);scene.append(landscape,mobileFooter.querySelector('.noa-sidebar-legal'));
 mobileFooter.prepend(heading,scene);
 const oldFooter=document.querySelector('.noa-footer,.ne-footer');if(oldFooter)oldFooter.before(mobileFooter);else if(document.querySelector('main'))document.querySelector('main').after(mobileFooter);else document.body.append(mobileFooter);wideShell(side);window.NoaBrand?.apply();markLabels();}

/* Use one menu for both a wide navigation rail and a compact modal. */
function wideShell(side){
 const head=document.createElement('header');head.className='noa-drawer-head';head.append(side.querySelector('.noa-logo'));
 const close=document.createElement('button');close.type='button';close.className='noa-drawer-close';close.setAttribute('aria-label','전체 메뉴 닫기');close.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 6 12 12M18 6 6 18"/></svg>';close.onclick=()=>dismiss();head.append(close);side.prepend(head);
 const profile=document.createElement('section');profile.className='noa-drawer-profile';profile.setAttribute('aria-label','내 계정');
 const guest=document.createElement('div');guest.className='noa-drawer-guest';
 guest.innerHTML='<div class="noa-drawer-greeting"><small>MY STUDIO</small><strong>별무리, 반가워요!</strong></div><div class="noa-drawer-stage"><img src="/noa-assets/drawer-studio-session.jpg" alt="녹음실 마이크 앞의 노아" width="1536" height="861" loading="lazy" decoding="async"></div><div class="noa-drawer-guest-actions"><button type="button" aria-expanded="false" aria-controls="noa-drawer-signin">'+icon('login')+'<span>로그인</span></button><a href="/noa-login.php#noa-login" title="소셜 계정으로 회원가입">'+icon('user')+'<span>회원가입</span></a></div>';
 const login=document.createElement('form');login.id='noa-drawer-signin';login.className='noa-drawer-login';login.action='/bbs/login_check.php';login.method='post';login.hidden=true;
 login.innerHTML='<input type="hidden" name="url" value="/"><label class="noa-sr-only" for="noa-drawer-login-id">아이디 또는 이메일</label><input id="noa-drawer-login-id" name="mb_id" autocomplete="username" autocapitalize="none" maxlength="254" placeholder="아이디 또는 이메일" required><label class="noa-sr-only" for="noa-drawer-login-pw">비밀번호</label><input id="noa-drawer-login-pw" name="mb_password" type="password" autocomplete="current-password" placeholder="비밀번호" required><button type="submit" class="noa-button">로그인</button><a href="/noa-login.php">다른 방법으로 로그인</a>';
 const signIn=guest.querySelector('button');
 signIn.onclick=()=>{login.hidden=!login.hidden;signIn.setAttribute('aria-expanded',String(!login.hidden));if(!login.hidden)login.elements.mb_id.focus();else login.reset();};
 guest.append(login);
 const memberBox=document.createElement('div');memberBox.className='noa-drawer-member';
 memberBox.innerHTML='<div class="noa-drawer-id"><span class="noa-drawer-avatar" aria-hidden="true"></span><div><small>MY STUDIO</small><strong translate="no"></strong><span class="noa-drawer-rank"></span></div></div><div class="noa-drawer-links"></div>';
 const grid=memberBox.querySelector('.noa-drawer-links');
 for(const [key,label,href,mark] of [
  ['edit','정보 수정','/bbs/member_confirm.php?url=register_form.php','edit'],
  ['my','MY 스튜디오 열기','/noa-my.php','user'],
  ['points','포인트','/noa-membership.php#points','disc'],
  ['memo','쪽지','/bbs/memo.php','mail'],
  ['scrap','스크랩','/bbs/scrap.php','book'],
  ['logout','로그아웃','/bbs/logout.php?url=%2F','login'],
  ['admin','관리자','/noa-library.php','settings']
 ]){
  const link=document.createElement('a');link.dataset.drawerAction=key;link.href=href;link.innerHTML=icon(mark);
  const text=document.createElement('span');text.textContent=label;link.append(text);
  if(key==='my')link.className='noa-drawer-my';
  if(key==='points'){const value=document.createElement('b');link.append(value);}
  grid.append(link);
 }
 const identity=memberBox.querySelector('strong'),rank=memberBox.querySelector('.noa-drawer-rank'),avatar=memberBox.querySelector('.noa-drawer-avatar');
 const updateAccount=()=>{
  const member=!!access.member;
  guest.hidden=member;memberBox.hidden=!member;
  if(!member)return;
  if(!login.hidden){login.reset();login.hidden=true;signIn.setAttribute('aria-expanded','false');}
  const name=remote?.member&&remote.displayName;
  identity.textContent=name||'나의 계정';avatar.textContent=name?Array.from(name)[0]:'MY';
  rank.textContent=drawerMember?.rank||access.name||'회원';
  const points=grid.querySelector('[data-drawer-action=points] b');
  points.textContent=Number.isSafeInteger(drawerMember?.balance)?drawerMember.balance.toLocaleString('ko-KR')+'P':'';
  grid.querySelector('[data-drawer-action=admin]').hidden=!(drawerMember?.admin??access.admin);
 };
 profile.append(guest,memberBox);updateAccount();head.after(profile);
 window.addEventListener('noa-membership-status',updateAccount);window.addEventListener('noa-drawer-identity',updateAccount);
 const searchBox=document.createElement('form');searchBox.className='noa-drawer-search';searchBox.setAttribute('role','search');searchBox.setAttribute('aria-label','메뉴 찾기');
 searchBox.innerHTML='<label class="noa-sr-only" for="noa-drawer-search">메뉴 찾기</label><input id="noa-drawer-search" type="search" placeholder="메뉴 찾기" autocomplete="off"><button type="submit" aria-label="검색">'+icon('search')+'</button>';profile.after(searchBox);
 const nav=side.querySelector('.noa-menu');
 const mapLink=document.createElement('a');mapLink.className='noa-drawer-map-link';mapLink.href='/noa-sitemap.php';mapLink.textContent='사이트맵 열기';
 const mapHead=document.createElement('div');mapHead.className='noa-drawer-map-head';
 const title=document.createElement('h2');title.textContent='전체 서비스';mapHead.append(title,mapLink);nav.append(mapHead);
 const index=document.createElement('select');index.className='noa-drawer-index';index.setAttribute('aria-label','분류 바로가기');index.hidden=true;nav.append(index);
 const sections=document.createElement('div');sections.className='noa-drawer-groups';nav.append(sections);
 const empty=document.createElement('p');empty.className='noa-menu-empty';empty.setAttribute('role','status');empty.hidden=true;nav.after(empty);
 index.onchange=()=>{
  const heading=sections.children[index.selectedIndex-1]?.querySelector('h3');if(!heading)return;
  heading.focus({preventScroll:true});heading.scrollIntoView({block:'start',behavior:'instant'});index.selectedIndex=0;
 };
 const search=searchBox.querySelector('input');let loaded=false,request=null;
 function filterMenu(){
  const q=search.value.trim().toLocaleLowerCase();let found=false;
  for(const group of sections.children){
   const wholeGroup=group.firstElementChild.textContent.toLocaleLowerCase().includes(q);let match=false;
   for(const link of group.querySelectorAll('a')){
    const visible=wholeGroup||(link.textContent+' '+link.dataset.search).toLocaleLowerCase().includes(q);
    link.hidden=!visible;if(visible)match=true;
   }
   group.hidden=!match;if(match)found=true;
  }
  index.hidden=!!q||!loaded;
  if(loaded){empty.textContent='일치하는 메뉴가 없어요.';empty.hidden=found;}
 }
 const categoryIcons={
  'map-explore':'home','map-collections':'disc','map-world':'world','map-account':'user','map-community':'community',
  'map-creatorTools':'mic','map-company':'book','map-legal':'library','map-admin':'settings',
  'map-admin-content':'library','map-admin-creation':'mic','map-admin-operation':'settings','map-admin-advanced':'sitemap'
 };
 function drawMap(source){
  const groups=document.createDocumentFragment(),jumps=document.createDocumentFragment();
  for(const section of source.querySelectorAll('main .noa-site-map')){
   const heading=section.querySelector('h2'),items=section.querySelectorAll('.noa-site-map-link[data-noa-route]');
   if(!heading||!items.length)continue;
   const group=document.createElement('section');group.className='noa-drawer-category';group.dataset.mapGroup=heading.id;
   const h=document.createElement('h3');h.textContent=tr(heading.textContent.trim());h.tabIndex=-1;group.append(h);
   const jump=document.createElement('option');jump.textContent=h.textContent;jumps.append(jump);
   h.insertAdjacentHTML('afterbegin',icon(categoryIcons[heading.id]||'sitemap'));
   const count=document.createElement('span');count.className='noa-drawer-route-count';count.textContent=String(items.length);h.append(count);
   const list=document.createElement('div');list.className='noa-drawer-secondary';
   for(const item of items){
    const key=item.dataset.noaRoute,label=item.querySelector('strong').textContent.trim(),reason=item.dataset.noaCondition;
    const link=document.createElement('a');link.dataset.drawerRoute=key;
    if(['home','youtube','world','music','lounge','shop'].includes(key))link.dataset.noaNav=key==='lounge'?'community':key;
    link.textContent=tr(({world:'NOA WORLD · 세계관',music:'음원',youtube:'유튜브'})[key]||label);
    link.dataset.search=label+' '+(item.querySelector('small')?.textContent||'');
    const href=item.getAttribute('href');
    if(reason||!href||!href.startsWith('/')||href.startsWith('//')){
     link.setAttribute('role','button');link.tabIndex=0;link.setAttribute('aria-disabled','true');link.dataset.noaCondition=reason||'지금은 열 수 없는 메뉴예요.';
    }else{link.href=href;if(href===location.pathname+location.search+location.hash)link.setAttribute('aria-current','page');}
    list.append(link);
   }
   group.append(list);groups.append(group);
  }
  if(!groups.childElementCount)throw Error('empty sitemap');
  const first=document.createElement('option');first.textContent='분류 바로가기 · '+groups.childElementCount+'개';first.value='';
  sections.replaceChildren(groups);index.replaceChildren(first,jumps);loaded=true;filterMenu();
 }
 async function loadMap(){
  if(loaded||request)return;
  const controller=new AbortController();request=controller;
  empty.textContent='전체 메뉴를 불러오는 중이에요.';empty.hidden=false;
  try{
   const response=await fetch('/noa-sitemap.php',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(!response.ok)throw Error('sitemap unavailable');
   const markup=await response.text();if(request!==controller)return;
   // A detached template keeps scripts and assets inert. Only route text and local links enter the drawer.
   const template=document.createElement('template');template.innerHTML=markup;drawMap(template.content);
  }catch{if(request===controller){empty.textContent='메뉴를 불러오지 못했어요. 사이트맵에서 전체 목록을 볼 수 있어요.';empty.hidden=false;}}
  finally{if(request===controller)request=null;}
 }
 function resetMap(){request?.abort();request=null;loaded=false;sections.replaceChildren();index.replaceChildren();index.hidden=true;if(side.open)loadMap();}
 let mapRole=[!!access.member,access.level,!!access.admin].join('/');
 window.addEventListener('noa-membership-status',event=>{const d=event.detail||{},role=[!!d.member,d.level??access.level,!!d.admin].join('/');if(role!==mapRole){mapRole=role;resetMap();}});
 window.addEventListener('pageshow',event=>{if(event.persisted)resetMap();});
 search.addEventListener('input',filterMenu);
 searchBox.onsubmit=e=>{e.preventDefault();if(!loaded){loadMap();return;}filterMenu();const match=search.value.trim()&&sections.querySelector('section:not([hidden]) a:not([hidden])');(match||search).focus();};
 let trigger;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const wide=matchMedia('(min-width:1200px) and (min-height:640px) and (min-aspect-ratio:4/3)');
 const isWide=()=>wide.matches&&!root.hasAttribute('data-noa-shell-child')&&window.frameElement?.id!=='noa-shell-view';
 function placeMenu(){
  const pinned=isWide(),wasModal=side.matches(':modal'),oldFocus=document.activeElement;
  side.removeAttribute('data-closing');root.classList.remove('noa-menu-open','noa-menu-leaving');
  if(side.open)side.close();
  root.classList.toggle('noa-wide-rail',pinned);
  if(pinned){side.setAttribute('role','navigation');side.show();loadMap();if(oldFocus&&oldFocus!==document.body)oldFocus.focus({preventScroll:true});else document.activeElement?.blur();}
  else{side.removeAttribute('role');if(wasModal)trigger?.focus({preventScroll:true});}
  trigger?.setAttribute('aria-expanded',String(pinned));
 }
 wide.addEventListener('change',placeMenu);
 window.addEventListener('pageshow',()=>{if(isWide()&&!side.open)placeMenu();});
 function dismiss(){
  if(isWide())return;
  if(!side.open||side.hasAttribute('data-closing'))return;
  if(reduced.matches){side.close();return;}
  side.setAttribute('data-closing','');root.classList.add('noa-menu-leaving');
  const motion=side.getAnimations().find(a=>a.animationName==='noa-drawer-out');
  if(motion)motion.finished.then(()=>{if(side.open&&side.hasAttribute('data-closing'))side.close();},()=>{if(side.hasAttribute('data-closing'))side.close();});else side.close();
 }
 side.addEventListener('cancel',e=>{e.preventDefault();dismiss();});
 side.addEventListener('close',()=>{
  if(side.open)return;
  side.removeAttribute('data-closing');root.classList.remove('noa-menu-open','noa-menu-leaving');
  trigger?.setAttribute('aria-expanded','false');search.value='';search.dispatchEvent(new Event('input'));
  if(!document.querySelector('dialog:modal'))trigger?.focus({preventScroll:true});
 });
 side.addEventListener('click',e=>{
  if(isWide())return;
  if(e.target===side){const r=side.getBoundingClientRect();if(e.clientX<r.left||e.clientX>=r.right||e.clientY<r.top||e.clientY>=r.bottom)dismiss();}
  else if(e.target.closest('a[href],[data-noa-display-settings]')&&side.open)side.close();
 });
 window.addEventListener('pagehide',()=>{if(side.open)side.close();});
 const installHeader=()=>{
  const bar=document.getElementById('noa-account-bar'),tools=document.getElementById('noa-drawer-tools');
  if(!bar||!tools)return false;
  trigger=document.getElementById('noa-nav-all');
  trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',side.id);trigger.setAttribute('aria-expanded','false');
  trigger.addEventListener('click',e=>{
   if(e.button||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   e.preventDefault();if(isWide()){loadMap();search.focus();return;}if(side.open)return;side.showModal();loadMap();side.scrollTop=0;
   root.classList.add('noa-menu-open');trigger.setAttribute('aria-expanded','true');close.focus({preventScroll:true});
  });
  searchBox.after(tools);tools.hidden=false;
  placeMenu();refreshNavigation();return true;
 };
 if(!installHeader()){const watch=new MutationObserver(()=>{if(installHeader())watch.disconnect();});watch.observe(document.body,{childList:true,subtree:true});}
 let glintTimer;
 function scheduleGlint(){
  clearTimeout(glintTimer);if(reduced.matches||document.hidden)return;
  glintTimer=setTimeout(()=>{
   const star=document.querySelector('.noa-mobile-nav [data-noa-nav=home]:not(.has-ainoa-alert):not(.is-ainoa-open)>svg');
   if(star?.getClientRects().length)star.animate([{filter:'none'},{filter:'drop-shadow(0 0 4px currentColor)',transform:'scale(1.10)',offset:.42},{filter:'none'}],{duration:850,easing:'ease-in-out'});
   scheduleGlint();
  },4500+Math.random()*10500);
 }
 scheduleGlint();reduced.addEventListener('change',scheduleGlint);document.addEventListener('visibilitychange',scheduleGlint);
 // Move the real feed node so visual order, keyboard order and its existing event handlers agree.
 const notices=document.querySelector('[data-home-section="notices"]'),community=document.querySelector('[data-home-section="community"]');if(notices&&community){const hero=document.querySelector('[data-home-section=hero]');if(hero)hero.after(notices,community);else notices.after(community);}
 const noticeCard=notices?.querySelector('.noa-notice-list');if(noticeCard){const quick=document.createElement('nav');quick.className='noa-home-quickstart';quick.setAttribute('aria-label','스튜디오 빠른 시작');quick.innerHTML='<h3>스튜디오 빠른 시작</h3>';for(const [label,href]of [['음악 영상 둘러보기','/noa-youtube.php'],['내 사연을 노래로','/noa-lounge.php?category=story&view=list#ec-content'],['VIP 이용권 알아보기','/noa-vip.php']]){const a=document.createElement('a');a.href=href;a.dataset.noaDocumentLink='';const text=document.createElement('span');text.textContent=label;const arrow=document.createElement('span');arrow.textContent='↗';arrow.setAttribute('aria-hidden','true');a.append(text,arrow);quick.append(a);}noticeCard.append(quick);}

 // Keep the requested home banner positions, including banners arriving asynchronously.
 // Moving existing nodes preserves event handlers and makes keyboard order match the page.
 const main=document.querySelector('.noa-main');
 if(main&&community){
  for(const grid of main.querySelectorAll('section>.noa-card-grid'))grid.parentElement.classList.add('noa-home-shelf');
  const arrangeHome=()=>{
   const referral=main.querySelector('#noa-referral-banner');if(referral&&referral.parentElement!==main)main.append(referral);
   const goods=main.querySelector('[data-home-banner=goods]');if(goods&&goods.parentElement!==notices)notices.append(goods);
   const selectors=['[data-home-section=hero]','#noa-referral-banner','#noa-listening','.noa-monthly-benefits','#noa-daily-fortune','#noa-theme-scene','[data-home-section=notices]','[data-home-section=community]','[data-home-section=recommendations]','[data-home-section=ep]','[data-home-section=stories]','[data-home-banner=youtube]','[data-home-section=world]','[data-home-section=covers]','[data-home-section=playlists]','#noa-playlist-basis','[data-home-banner=amt]','[data-home-section=collections]'];
   let previous=main.querySelector(':scope>.noa-topbar');
   for(const selector of selectors){const node=main.querySelector(':scope>'+selector);if(!node)continue;if(previous){if(node.previousElementSibling!==previous)previous.after(node);}else if(main.firstElementChild!==node)main.prepend(node);previous=node;}
  };
  arrangeHome();const homeOrder=new MutationObserver(arrangeHome);homeOrder.observe(main,{childList:true});homeOrder.observe(notices,{childList:true});
 }

 window.dispatchEvent(new Event('noa-shell-ready'));
}
/* Frame existing page introductions without replacing their content or controls. */
function roomIntroductions(){
 const main=document.querySelector('body.noa-page main');if(!main||main.classList.contains('noa-main'))return;
 const title=main.querySelector(':scope>h1');if(!title||main.querySelector('.noa-room-heading'))return;
 const heading=document.createElement('header');heading.className='noa-room-heading';
 const eyebrow=title.previousElementSibling,description=title.nextElementSibling;
 title.before(heading);if(eyebrow?.matches('.noa-eyebrow'))heading.append(eyebrow);heading.append(title);
 if(description?.matches('p.noa-muted,p.muted')&&!description.id)heading.append(description);
 main.classList.add('noa-room-page');
}
// A preference is distinct from the currently rendered palette. Never save clock changes to an account.
const fallbackThemeHours={startHour:7,endHour:19,light:'noa-ivory',dark:'noa-studio'};
function automaticTheme(){return config?.automaticTheme||window.NoaPageDesign?.automaticTheme||fallbackThemeHours;}
let themeTimer=null;
function isThemeChoice(id){return id==='auto'||config?.themes.some(theme=>theme.id===id);}
function resolvedTheme(choice,now=new Date()){
 if(choice!=='auto')return choice;
 const auto=automaticTheme();
 return now.getHours()>=auto.startHour&&now.getHours()<auto.endHour?auto.light:auto.dark;
}
function scheduleTheme(){
 if(themeTimer!==null)clearTimeout(themeTimer);themeTimer=null;
 if(state?.theme!=='auto')return;
 const now=new Date(),next=new Date(now),auto=automaticTheme();
 if(now.getHours()<auto.startHour)next.setHours(auto.startHour,0,0,0);
 else if(now.getHours()<auto.endHour)next.setHours(auto.endHour,0,0,0);
 else{next.setDate(next.getDate()+1);next.setHours(auto.startHour,0,0,0);}
 // Recheck the local clock at least once a minute, including timezone/clock changes.
 themeTimer=setTimeout(refreshAutomaticTheme,Math.max(50,Math.min(next-now,60000)));
}
function refreshAutomaticTheme(){
 if(state?.theme!=='auto')return;
 if(root.dataset.noaTheme!==resolvedTheme('auto'))apply(state);else scheduleTheme();
}
function themeArtwork(){return '<div class="noa-theme-visual" aria-hidden="true"><div class="noa-theme-art"><span class="noa-theme-celestial"></span><span class="noa-theme-stars"><i></i><i></i><i></i><i></i><i></i></span><span class="noa-theme-mountains"></span><span class="noa-theme-sea"></span></div></div>';}
// Theme scenes belong to editorial banners; artist artwork and real product photos stay untouched.
function themeImages(theme){
 const images=theme.images;if(!images)return;
 for(const [role,url]of Object.entries(images))root.style.setProperty('--noa-image-'+role,'url("'+url+'")');
 const scene=document.querySelector('#noa-theme-scene .noa-theme-visual');
 if(scene&&!scene.querySelector('.noa-theme-cover')){
  const cover=document.createElement('img');cover.className='noa-theme-cover';cover.alt='';cover.decoding='async';cover.fetchPriority='high';cover.width=1672;cover.height=941;scene.append(cover);
 }
 const slots=[
  ['#noa-theme-scene .noa-theme-cover','coast'],
  ['.noa-footer-landscape','coast'],
  ['.noa-story-entrance>img','journey'],
  ['.noa-monthly-intro>img','music'],
  ['[data-home-banner="youtube"]>.noa-home-banner-photo','music'],
  ['[data-home-banner="amt"]>.noa-home-banner-photo','journey'],
  ['.ne-hero>img','music'],
  ['#ecosystem[data-space="lounge"]>.ec-hero>img','coast'],
  ['#ecosystem[data-space="lab"]>.ec-hero>img','music']
 ];
 for(const [selector,role]of slots)for(const img of document.querySelectorAll(selector)){
  img.dataset.noaThemeImage=role;img.alt='';
  if(!img.classList.contains('noa-theme-cover')){img.loading='lazy';img.decoding='async';}
  if(img.getAttribute('src')!==images[role])img.src=images[role];
 }
}
function themePresentation(theme){
 if(themeOnly||admin||!theme.concept)return;
 const concept=theme.concept,hero=document.querySelector('.noa-hero[data-home-section="hero"]');
 let scene=document.getElementById('noa-theme-scene');
 if(hero&&!scene){
  scene=document.createElement('section');scene.id='noa-theme-scene';scene.className='noa-theme-scene';scene.setAttribute('aria-label','NOA STUDIO의 낮과 밤');
  scene.innerHTML='<div class="noa-theme-story"><p class="noa-theme-kicker"></p><h2></h2><p class="noa-theme-caption"></p></div>'+themeArtwork();
  hero.before(scene);
 }
 if(scene){scene.querySelector('.noa-theme-kicker').textContent=concept.eyebrow;scene.querySelector('h2').textContent=concept.title;scene.querySelector('.noa-theme-caption').textContent=concept.description;const oldClock=scene.querySelector('.noa-theme-hour');if(oldClock){oldClock.insertAdjacentHTML('beforebegin',themeArtwork());oldClock.remove();}}
 document.querySelectorAll('.noa-sidebar-signature>span').forEach(el=>el.textContent=concept.signature);
 const current=document.getElementById('noa-theme-current');if(current)current.textContent=(state.theme==='auto'?'지금은 ':'')+theme.name+' · '+concept.name;
 const detail=document.getElementById('noa-theme-description');if(detail)detail.textContent=concept.description;
 for(const pick of document.querySelectorAll('[data-footer-theme]')){
  pick.disabled=false;pick.hidden=pick.dataset.footerTheme!=='auto'&&!!remote?.defaults?.enabled&&!remote.defaults.enabled.includes(pick.dataset.footerTheme);
  pick.setAttribute('aria-pressed',String(pick.dataset.footerTheme===state.theme));
 }
 document.querySelectorAll('[data-noa-display-settings]').forEach(el=>el.setAttribute('title',state.theme==='auto'?'자동 테마 · 현재 '+theme.name:theme.name));
}
function apply(next){
 if(!config)return;
 const choice=isThemeChoice(next.theme)?next.theme:config.defaultTheme;
 const theme=config.themes.find(t=>t.id===resolvedTheme(choice))||config.themes[0];if(!theme)return;
 state={...next,theme:choice,design:'ios',radius:'soft'};
 root.dataset.noaTheme=theme.id;root.dataset.noaThemePreference=choice;root.dataset.noaRoom=sectionFor(location.pathname);
 root.style.backgroundColor=theme.tokens.bg;root.style.colorScheme=theme.id==='noa-ivory'?'light':'dark';root.dataset.noaStyle='starlight';root.dataset.design='ios';root.dataset.radius='soft';
 for(const[k,v]of Object.entries(theme.tokens))root.style.setProperty('--noa-'+k,v,'important');
 language=['ko','ja','en','th'].includes(next.language)?next.language:language;
 safeWrite('noa-view-lang',language);safeWrite(themeStorageKey,JSON.stringify(state));
 // Older open tabs normalize unknown themes to dark. Do not feed auto into their legacy key.
 if(choice!=='auto')safeWrite('noa-ui-selection',JSON.stringify(state));
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',theme.tokens.bg);
 themePresentation(theme);themeImages(theme);scheduleTheme();markLabels();root.lang=language;if(language!=='ko'||root.dataset.noaTranslated){renderUi(document.body);root.dataset.noaTranslated=language==='ko'?'':language;}window.dispatchEvent(new Event('noa-theme'));
}
window.addEventListener('focus',refreshAutomaticTheme);
window.addEventListener('pageshow',refreshAutomaticTheme);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshAutomaticTheme();});
function openSettings(){let dialog=document.getElementById('noa-settings-dialog');if(!dialog){dialog=document.createElement('dialog');dialog.id='noa-settings-dialog';dialog.className='noa-settings-dialog';dialog.innerHTML='<form method=dialog><button aria-label=Close class=noa-dialog-close>×</button></form><h2>화면과 언어</h2><div id=noa-settings-controls></div><p id=noa-settings-status role=status></p>';dialog.querySelector('h2').dataset.noaI18n='화면과 언어';document.body.append(dialog);}settings();dialog.showModal();}
function status(text){const e=document.getElementById('noa-settings-status');if(e)e.textContent=text;}
document.addEventListener('click',event=>{
 const trigger=event.target.closest?.('[data-noa-display-settings]');
 if(!trigger)return;
 if(document.querySelector('#noa-settings-controls')&&!document.querySelector('#noa-settings-dialog')){
  document.getElementById('noa-theme')?.focus();return;
 }
 openSettings();
});
function settings(){const host=document.getElementById('noa-settings-controls');if(!host||!config||!state)return;host.replaceChildren();const row=document.createElement('div');row.className='noa-settings-row';const options=[['theme','테마',[['auto','자동 테마'],...config.themes.map(theme=>[theme.id,theme.name])]],['language','언어',[['ko','한국어'],['ja','日本語'],['en','English'],['th','ไทย']]]];for(const[key,name,values]of options){const label=document.createElement('label');const span=document.createElement('span');span.dataset.noaI18n=name;span.textContent=tr(name);const select=document.createElement('select');select.id='noa-'+key;select.setAttribute('aria-label',name);for(const[id,title]of values){if(key==='theme'&&id!=='auto'&&remote&&!remote.defaults.enabled.includes(id))continue;const option=document.createElement('option');option.value=id;option.textContent=tr(title);if(words[title])option.dataset.noaI18n=title;select.append(option);}select.value=state[key];select.onchange=()=>{dirty=true;if(key==='theme')safeWrite('noa-device-theme',select.value);if(key==='language')safeWrite('noa-explicit-language',select.value);apply({...state,[key]:select.value});status(remote?.member?'변경한 설정을 계정에 저장할 수 있습니다.':'이 기기에 설정을 저장했습니다.');document.getElementById('noa-settings-save').disabled=false;};label.append(span,select);row.append(label);}host.append(row);const note=document.createElement('p');note.className='noa-theme-schedule';note.id='noa-theme-schedule';note.textContent='자동 테마는 오전 7시부터 라이트, 오후 7시부터 다크로 바뀝니다. 기기 시간을 기준으로 합니다.';host.append(note);row.querySelector('#noa-theme')?.setAttribute('aria-describedby','noa-theme-schedule');const summary=document.createElement('div');summary.className='noa-theme-summary';summary.innerHTML='<strong id="noa-theme-current"></strong><p id="noa-theme-description"></p>';host.append(summary);const preview=document.createElement('div');preview.className='noa-preview';for(const key of ['bg','surface','sun','sea','forest']){const swatch=document.createElement('i');swatch.style.background='var(--noa-'+key+')';preview.append(swatch);}host.append(preview);themePresentation(config.themes.find(t=>t.id===root.dataset.noaTheme));const save=document.createElement('button');save.id='noa-settings-save';save.className='noa-button';save.style.marginTop='24px';save.dataset.noaI18n=remote?.member?'서버에 저장':'기기에 저장';save.textContent=tr(save.dataset.noaI18n);save.disabled=!dirty;save.onclick=async()=>{if(!remote?.member){dirty=false;save.disabled=true;status('이 기기에 설정을 저장했습니다.');return;}save.disabled=true;try{const r=await fetch('/noa-bridge/ui-preferences.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-CSRF':remote.csrf},body:JSON.stringify({settings:state,expectedRevision:revision})});const j=await r.json();if(!r.ok)throw Error(j.error);revision=j.revision;dirty=false;status('계정에 설정을 저장했습니다.');}catch{save.disabled=false;status('서버에 저장하지 못했습니다. 현재 기기의 설정은 유지됩니다. 새로 불러온 뒤 다시 저장해 주세요.');}};host.append(save);if(remote?.admin){const p=document.createElement('p');p.innerHTML='<a href="/noa-theme-admin.php">공통 디자인 · 변경 이력</a>';host.append(p);}markLabels();}
async function init(){shell();if(!themeOnly&&!admin){sectionNavigation();roomIntroductions();}let early=null;try{early=JSON.parse(safeRead(themeStorageKey)||safeRead('noa-ui-selection')||'null')}catch{}const initial=['auto','noa-studio','noa-ivory'].includes(early?.theme)?early.theme:'auto';root.dataset.noaTheme=resolvedTheme(initial);root.dataset.noaThemePreference=initial;root.style.colorScheme=root.dataset.noaTheme==='noa-ivory'?'light':'dark';try{const preferences=fetch('/noa-bridge/ui-preferences.php',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).catch(()=>null);
 const translations=Promise.all([
  fetch('/noa-ui-words.json').then(r=>r.ok?r.json():null).catch(()=>null),
  fetch('/noa-interface-labels.json?v=51e089c7fe146008').then(r=>r.ok?r.json():null).catch(()=>null)
 ]);
 config=window.NoaPageDesign||await fetch('/noa-design.json',{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error();return r.json();});
 translations.then(([dictionary,labels])=>{
  if(dictionary)Object.assign(words,dictionary);if(labels){Object.assign(interfaceWords,labels);Object.assign(words,labels);catalogReady=true;}
  if(state&&language!=='ko'){markLabels();renderUi(document.body);settings();}
 });
 let local=null;try{local=JSON.parse(safeRead(themeStorageKey)||safeRead('noa-ui-selection')||'null')}catch{}apply(local&&isThemeChoice(local.theme)?{design:'ios',radius:'soft',...local,language}:{theme:config.defaultTheme,language,design:root.dataset.design||'ios',radius:root.dataset.radius||'soft'});settings();try{remote=await preferences;if(!remote)throw Error();revision=remote.revision;window.dispatchEvent(new Event('noa-drawer-identity'));if(!dirty&&remote.settings)apply({...remote.settings,language:safeRead('noa-explicit-language')||remote.settings.language,theme:isThemeChoice(safeRead('noa-device-theme'))?safeRead('noa-device-theme'):isThemeChoice(remote.settings.theme)?remote.settings.theme:config.defaultTheme});else if(!dirty&&!local)apply({...state,theme:config.defaultTheme});document.querySelectorAll('[data-noa-login]').forEach(a=>{a.href=remote.member?'/bbs/member_confirm.php?url=register_form.php':'/bbs/login.php';a.textContent=remote.member?remote.displayName:tr('로그인')});document.querySelectorAll('[data-noa-admin],[data-noa-lab]').forEach(a=>a.hidden=!remote.admin);settings();status(remote.member?'계정에 저장하면 웹과 앱의 동일 설정 화면에서 불러옵니다.':'비로그인 설정은 이 기기에 보관합니다.');}catch{status('서버 설정을 불러오지 못했습니다. 마지막 기기 설정을 유지합니다.');}}catch{status('디자인 설정을 불러오지 못했습니다. 기본 화면을 유지합니다.');}}
window.addEventListener('storage',e=>{if((e.key===themeStorageKey||(e.key==='noa-ui-selection'&&!safeRead(themeStorageKey)))&&e.newValue){try{apply(JSON.parse(e.newValue));settings()}catch{}}});let markPending=false;const changedUi=new Set();new MutationObserver(records=>{if(language!=='ko'&&catalogReady)for(const r of records){if((r.target.parentElement?.closest('#noa-header-clock')||r.target.id==='noa-header-clock'))continue;if(r.type==='childList'){for(const n of r.addedNodes)changedUi.add(n);}else changedUi.add(r.target);}if(records.every(r=>r.type==='attributes')){for(const n of changedUi)if(n.isConnected)renderUi(n);changedUi.clear();return;}if(markPending||records.every(r=>['dock-current','dock-duration','seek-clock'].includes(r.target.id)||r.target.closest?.('#noa-header-clock')))return;markPending=true;requestAnimationFrame(()=>{markPending=false;markLabels();for(const n of changedUi)if(n.isConnected)renderUi(n);changedUi.clear()});}).observe(document.body||root,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['aria-label','title','placeholder','alt']});window.addEventListener('hashchange',refreshNavigation);window.NoaUI={translate:tr,apply,getState:()=>state,setLanguage:value=>{if(!state||!['ko','ja','en','th'].includes(value))return;dirty=true;safeWrite('noa-explicit-language',value);apply({...state,language:value});settings();}};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
/* Count-aware card layout: presentation only. Keep nodes, handlers and source order intact. */
(()=>{'use strict';
if(/^\/noa-app\/(?:jukebox|taxonomy|database|popularity)(?:\/|$)/.test(location.pathname))return;
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
 const columns=Math.max(1,Math.min(5,Math.floor(capacity))),rows=[];
 for(let left=Math.max(0,count);left>0;left-=columns)rows.push(Math.min(columns,left));
 return{columns,featured:false,rows};
}
const specs=[
 ['.noa-card-grid','.noa-music-card,.noa-engagement-card',true,168,136,4],
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
function chromeSpace(){const nav=document.querySelector('.noa-mobile-nav');let navHeight=0;if(nav){if(!chromeObserved.has(nav)){resize.observe(nav);chromeObserved.add(nav);}if(getComputedStyle(nav).display!=='none')navHeight=nav.getBoundingClientRect().height;}style(document.documentElement,'--noa-nav-space',Math.ceil(navHeight)+'px');const player=document.querySelector('.noa-transport');let height=0;if(player){if(!chromeObserved.has(player)){resize.observe(player);chromeObserved.add(player);}if(!player.hidden&&getComputedStyle(player).display!=='none')height=player.getBoundingClientRect().height;}style(document.documentElement,'--noa-player-space',Math.ceil(height)+'px');const transfer=document.getElementById('jukebox-transfer-dock');let transferHeight=0;if(transfer){if(!chromeObserved.has(transfer)){resize.observe(transfer);chromeObserved.add(transfer);}if(!transfer.hidden&&getComputedStyle(transfer).display!=='none')transferHeight=transfer.getBoundingClientRect().height;}style(document.documentElement,'--noa-transfer-space',Math.ceil(transferHeight)+'px');}

function style(el,key,value){if(el.style.getPropertyValue(key)!==value)el.style.setProperty(key,value);}
function arrange(host,spec){
 const box=getComputedStyle(host),width=host.clientWidth-parseFloat(box.paddingLeft)-parseFloat(box.paddingRight);if(!width||host.hidden)return;
 const cards=[...host.children].filter(e=>e.matches(spec[1])&&!e.hidden&&getComputedStyle(e).display!=='none');
 if(!cards.length){host.classList.remove('noa-balanced');return;}
 const gap=parseFloat(box.columnGap)||(width<=600?12:16),min=width<=600?spec[4]:spec[3];
 if(spec[2])cards.forEach(card=>prepare(card));
 const shelfCapacity=host.closest('.noa-home-shelf')?(host.id==='noa-featured'&&window.matchMedia('(min-width:960px)').matches?4:2):null;
 const capacity=shelfCapacity??Math.min((host.matches('.noa-browse-grid,.noa-genres')?Math.min(cards.length,spec[5]):spec[5]),Math.max(1,Math.floor((width+gap)/(min+gap))));
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
 if(host.closest('[data-world-editorial]'))continue;
 if(!hosts.has(host)){hosts.set(host,spec);resize.observe(host);}arrange(host,spec);
 }for(const host of hosts.keys())if(!host.isConnected){resize.unobserve(host);hosts.delete(host);}}
function schedule(){if(!pending){pending=true;requestAnimationFrame(scan);}}
const resize=new ResizeObserver(schedule);
new MutationObserver(records=>{if(records.some(r=>!r.target.closest?.('#noa-header-clock,#dock-current,#dock-duration,#seek-clock')&&(r.type==='childList'||r.attributeName==='hidden'||r.attributeName==='style'&&r.target.style.display!==r.target.dataset.noaDisplay))){
 for(const r of records)if(r.attributeName==='style')r.target.dataset.noaDisplay=r.target.style.display;schedule();
}}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['hidden','style']});
window.addEventListener('resize',schedule,{passive:true});window.addEventListener('noa-theme',schedule);
document.documentElement.dataset.noaPrecision='true';
window.NoaCardLayout={plan,presentTitle,movement,prepare,setMovement,refresh:schedule,debug(enabled){document.documentElement.toggleAttribute('data-noa-grid-debug',Boolean(enabled));}};schedule();
})();
/* Semi-Gloss Sculpted Glass: preserve action nodes, handlers, labels and permissions. */
(()=>{'use strict';
if(window.NoaGlass||/^\/noa-app\/(?:jukebox|taxonomy|database|popularity)(?:\/|$)/.test(location.pathname))return;
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
/* Responsive action flow and a reachable close control for expanded document panels. */
(()=>{'use strict';if(document.currentScript?.hasAttribute('data-noa-theme-only')||document.getElementById('noa-disclosure-close'))return;
 const observed=new WeakSet();const player=el=>el.closest('.noa-transport,.controls,#noa-jukebox,.noa-jukebox,.noa-player,[data-noa-player]');
 const fit=el=>{if(player(el)||location.pathname==='/noa-music.php')return;el.toggleAttribute('data-noa-wide',el.getBoundingClientRect().width>=140);};
 const ro=window.ResizeObserver?new ResizeObserver(entries=>entries.forEach(e=>fit(e.target))):null;
 const scan=()=>document.querySelectorAll('main .noa-action:not(summary):not(.noa-personal-card)').forEach(el=>{if(observed.has(el))return;observed.add(el);fit(el);ro?.observe(el);});
 let scheduled=false;const schedule=()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;scan();});}};
 new MutationObserver(changes=>{if(changes.some(change=>Array.from(change.addedNodes).some(node=>node.nodeType===1)))schedule();}).observe(document.body,{childList:true,subtree:true});scan();
 let active=null,count=0;const close=document.createElement('button');close.id='noa-disclosure-close';close.type='button';close.hidden=true;close.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m6 14 6-6 6 6"/></svg><span>펼친 내용 접기</span>';close.setAttribute('aria-label','펼친 내용 접기');document.body.append(close);
 function eligible(el){return el instanceof HTMLDetailsElement&&el.closest('main')&&!el.closest('dialog,.noa-edit-form,[data-noa-local-disclosure]')&&!player(el);}
 function select(el){active=el;if(!el){close.hidden=true;close.removeAttribute('aria-controls');return;}if(!el.id)el.id='noa-disclosure-'+(++count);close.setAttribute('aria-controls',el.id);close.hidden=false;}
 function collapse(el){if(!el)return;const summary=el.querySelector(':scope>summary');el.open=false;summary?.focus({preventScroll:true});summary?.scrollIntoView({block:'nearest',behavior:'auto'});select([...document.querySelectorAll('main details[open]')].filter(eligible).at(-1)||null);}
 document.addEventListener('toggle',event=>{const el=event.target;if(!eligible(el))return;el.querySelector(':scope>summary')?.setAttribute('aria-expanded',String(el.open));if(el.open){if(el.matches('[data-noa-disclosure]'))document.querySelectorAll('[data-noa-disclosure][open]').forEach(other=>{if(other!==el)other.open=false;});select(el);}else if(active===el)select([...document.querySelectorAll('main details[open]')].filter(eligible).at(-1)||null);},true);
 close.addEventListener('click',()=>collapse(active));document.addEventListener('click',e=>{const button=e.target.closest('[data-noa-collapse]');if(button)collapse(button.closest('details'));});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]'))collapse(active?.open?active:[...document.querySelectorAll('main details[open]')].filter(eligible).at(-1));});
 select([...document.querySelectorAll('main details[open]')].filter(eligible).at(-1)||null);
})();

/* Match the writing canvas to the site without changing the HTML that the editor saves. */
(()=>{
 const writer=document.querySelector('#bo_w');if(!writer)return;
 const watched=new WeakSet();
 function paint(frame){
  let doc;try{doc=frame.contentDocument;}catch{return;}
  if(!doc?.body||!doc.head)return;
  if(!watched.has(doc)){
   watched.add(doc);
   new MutationObserver(()=>paint(frame)).observe(doc.body,{attributes:true,attributeFilter:['class','contenteditable']});
   doc.addEventListener('load',event=>{if(event.target.tagName==='IFRAME')paint(event.target);},true);
  }
  if(doc.designMode==='on'||doc.body.isContentEditable||doc.body.matches('.se2_inputarea,.cke_editable')){
   const palette=getComputedStyle(document.documentElement);
   let style=doc.getElementById('noa-writing-palette');
   if(!style){style=doc.createElement('style');style.id='noa-writing-palette';doc.head.append(style);}
   style.textContent=':root{color-scheme:'+palette.colorScheme+'}body{background-color:'+palette.getPropertyValue('--noa-bg')+'!important;color:'+palette.getPropertyValue('--noa-text')+'!important;caret-color:'+palette.getPropertyValue('--noa-accent')+'}';
   return;
  }
  doc.querySelectorAll('iframe').forEach(paint);
 }
 const refresh=()=>writer.querySelectorAll('iframe').forEach(paint);
 writer.addEventListener('load',event=>{if(event.target.tagName==='IFRAME')paint(event.target);},true);
 window.addEventListener('noa-theme',refresh);refresh();
})();
