/* Keep the MUSIC document/engine and upload reservations alive while app views change. */
(()=>{'use strict';
const audio=document.getElementById('sound-player'),dock=document.querySelector('.noa-two-line');if(!audio||!dock)return;
// Dock is a sibling of main, so hiding the MUSIC view never destroys its controls.
document.body.append(dock);const dialog=document.getElementById('dock-queue');document.body.append(dialog);
const title=document.getElementById('dock-title'),image=document.getElementById('dock-cover'),empty=document.getElementById('dock-cover-empty');
const moreControl=document.getElementById('dock-more'),addControl=document.getElementById('dock-add'),artist=document.getElementById('dock-artist');
const compactScreen=window.matchMedia('(max-width:360px)');
const watch=document.getElementById('watch'),detail=document.querySelector('section[aria-label="곡 상세"]');if(watch&&detail)detail.insertBefore(watch,detail.querySelector('.noa-media-details'));
if(addControl)addControl.addEventListener('click',()=>{location.hash='my-playlists';const controls=document.getElementById('my-controls');if(controls&&!controls.hidden)document.getElementById('my-add')?.click();document.getElementById('my-playlists')?.scrollIntoView({block:'start'});});
const narrowScreen=window.matchMedia('(max-width:600px)');
function updateMoreControl(){if(!moreControl)return;moreControl.hidden=false;if(!narrowScreen.matches){dock.dataset.expanded='false';moreControl.setAttribute('aria-expanded','false');}}
narrowScreen.addEventListener('change',updateMoreControl);updateMoreControl();
// Move secondary controls into a true overlay instead of creating a third player row.
const extras=['repeat','shuffle','sequential','dock-list'].map(id=>document.getElementById(id)).filter(Boolean);
const originalControls=document.querySelector('.noa-two-line .controls');
const popup=document.createElement('div');popup.id='noa-dock-popover';popup.hidden=true;popup.setAttribute('role','group');popup.setAttribute('aria-label','추가 재생 조작');document.body.append(popup);
function closePopup(){popup.hidden=true;dock.dataset.expanded='false';moreControl?.setAttribute('aria-expanded','false');}
function syncPopup(){closePopup();extras.forEach(b=>popup.append(b));if(addControl){if(compactScreen.matches)popup.prepend(addControl);else{originalControls.prepend(addControl);addControl.querySelector('.noa-mode-label')?.remove();}}for(const b of popup.querySelectorAll('button'))if(!b.querySelector('.noa-mode-label')){const label=document.createElement('span');label.className='noa-mode-label';label.textContent=({repeat:'반복',shuffle:'셔플',sequential:'순차',"dock-list":'재생목록',"dock-add":'담기'})[b.id]||'';b.append(label);}updateMoreControl();}
narrowScreen.addEventListener('change',syncPopup);compactScreen.addEventListener('change',syncPopup);syncPopup();
function positionPopup(){if(popup.hidden||!moreControl)return;const rect=moreControl.getBoundingClientRect();const width=popup.offsetWidth||240;const height=popup.offsetHeight||64;const left=Math.max(8,Math.min(innerWidth-width-8,rect.right-width));const top=Math.max(8,Math.min(innerHeight-height-8,rect.top-height-8));popup.style.left=left+'px';popup.style.top=top+'px';popup.style.right='auto';popup.style.bottom='auto';}
window.addEventListener('resize',positionPopup,{passive:true});
window.addEventListener('scroll',positionPopup,{passive:true,capture:true});
if(moreControl){moreControl.setAttribute('aria-controls','noa-dock-popover');moreControl.addEventListener('click',e=>{e.stopImmediatePropagation();if(!popup.hidden){closePopup();return;}popup.hidden=false;positionPopup();dock.dataset.expanded='true';moreControl.setAttribute('aria-expanded','true');},true);}
document.addEventListener('pointerdown',e=>{if(!popup.hidden&&!popup.contains(e.target)&&!moreControl?.contains(e.target))closePopup();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!popup.hidden){closePopup();moreControl?.focus();}});
popup.addEventListener('click',e=>{if(e.target.closest('button')){closePopup();moreControl?.focus({preventScroll:true});}});
// If playback controls are hidden or the page loses visibility, never leave a floating menu behind.
const dockVisibilityObserver=new MutationObserver(()=>{if(dock.hidden)closePopup();});
dockVisibilityObserver.observe(dock,{attributes:true,attributeFilter:['hidden']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)closePopup();});
// Selecting the current song reopens its closed display without restarting audio.
document.addEventListener('click',e=>{const button=e.target.closest('.song-select'),card=button?.closest('.song');if(card?.classList.contains('selected')&&card.dataset.audio)dock.hidden=false;});

