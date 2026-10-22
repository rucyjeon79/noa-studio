// User-owned references share the same GnuBoard account on web and Android.
(() => {
 const el=id=>document.getElementById(id),status=el('my-status'),picker=el('my-select'),title=el('my-title');
 let csrf='',items=[],id=crypto.randomUUID(),revision=0,working=null;
 function selectWorking(play=false){
  if(!working?.length){status.textContent='담긴 음악이 없습니다.';return}
  activeQueue=[...working];genre.value='';type.value='';search.value='';filter();
  const first=queue()[0]||filteredQueue[0];status.textContent='등록 '+working.length+'개 · 현재 재생 가능 '+queue().length+'개';
  if(first)select(first,play);
 }
 async function refresh(){
  try{
   const response=await fetch('/noa-bridge/user-playlists.php',{credentials:'same-origin'});
   if(response.status===401||response.status===403){status.textContent='로그인하면 내 플레이리스트를 저장할 수 있습니다.';el('my-login').hidden=false;el('my-controls').hidden=true;return}
   if(!response.ok)throw Error('load');
   const data=await response.json();
   csrf=data.csrf;items=data.items;picker.replaceChildren(new Option('새 플레이리스트',''));
   items.forEach(p=>picker.add(new Option(p.title,p.playlist_id)));
   picker.value=items.some(p=>p.playlist_id===id)?id:'';
   el('my-controls').hidden=false;status.textContent='내 계정에 저장된 목록 '+items.length+'개';
  }catch{status.textContent='내 플레이리스트를 불러오지 못했습니다. 잠시 후 다시 열어 주세요.'}
 }
 picker.addEventListener('change',()=>{
  const item=items.find(p=>p.playlist_id===picker.value);
  if(item){id=item.playlist_id;revision=item.revision;working=[...item.tracks];title.value=item.title;selectWorking()}
  else{id=crypto.randomUUID();revision=0;working=null;title.value=''}
 });
 el('my-new').onclick=()=>{id=crypto.randomUUID();revision=0;working=filteredQueue.filter(b=>lookup.get(b.dataset.key)?.kind!=='playlist').map(b=>b.dataset.key);picker.value='';title.value='';status.textContent='현재 재생 목록 '+working.length+'개를 담았습니다. 이름을 입력하고 저장해 주세요.';title.focus()};
 el('my-add').onclick=()=>{if(!selected)return;working=working||[];if(!working.includes(selected.dataset.key))working.push(selected.dataset.key);status.textContent=working.length+'개 곡 · 저장하면 반영됩니다.'};
 el('my-remove').onclick=()=>{if(!selected)return;working=(working||[]).filter(k=>k!==selected.dataset.key);status.textContent=working.length+'개 곡 · 저장하면 반영됩니다.'};
 el('my-play').onclick=()=>{working=working||filteredQueue.filter(b=>lookup.get(b.dataset.key)?.kind!=='playlist').map(b=>b.dataset.key);selectWorking(true)};
 el('my-save').onclick=async()=>{
  if(!title.value.trim()){status.textContent='목록 이름을 입력해 주세요.';title.focus();return}
  const tracks=working||filteredQueue.filter(b=>lookup.get(b.dataset.key)?.kind!=='playlist').map(b=>b.dataset.key);el('my-save').disabled=true;
  try{
   const response=await fetch('/noa-bridge/user-playlists.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-NOA-CSRF':csrf},body:JSON.stringify({id,title:title.value.trim(),tracks,expectedRevision:revision})});const result=await response.json();
   if(!response.ok){status.textContent=response.status===409?'다른 곳에서 변경됐습니다. 목록을 다시 열어 확인해 주세요.':'저장하지 못했습니다. 로그인과 연결 상태를 확인해 주세요.';return}
   revision=result.revision;working=[...tracks];await refresh();status.textContent='내 플레이리스트 저장 완료 · '+working.length+'개 곡';
  }catch{status.textContent='응답을 확인하지 못했습니다. 같은 내용으로 다시 저장하면 중복 등록을 방지합니다.'}
  finally{el('my-save').disabled=false}
 };
 refresh();
})();
