/* Keep the MUSIC document/engine and upload reservations alive while app views change. */
(()=>{'use strict';
const audio=document.getElementById('sound-player'),dock=document.querySelector('.noa-two-line');if(!audio||!dock)return;
// Dock is a sibling of main, so hiding the MUSIC view never destroys its controls.
document.body.append(dock);const dialog=document.getElementById('dock-queue');document.body.append(dialog);
const title=document.getElementById('dock-title'),image=document.getElementById('dock-cover'),empty=document.getElementById('dock-cover-empty');
const moreControl=document.getElementById('dock-more');
const narrowScreen=window.matchMedia('(max-width:600px)');
function updateMoreControl(){if(!moreControl)return;moreControl.hidden=false;if(!narrowScreen.matches){dock.dataset.expanded='false';moreControl.setAttribute('aria-expanded','false');}}
narrowScreen.addEventListener('change',updateMoreControl);updateMoreControl();
// Move secondary controls into a true overlay instead of creating a third player row.
const extras=['repeat','shuffle','sequential','dock-list'].map(id=>document.getElementById(id)).filter(Boolean);
const originalControls=document.querySelector('.noa-two-line .controls');
const popup=document.createElement('div');popup.id='noa-dock-popover';popup.hidden=true;popup.setAttribute('role','group');popup.setAttribute('aria-label','추가 재생 조작');document.body.append(popup);
function closePopup(){popup.hidden=true;dock.dataset.expanded='false';moreControl?.setAttribute('aria-expanded','false');}
function syncPopup(){closePopup();extras.forEach(b=>popup.append(b));updateMoreControl();}
narrowScreen.addEventListener('change',syncPopup);syncPopup();
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

function marquee(){const width=title.parentElement.clientWidth,extra=title.scrollWidth-width;title.classList.toggle('noa-title-scroll',extra>2);title.style.setProperty('--title-shift',-Math.max(0,extra)+'px');}
new ResizeObserver(marquee).observe(title.parentElement);document.fonts?.ready.then(marquee);
let imageRevision=0;
window.addEventListener('noa-track-selected',e=>{const r=e.detail.record;const revision=++imageRevision;title.textContent=r.title;title.title=r.title;image.hidden=!r.thumb;empty.hidden=!!r.thumb;image.onload=()=>{if(revision!==imageRevision)return;try{const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,1,1);const [red,green,blue]=ctx.getImageData(0,0,1,1).data;const luminance=(.2126*red+.7152*green+.0722*blue)/255;const usable=luminance>.28&&luminance<.76&&Math.max(red,green,blue)-Math.min(red,green,blue)>25;dock.style.setProperty('--noa-cover-accent',usable?`rgb(${red} ${green} ${blue})`:'var(--noa-accent)');}catch{dock.style.removeProperty('--noa-cover-accent');}};image.onerror=()=>{if(revision===imageRevision){image.hidden=true;empty.hidden=false;dock.style.removeProperty('--noa-cover-accent');}};if(r.thumb)image.src=r.thumb;else{image.removeAttribute('src');dock.style.removeProperty('--noa-cover-accent');}document.getElementById('dock-current').textContent='0:00';document.getElementById('dock-duration').textContent='0:00';marquee();});
// The initial selected track may precede this deferred script.
const initial=document.querySelector('.song.selected');if(initial)window.dispatchEvent(new CustomEvent('noa-track-selected',{detail:{record:{title:initial.dataset.title,thumb:initial.querySelector('img')?.getAttribute('src')||''}}}));
const routes=new Set(['/','/index.php','/noa2.php','/noa-music.php','/noa-youtube.php','/noa-world.php','/noa-my.php','/noa-settings.php']);
let frame=null,home=location.href;const baseTitle=document.title;
function highlight(url){for(const a of document.querySelectorAll('.noa-menu a,.noa-mobile-nav a')){if(new URL(a.href).pathname===url.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}}
function showMusic(url,push){if(frame){frame.remove();frame=null;}document.body.classList.remove('noa-shell-open');document.title=baseTitle;if(push)history.pushState({noaMusicShell:true},'',url);highlight(new URL(url));window.dispatchEvent(new Event('hashchange'));const key=new URL(url).searchParams.get('track');if(key)window.dispatchEvent(new CustomEvent('noa-shell-track',{detail:{key,play:new URL(url).searchParams.get('play')==='1'}}));}
function bind(doc){doc.addEventListener('click',e=>{if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;const a=e.target.closest('a[href]');if(!a||a.target||a.hasAttribute('download'))return;const u=new URL(a.href,doc.URL);if(u.origin!==location.origin||!routes.has(u.pathname))return;if(u.pathname===new URL(doc.URL).pathname&&u.search===new URL(doc.URL).search&&u.hash)return;if(!audio.getAttribute('src'))return;e.preventDefault();navigate(u,true);});}
function navigate(url,push){if(url.pathname==='/noa-music.php'){showMusic(url.href,push);return;}if(push)history.pushState({noaMusicShell:true},'',url);highlight(url);document.body.classList.add('noa-shell-open');if(!frame){frame=document.createElement('iframe');frame.id='noa-shell-view';frame.title='NOA STUDIO 콘텐츠';frame.addEventListener('load',()=>{try{const doc=frame.contentDocument;if(!doc||new URL(doc.URL).origin!==location.origin)return;const style=doc.createElement('style');style.textContent='.noa-sidebar,.noa-mobile-nav,.noa-g5-top{display:none!important}html{--noa-rail:0px!important;--noa-nav-space:0px!important}body.noa-page{margin:0!important}body.noa-page main{margin-left:0!important;padding-bottom:24px!important}';doc.head.append(style);doc.defaultView.addEventListener('noa-media-activity',e=>{if(e.detail?.type==='youtube')audio.pause();});bind(doc);document.title=doc.title+' · NOA STUDIO';}catch{showMusic(home,false);}});document.body.append(frame);}frame.src=url.href;}
audio.addEventListener('play',()=>{try{const win=frame?.contentWindow;if(win)win.dispatchEvent(new win.Event('noa-background'));}catch{}});
history.replaceState({noaMusicShell:true},'',location.href);bind(document);window.addEventListener('popstate',()=>{const u=new URL(location.href);if(u.pathname==='/noa-music.php')showMusic(u.href,false);else if(routes.has(u.pathname))navigate(u,false);});
})();
