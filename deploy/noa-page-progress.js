/* Expose real content scroll and foreground work in the same screen-edge indicator. */
(()=>{
 'use strict';
 if(window.NoaPageProgress)return;
 const doc=document,root=doc.documentElement;
 let scheduled=false,requests=0,actionTime=-Infinity,leaving=false;
 const bar=doc.createElement('div'),fill=doc.createElement('i');
 bar.id='noa-page-progress';bar.setAttribute('role','progressbar');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.append(fill);
 function owner(){
  let w=window;
  try{while(w.frameElement?.matches('#noa-shell-view,.nl-play-shell'))w=w.parent;}catch{}
  return w;
 }
 const topPage=owner();
 function wake(){if(topPage!==window){topPage.NoaPageProgress?.wake();return;}if(!scheduled){scheduled=true;requestAnimationFrame(draw);}}
 function findDocument(){
  let current=doc;
  for(let i=0;i<3;i++){
   const f=current.querySelector('#noa-shell-view')||(current.documentElement.classList.contains('nl-host-open')&&current.querySelector('.nl-play-shell'));
   if(!f||f.hidden)break;
   try{if(!f.contentDocument?.body)break;current=f.contentDocument;}catch{break;}
  }
  return current;
 }
 function status(){
  const upload=doc.querySelector('#jukebox-transfer-dock:not([hidden]) progress:not([hidden]),.noa-track-progress[data-phase=uploading] progress');
  if(upload&&upload.isConnected&&upload.hasAttribute('value'))return {kind:'task',value:upload.position,label:'파일 전송 진행률'};
  if(requests||leaving||doc.querySelector('[aria-busy=true],.noa-track-progress:is([data-phase=analyzing],[data-phase=processing],[data-phase=verifying])'))return {kind:'busy',label:'작업 진행 중'};
 }
 function draw(){
  scheduled=false;const current=findDocument(),view=current.defaultView;
  const task=view?.NoaPageProgress?.status()||(current!==doc&&status());
  const scroller=current.scrollingElement||current.documentElement,span=scroller.scrollHeight-scroller.clientHeight;
  const value=Math.min(1,Math.max(0,task?task.value??0:span>0?scroller.scrollTop/span:0));
  bar.dataset.mode=task?.kind||'scroll';bar.setAttribute('aria-label',task?.label||'페이지 읽기 진행률');
  if(task?.kind==='busy')bar.removeAttribute('aria-valuenow');else bar.setAttribute('aria-valuenow',String(Math.round(value*100)));
  fill.style.transform='scaleX('+value+')';
 }
 window.NoaPageProgress={wake,status};
 if(topPage===window)doc.body.append(bar);
 const mark=()=>{actionTime=performance.now();};
 doc.addEventListener('click',mark,true);doc.addEventListener('submit',mark,true);doc.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')mark();},true);
 const fetchOriginal=window.fetch;
 window.fetch=function(input,options){
  const result=fetchOriginal.apply(this,arguments);
  if(performance.now()-actionTime>800)return result;
  let url;try{url=new URL(input?.url||input,location.href);}catch{return result;}
  if(url.origin!==location.origin)return result;
  requests++;wake();return result.finally(()=>{requests--;wake();});
 };
 if(window.navigation){
  navigation.addEventListener('navigate',event=>{
   if(event.hashChange||event.downloadRequest!=null||event.destination.sameDocument)return;
   leaving=true;wake();event.signal.addEventListener('abort',()=>{leaving=false;wake();},{once:true});
  });
  for(const name of ['navigatesuccess','navigateerror'])navigation.addEventListener(name,()=>{leaving=false;wake();});
 }
 window.addEventListener('pagehide',()=>{leaving=false;});
 window.addEventListener('pageshow',()=>{leaving=false;wake();});
 doc.addEventListener('submit',event=>{queueMicrotask(()=>{if(!event.defaultPrevented&&(!event.target.target||event.target.target==='_self')&&event.target.method!=='dialog'){leaving=true;wake();setTimeout(()=>{leaving=false;wake();},12000);}});});
 doc.addEventListener('scroll',wake,{passive:true,capture:true});window.addEventListener('resize',wake);
 const size=new ResizeObserver(wake);size.observe(doc.body);size.observe(root);
 // Limit observer work to transfer/busy state, embedded navigation and replacement of the current control.
 const selector='progress,[aria-busy=true],.noa-track-progress,#noa-shell-view,.nl-play-shell';
 new MutationObserver(records=>{
  for(const r of records){
   if(r.target===bar||r.target===fill)continue;
   if(r.type==='attributes'){
    if(r.attributeName==='aria-busy'||r.target.matches(selector+',#jukebox-transfer-dock,html')){wake();return;}
   }else if([...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches(selector)||n.querySelector(selector)))){wake();return;}
  }
 }).observe(doc.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','value','max','aria-busy','data-phase']});
 doc.addEventListener('load',e=>{if(e.target.tagName==='IFRAME')wake();},true);wake();
})();