function marquee(){const width=title.parentElement.clientWidth,extra=title.scrollWidth-width;title.classList.toggle('noa-title-scroll',extra>2);title.style.setProperty('--title-shift',-Math.max(0,extra)+'px');}
new ResizeObserver(marquee).observe(title.parentElement);document.fonts?.ready.then(marquee);
let imageRevision=0;
window.addEventListener('noa-track-selected',e=>{const r=e.detail.record;const revision=++imageRevision;title.textContent=r.title;title.title=r.title;if(artist)artist.textContent=document.getElementById('detail-cast')?.textContent||'';image.hidden=!r.thumb;empty.hidden=!!r.thumb;image.onload=()=>{if(revision!==imageRevision)return;try{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1,1);const [red,green,blue]=ctx.getImageData(0,0,1,1).data;const luminance=(.2126*red+.7152*green+.0722*blue)/255;const usable=luminance>.28&&luminance<.76&&Math.max(red,green,blue)-Math.min(red,green,blue)>25;dock.style.setProperty('--noa-cover-accent',usable?`rgb(${red} ${green} ${blue})`:'var(--noa-accent)');}catch{dock.style.removeProperty('--noa-cover-accent');}};image.onerror=()=>{if(revision===imageRevision){image.hidden=true;empty.hidden=false;dock.style.removeProperty('--noa-cover-accent');}};if(r.thumb)image.src=r.thumb;else{image.removeAttribute('src');dock.style.removeProperty('--noa-cover-accent');}document.getElementById('dock-current').textContent='0:00';document.getElementById('dock-duration').textContent='0:00';marquee();});
// The initial selected track may precede this deferred script.
const initial=document.querySelector('.song.selected');if(initial)queueMicrotask(()=>window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{title:initial.dataset.title,thumb:initial.querySelector('img')?.getAttribute('src')||''}}})));
const routes=new Set(['/','/index.php','/noa-music.php','/noa-youtube.php','/noa-world.php','/noa-my.php','/noa-settings.php','/noa-sitemap.php']);
let frame=null,home=location.href;const baseTitle=document.title;
function highlight(url){for(const a of document.querySelectorAll('.noa-menu a,.noa-mobile-nav a')){if(a.hasAttribute('href')&&new URL(a.getAttribute('href'),location.href).pathname===url.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}}
function showMusic(url,push){if(frame){frame.remove();frame=null;}document.body.classList.remove('noa-shell-open');document.title=baseTitle;if(push)history.pushState({noaMusicShell:true},'',url);highlight(new URL(url));window.dispatchEvent(new Event('hashchange'));const key=new URL(url).searchParams.get('track');if(key)window.dispatchEvent(new CustomEvent('noa-shell-track',{detail:{key,play:new URL(url).searchParams.get('play')==='1'}}));}
function bind(doc){doc.addEventListener('click',e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target.closest('a[href]');if(!a||a.target||a.hasAttribute('download'))return;const u=new URL(a.href,doc.URL);if(u.origin!==location.origin||!routes.has(u.pathname))return;if(u.pathname===new URL(doc.URL).pathname&&u.search===new URL(doc.URL).search&&u.hash)return;if(!audio.getAttribute('src'))return;e.preventDefault();navigate(u,true);});}
function navigate(url,push){if(url.pathname==='/noa-music.php'){showMusic(url.href,push);return;}if(push)history.pushState({noaMusicShell:true},'',url);highlight(url);document.body.classList.add('noa-shell-open');if(!frame){frame=document.createElement('iframe');frame.id='noa-shell-view';frame.title='NOA STUDIO 콘텐츠';frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc||new URL(doc.URL).origin!==location.origin)return;const style=doc.createElement('style');style.textContent='.noa-sidebar,.noa-mobile-nav,.noa-g5-top{display:none!important}html{--noa-rail:0px!important;--noa-nav-space:0px!important}body.noa-page{margin:0!important}body.noa-page main{margin-left:0!important;padding-bottom:24px!important}';doc.head.append(style);doc.defaultView.addEventListener('noa-media-activity',e=>{if(e.detail?.type==='youtube')audio.pause();});bind(doc);document.title=doc.title+' · NOA STUDIO';}catch{showMusic(home,false);}});document.body.append(frame);}frame.src=url.href;}
audio.addEventListener('play',()=>{try{const win=frame?.contentWindow;if(win)win.dispatchEvent(new win.Event('noa-background'));}catch{}});
try{const returned=JSON.parse(sessionStorage.getItem('noa-playback-return')||'null');sessionStorage.removeItem('noa-playback-return');if(returned&&Date.now()-returned.at>=0&&Date.now()-returned.at<30000){const url=new URL(returned.path,location.origin);if(url.origin===location.origin&&routes.has(url.pathname)&&url.pathname!=='/noa-music.php'&&audio.getAttribute('src')){history.replaceState({noaMusicShell:true},'',url);navigate(url,false);}}}catch{}
history.replaceState({noaMusicShell:true},'',location.href);bind(document);window.addEventListener('popstate',()=>{const u=new URL(location.href);if(u.pathname==='/noa-music.php')showMusic(u.href,false);else if(routes.has(u.pathname))navigate(u,false);});
})();

