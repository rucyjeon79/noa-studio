// User-owned references share the same GnuBoard account on web and Android.
(() => {
 const el=id=>document.getElementById(id),status=el('my-status'),picker=el('my-select'),title=el('my-title');
 let csrf='',items=[],id=crypto.randomUUID(),revision=0,working=null,busy=false;
 const deleteButton=el('my-delete');if(deleteButton)deleteButton.style.color='var(--noa-danger)';
 function syncDelete(){if(deleteButton)deleteButton.disabled=busy||!items.some(p=>p.playlist_id===id);}
 function setBusy(value){busy=value;for(const name of ['my-new','my-add','my-remove','my-save','my-play'])el(name).disabled=value;picker.disabled=value;title.disabled=value;renderOrder();}
 function selectWorking(play=false){
  if(!working?.length){status.textContent='담긴 음악이 없습니다.';return}
  activeQueue=[...working];filter();
  const first=queue()[0]||filteredQueue[0];status.textContent='등록 '+working.length+'개 · 현재 재생 가능 '+queue().length+'개';
  if(first)select(first,play);
 }
 async function refresh(preserveDraft=false){
  try{
   const response=await fetch('/noa-bridge/user-playlists.php',{credentials:'same-origin'});
   if(response.status===401){status.textContent='로그인하면 내 플레이리스트를 저장할 수 있습니다.';el('my-login').hidden=false;el('my-controls').hidden=true;syncDelete();return false}
   if(response.status===403){status.textContent='목록 접근 권한을 확인할 수 없습니다.';el('my-controls').hidden=true;syncDelete();return false}
   if(!response.ok)throw Error('load');
   const data=await response.json();
   if(typeof data.csrf!=='string'||!Array.isArray(data.items))throw Error('invalid_response');
   csrf=data.csrf;items=data.items;picker.replaceChildren(new Option('새 플레이리스트',''));
   items.forEach(p=>picker.add(new Option(p.title,p.playlist_id)));
   const current=items.find(p=>p.playlist_id===id);
   picker.value=current?id:'';
   if(!preserveDraft){if(current){revision=current.revision;working=[...current.tracks];title.value=current.title;}
   else if(picker.value===''){revision=0;}}

   el('my-login').hidden=true;el('my-controls').hidden=false;renderOrder();status.textContent='내 계정에 저장된 목록 '+items.length+'개';return true;
  }catch{status.textContent='내 플레이리스트를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.';syncDelete();return false}
 }
 picker.addEventListener('change',()=>{
  const item=items.find(p=>p.playlist_id===picker.value);
  if(item){id=item.playlist_id;revision=item.revision;working=[...item.tracks];title.value=item.title;renderOrder();selectWorking()}
  else{id=crypto.randomUUID();revision=0;working=null;title.value='';renderOrder()}
 });
 function renderOrder(){let host=el('my-order');if(!host){host=document.createElement('div');host.id='my-order';host.setAttribute('aria-label','플레이리스트 곡 순서');el('my-controls').append(host);}host.replaceChildren();(working||[]).forEach((key,index)=>{const row=document.createElement('div');row.className='noa-playlist-order-row';const name=document.createElement('span');name.textContent=(index+1)+'. '+(lookup.get(key)?.title||'연결 상태 확인이 필요한 곡');const up=document.createElement('button'),down=document.createElement('button');up.type=down.type='button';up.textContent='↑';down.textContent='↓';up.setAttribute('aria-label',name.textContent+' 위로');down.setAttribute('aria-label',name.textContent+' 아래로');up.disabled=busy||index===0;down.disabled=busy||index===(working.length-1);const move=offset=>{const next=index+offset;[working[index],working[next]]=[working[next],working[index]];renderOrder();status.textContent='순서가 변경되었습니다. 저장하면 반영됩니다.';};up.onclick=()=>move(-1);down.onclick=()=>move(1);row.append(name,up,down);host.append(row);});syncDelete();}
 el('my-new').onclick=()=>{id=crypto.randomUUID();revision=0;working=filteredQueue.filter(b=>lookup.get(b.dataset.key)?.kind!=='playlist').map(b=>b.dataset.key);picker.value='';title.value='';status.textContent='현재 재생 목록 '+working.length+'개를 담았습니다. 이름을 입력하고 저장해 주세요.';title.focus();renderOrder()};
 el('my-add').onclick=()=>{if(!selected)return;working=working||[];if(!working.includes(selected.dataset.key))working.push(selected.dataset.key);status.textContent=working.length+'개 곡 · 저장하면 반영됩니다.';renderOrder()};
 el('my-remove').onclick=()=>{if(!selected)return;working=(working||[]).filter(k=>k!==selected.dataset.key);status.textContent=working.length+'개 곡 · 저장하면 반영됩니다.';renderOrder()};
 el('my-play').onclick=()=>{working=working||filteredQueue.filter(b=>lookup.get(b.dataset.key)?.kind!=='playlist').map(b=>b.dataset.key);selectWorking(true)};
 el('my-save').onclick=async()=>{
  if(busy)return;
  if(!title.value.trim()){status.textContent='목록 이름을 입력해 주세요.';title.focus();return}
  const requestId=id,requestTitle=title.value.trim(),tracks=working||filteredQueue.filter(b=>lookup.get(b.dataset.key)?.kind!=='playlist').map(b=>b.dataset.key);setBusy(true);
  try{
   const response=await fetch('/noa-bridge/user-playlists.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-CSRF':csrf},body:JSON.stringify({id:requestId,title:requestTitle,tracks,expectedRevision:revision})});
   if(response.status===401){status.textContent='로그인 후 다시 저장해 주세요.';el('my-login').hidden=false;return}
   if(response.status===403){const refreshed=await refresh(true);status.textContent=refreshed?'보안 확인을 갱신했습니다. 변경한 순서를 확인하고 다시 저장해 주세요.':'로그인과 연결 상태를 확인한 후 다시 저장해 주세요.';return}
   const result=await response.json();
   if(!response.ok){status.textContent=response.status===409?'다른 곳에서 변경됐습니다. 목록을 다시 열어 확인해 주세요.':result.error==='unknown_track'?'공개 상태나 연결을 확인할 수 없는 곡이 포함되어 있습니다.':'저장하지 못했습니다. 로그인과 연결 상태를 확인해 주세요.';return}
   if(!Number.isInteger(result.revision)||result.revision<1)throw Error('invalid_response');
   revision=result.revision;working=[...tracks];const confirmed=await refresh(),saved=items.find(p=>p.playlist_id===requestId);
   if(!confirmed||!saved||saved.title!==requestTitle||JSON.stringify(saved.tracks)!==JSON.stringify(tracks)||saved.revision!==result.revision){status.textContent='저장 응답을 받았지만 재조회 확인을 마치지 못했습니다. 목록을 다시 불러와 확인해 주세요.';return}
   revision=saved.revision;working=[...saved.tracks];picker.value=requestId;title.value=saved.title;renderOrder();status.textContent='내 플레이리스트 저장 완료 · '+working.length+'개 곡';
  }catch{status.textContent='응답을 확인하지 못했습니다. 같은 내용으로 다시 저장하면 중복 등록을 방지합니다.'}
  finally{setBusy(false)}
 };
 if(deleteButton)deleteButton.onclick=async()=>{
  const current=items.find(p=>p.playlist_id===id);if(busy||!current)return;
  if(!window.confirm('“'+current.title+'” 목록을 삭제할까요?'))return;
  const requestId=id,expectedRevision=revision;setBusy(true);
  try{
   const headers={'Content-Type':'application/json','X-NOA-CSRF':csrf};
   let response=await fetch('/noa-bridge/user-playlists.php',{method:'DELETE',credentials:'same-origin',headers,body:JSON.stringify({id:requestId,expectedRevision})});
   // Some hosting frontends reject DELETE before PHP. Retry only explicit verb rejection.
   if(response.status===405||response.status===501)response=await fetch('/noa-bridge/user-playlists.php',{method:'POST',credentials:'same-origin',headers,body:JSON.stringify({action:'delete',id:requestId,expectedRevision})});
   if(response.status===401){status.textContent='로그인 후 다시 삭제해 주세요.';el('my-login').hidden=false;return}
   if(response.status===403){await refresh(true);status.textContent='보안 확인을 갱신한 후 다시 삭제해 주세요.';return}
   const result=await response.json();
   if(!response.ok){status.textContent=response.status===409?'다른 곳에서 변경된 목록입니다. 다시 열어 확인한 후 삭제해 주세요.':response.status===404?'삭제할 목록을 찾을 수 없습니다. 목록을 다시 불러와 확인해 주세요.':'목록을 삭제하지 못했습니다. 연결 상태를 확인해 주세요.';return}
   if(result.deleted!==true||result.id!==requestId)throw Error('invalid_response');
   const confirmed=await refresh(true);
   if(!confirmed||items.some(p=>p.playlist_id===requestId)){status.textContent='삭제 응답을 받았지만 재조회 확인을 마치지 못했습니다. 목록을 다시 불러와 확인해 주세요.';return}
   id=crypto.randomUUID();revision=0;working=null;title.value='';picker.value='';renderOrder();status.textContent='목록 삭제 및 재조회 확인 완료';
  }catch{status.textContent='삭제 응답을 확인하지 못했습니다. 목록을 다시 불러와 확인해 주세요.'}
  finally{setBusy(false)}
 };

 refresh();
})();

