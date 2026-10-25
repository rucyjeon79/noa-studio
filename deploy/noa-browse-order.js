/* Administrator playlist ordering. Draft DOM moves never select or restart audio. */
(()=>{'use strict';
if(window.NoaBrowseOrder)return;
const canonical=r=>String(r.orderKey||r.key).replace(/^catalog:/,'');
const paths={order:'M8 3v18m-4-4 4 4 4-4M16 21V3m-4 4 4-4 4 4',save:'M5 3h12l4 4v14H3V3h2Zm2 0v6h10V3M7 21v-8h10v8',cancel:'m6 6 12 12M6 18 18 6',move:'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01'};
function control(icon,label,name){const b=document.createElement('button');b.type='button';b.className='noa-action noa-order-'+icon;b.setAttribute('aria-label',name||label);b.innerHTML='<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="'+paths[icon]+'"/></svg>';const span=document.createElement('span');span.textContent=label;b.append(span);return b;}
function mount({host,rows,kind,access,getOrder,getGroup,onSaved}){
 const rowSelector='.noa-inline-song-row,.noa-inline-video-row';const lookup=new Map(rows.map(r=>[String(r.key),r]));let current=null,lastSaved='';
 const style=document.createElement('style');style.textContent='.noa-order-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;grid-column:1/-1;min-width:0}.noa-order-heading>h2{flex:1;min-width:0}.noa-order-controls{display:flex;align-items:center;gap:4px;flex:none}.noa-order-controls .noa-action,.noa-order-move.noa-action{min-width:44px;min-height:52px;padding:4px 6px}.noa-order-status{grid-column:1/-1;flex-basis:100%;color:var(--noa-muted);font-size:12px;min-height:1.5em}.noa-order-list .noa-song-actions{display:none}.noa-order-list .noa-inline-song:disabled{opacity:1;cursor:default}.noa-order-move{touch-action:none;user-select:none;cursor:grab}.noa-order-move:active{cursor:grabbing}.noa-order-dragging{opacity:.55;outline:2px solid var(--noa-accent);outline-offset:-2px}.noa-order-list :is(.noa-inline-song-row,.noa-inline-video-row){user-select:none}.noa-order-list .noa-inline-video-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.noa-order-list .noa-inline-video-row>.noa-inline-song{flex:1;min-width:0;width:auto}.noa-inline-video-row>.noa-inline-playback{width:100%;flex-basis:100%}.noa-order-controls button:disabled{opacity:.5}';document.head.append(style);
 function refresh(){
  const section=host.querySelector('[data-browse-level="3"]'),group=getGroup(),heading=section?.querySelector('h2');
  const list=[...section?.querySelectorAll('.noa-inline-songs')||[]].find(list=>{const items=[...list.querySelectorAll(rowSelector)];return items.length>1&&items.every(n=>{const r=lookup.get(n.dataset.inlineKey);return r&&!(Number(r.ep)>0)&&!(Number(r.act)>0)&&((group==='story'&&r.genre==='your-story')||(group==='cover'&&r.genre==='cover-reborn'));});});
  if(!heading||!list||!['story','cover'].includes(group)){current=null;return;}
  if(current?.heading===heading)return;
  current=null;
  const header=document.createElement('div');header.className='noa-order-heading';heading.before(header);header.append(heading);
  const controls=document.createElement('div');controls.className='noa-order-controls';header.append(controls);
  const order=control('order','순서',kind==='영상'?'플레이리스트 영상 순서 변경':'플레이리스트 곡 순서 변경'),save=control('save','저장','플레이리스트 순서 저장'),cancel=control('cancel','취소','순서 변경 취소');save.hidden=true;cancel.hidden=true;order.setAttribute('aria-expanded','false');controls.append(order,save,cancel);
  const status=document.createElement('p');status.className='noa-order-status';status.setAttribute('role','status');status.hidden=true;if(lastSaved===group){status.hidden=false;status.textContent='순서를 저장했습니다.';lastSaved='';}header.after(status);
  const state={heading,list,group,editing:false,busy:false,drag:null,baseline:[],original:[],disabled:new Map()};current=state;
  function moveNode(node,before){if(typeof list.moveBefore==='function'&&node.isConnected)list.moveBefore(node,before);else list.insertBefore(node,before);}
  function restoreNodes(items){for(const node of items)moveNode(node,null);}
  const nodes=()=>[...list.querySelectorAll(':scope>.noa-inline-song-row,:scope>.noa-inline-video-row')];
  function reset(restore){if(state.drag)finishDrag(false);if(restore)restoreNodes(state.original);for(const node of nodes()){node.querySelector('.noa-order-move')?.remove();const title=node.querySelector('.noa-inline-song');title.disabled=state.disabled.get(title)||false;}list.classList.remove('noa-order-list');state.editing=false;order.hidden=false;save.hidden=true;cancel.hidden=true;order.setAttribute('aria-expanded','false');}
  order.onclick=()=>{if(state.busy)return;state.editing=true;state.original=nodes();state.baseline=[...(getOrder()[group]||[])];list.classList.add('noa-order-list');order.hidden=true;save.hidden=false;cancel.hidden=false;order.setAttribute('aria-expanded','true');status.hidden=false;status.textContent='이동 손잡이를 끌어 순서를 바꾼 뒤 저장하세요. 키보드는 위·아래 방향키를 사용하세요.';
   for(const node of state.original){const title=node.querySelector('.noa-inline-song');state.disabled.set(title,title.disabled);title.disabled=true;const handle=control('move','이동',(lookup.get(node.dataset.inlineKey)?.title||'곡')+' 순서 이동');handle.addEventListener('pointerdown',event=>{if(state.busy||event.button!==0)return;event.preventDefault();state.drag={node,id:event.pointerId,handle,previous:nodes()};handle.setPointerCapture(event.pointerId);node.classList.add('noa-order-dragging');});handle.addEventListener('pointermove',event=>{if(!state.drag||state.drag.id!==event.pointerId)return;event.preventDefault();const target=document.elementFromPoint(event.clientX,event.clientY)?.closest(rowSelector);if(target&&target.parentElement===list&&target!==node){const rect=target.getBoundingClientRect();moveNode(node,event.clientY<rect.top+rect.height/2?target:target.nextElementSibling);}if(event.clientY<90)window.scrollBy(0,-14);else if(event.clientY>innerHeight-110)window.scrollBy(0,14);});handle.addEventListener('pointerup',()=>finishDrag(true));handle.addEventListener('pointercancel',()=>finishDrag(false));handle.addEventListener('keydown',event=>{if(state.busy||!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();if(event.key==='ArrowUp'&&node.previousElementSibling)moveNode(node,node.previousElementSibling);if(event.key==='ArrowDown'&&node.nextElementSibling)moveNode(node.nextElementSibling,node);status.textContent='순서를 변경했습니다. 저장을 눌러 반영하세요.';handle.focus();});node.prepend(handle);}
  };
  function finishDrag(keep){const drag=state.drag;if(!drag)return;state.drag=null;if(!keep)restoreNodes(drag.previous);drag.node.classList.remove('noa-order-dragging');if(drag.handle.hasPointerCapture(drag.id))drag.handle.releasePointerCapture(drag.id);status.textContent=keep?'순서를 변경했습니다. 저장을 눌러 반영하세요.':'이동을 취소했습니다.';}
  cancel.onclick=()=>{if(state.busy)return;reset(true);status.textContent='순서 변경을 취소했습니다.';};
  save.onclick=async()=>{
   if(state.busy||!state.editing)return;if(state.drag)finishDrag(true);
   const draft=nodes().map(n=>canonical(lookup.get(n.dataset.inlineKey))),visible=new Set(draft);if(visible.size!==draft.length){status.textContent='중복 연결된 곡은 관리자 순서 관리에서 확인해 주세요.';return;}
   let index=0;const keys=state.baseline.map(key=>visible.has(key)?draft[index++]:key);keys.push(...draft.slice(index));
   state.busy=true;save.disabled=true;cancel.disabled=true;for(const n of list.querySelectorAll('.noa-order-move'))n.disabled=true;status.textContent='순서를 저장하는 중입니다.';
   try{
    const response=await fetch('/noa-category-order.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':access.csrf},body:JSON.stringify({group,keys,expected:state.baseline})});const data=await response.json();if(!response.ok||data.ok!==true)throw Error(response.status===409?'다른 관리자가 순서를 변경했습니다. 취소 후 새로고침해 다시 편집하세요.':'저장하지 못했습니다. 다시 시도해 주세요.');
    const check=await fetch('/noa-category-order.php',{credentials:'same-origin',cache:'no-store'});if(!check.ok)throw Error('저장 결과를 확인하지 못했습니다. 다시 시도해 주세요.');const confirmed=await check.json();if(JSON.stringify(confirmed[group])!==JSON.stringify(keys))throw Error('저장된 순서가 변경되었습니다. 새로고침해 확인해 주세요.');
    lastSaved=group;if(current===state){reset(false);status.textContent='순서를 저장했습니다.';}onSaved(confirmed);
   }catch(error){status.textContent=error.message;}finally{state.busy=false;save.disabled=false;cancel.disabled=false;for(const n of list.querySelectorAll('.noa-order-move'))n.disabled=false;}
  };
 }
 return{refresh,isEditing:()=>!!current?.editing};
}
window.NoaBrowseOrder={mount};
})();