// Reuse the existing audio element and controls for OS lock-screen media actions.
(()=>{'use strict';const audio=document.getElementById('sound-player'),session=navigator.mediaSession;if(!audio||!session)return;
const actions={play:()=>{if(audio.paused)document.getElementById('pause-play')?.click();},pause:()=>{if(!audio.paused)document.getElementById('pause-play')?.click();},previoustrack:()=>document.getElementById('previous')?.click(),nexttrack:()=>document.getElementById('next')?.click(),seekto:d=>{if(Number.isFinite(audio.duration)&&Number.isFinite(d.seekTime))audio.currentTime=Math.max(0,Math.min(audio.duration,d.seekTime));},seekbackward:d=>{audio.currentTime=Math.max(0,audio.currentTime-(d.seekOffset||10));},seekforward:d=>{if(Number.isFinite(audio.duration))audio.currentTime=Math.min(audio.duration,audio.currentTime+(d.seekOffset||10));}};
for(const [name,handler]of Object.entries(actions))try{session.setActionHandler(name,handler);}catch{}
function position(){if(!session.setPositionState||!Number.isFinite(audio.duration)||audio.duration<=0)return;try{session.setPositionState({duration:audio.duration,playbackRate:audio.playbackRate,position:Math.min(audio.duration,Math.max(0,audio.currentTime))});}catch{}}
let last=0;audio.addEventListener('timeupdate',()=>{const now=Date.now();if(now-last>500){last=now;position();}});audio.addEventListener('loadedmetadata',position);audio.addEventListener('seeked',position);
audio.addEventListener('playing',()=>{session.playbackState='playing';position();});audio.addEventListener('pause',()=>{session.playbackState='paused';position();});
window.addEventListener('noa-track-selected',e=>{const r=e.detail?.record;if(!r||!window.MediaMetadata)return;try{session.metadata=new MediaMetadata({title:r.title||'NOA STUDIO',artist:document.getElementById('detail-cast')?.textContent||'AI Artist Noa',album:'NOA STUDIO',artwork:r.thumb?[{src:new URL(r.thumb,location.href).href}]:[]});}catch{}});
})();

// The main player owns play intent; retry logic must not override pause/close/track changes.
(()=>{
 if(!window.NoaPlaybackRecovery||typeof player==='undefined')return;
 const recovery=window.NoaPlaybackRecovery.attach(player,{wanted:()=>pendingAutoplay&&!leavingPage&&!changingTrack,key:()=>selected?.dataset.key||'',status:message=>{status.textContent=message;}});
 window.addEventListener('noa-track-selected',()=>recovery.reset());
 window.addEventListener('online',()=>recovery.online());
 window.addEventListener('pagehide',()=>recovery.stop());
})();
