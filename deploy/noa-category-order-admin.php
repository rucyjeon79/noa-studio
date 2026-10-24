<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
require_once __DIR__.'/noa-bridge/sound-core.php';
require_once __DIR__.'/noa-app/jukebox/core.php';
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('관리자 전용');}
if(empty($_SESSION['noa_category_order_csrf']))$_SESSION['noa_category_order_csrf']=bin2hex(random_bytes(32));
$rows=['story'=>[],'cover'=>[]];
try{
 $db=noa_bridge_pdo();$aliases=[];foreach($db->query("SELECT alias_key,entity_id FROM noa_catalog_aliases WHERE batch_id=(SELECT batch_id FROM noa_catalog_batches WHERE status='applied' ORDER BY applied_at DESC,batch_id DESC LIMIT 1)") as $a)$aliases[$a['alias_key']][]=$a['entity_id'];
 foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story')") as $r){
  $p=json_decode($r['payload'],true);if(!is_array($p))continue;
  $genre=$p['genreId']??'';$group=$genre==='your-story'?'story':($genre==='cover-reborn'?'cover':null);
  if(!$group||(int)($p['ep']??0)>0)continue;
  $title=$p['body']['confirmedTitle']??$p['title']??$r['doc_key'];
  $ids=array_unique($aliases[$r['doc_key']]??[]);$key=count($ids)===1?array_values($ids)[0]:(string)$r['doc_key'];
  $rows[$group][$key]=['key'=>$key,'title'=>(string)$title];
 }
 foreach(nj_catalog($db) as $key=>$p){$genre=$p['genreId']??'';$group=$genre==='your-story'?'story':($genre==='cover-reborn'?'cover':null);if(!$group||(int)($p['ep']??0)>0)continue;$id=str_starts_with($key,'catalog:')?substr($key,8):$key;$rows[$group][$id]??=['key'=>$id,'title'=>(string)($p['body']['confirmedTitle']??$p['title']??$key)];}
}catch(Throwable $e){error_log('[category-order-admin] '.get_class($e));http_response_code(503);exit('목록을 불러오지 못했습니다.');}
function esc(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>카테고리 순서 관리 | NOA</title><link rel="stylesheet" href="/noa-ui.css?v=20261024-category-complete"><script src="/noa-ui.js?v=20261024-approved-ui" data-noa-theme-only defer></script><style>
main{max-width:760px;margin:auto;padding:20px}.order-list{list-style:none;padding:0;margin:10px 0 20px}.order-list li{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--noa-line)}.order-list li span{flex:1;min-width:0;overflow-wrap:anywhere}.order-list button{min-width:44px;min-height:44px}.order-list li[draggable=true]{cursor:grab}.order-list li.dragging{opacity:.45}section{margin:24px 0}#status{min-height:24px}
</style></head><body class="noa-page"><main><a href="/noa-library.php">← 관리자</a><h1>사연곡·커버곡 순서 관리</h1><p>끌어서 이동하거나 ↑ ↓ 버튼으로 순서를 조정한 뒤 저장하세요.</p>
<?php foreach(['story'=>'당신의 이야기, 우리의 음악','cover'=>'AInoa의 유명곡 커버'] as $group=>$label):?>
<section data-group="<?=esc($group)?>"><h2><?=esc($label)?></h2><ol class="order-list"><?php foreach($rows[$group] as $item):?><li draggable="true" data-key="<?=esc($item['key'])?>"><span><?=esc($item['title'])?></span><button type="button" class="up" aria-label="위로 이동">↑</button><button type="button" class="down" aria-label="아래로 이동">↓</button></li><?php endforeach;?></ol><button type="button" class="save">순서 저장</button></section>
<?php endforeach;?><p id="status" role="status"></p></main><script>
const token=<?=json_encode($_SESSION['noa_category_order_csrf'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?>;
const status=document.querySelector('#status');let savedOrder={story:[],cover:[]};
async function start(){
 const r=await fetch('/noa-category-order.php',{credentials:'same-origin'});if(!r.ok)throw Error('순서 불러오기 실패');
 const saved=await r.json();savedOrder=saved;
 for(const section of document.querySelectorAll('section[data-group]')){
  const list=section.querySelector('ol'),order=saved[section.dataset.group]||[],items=[...list.children];
  const rank=new Map(order.map((k,i)=>[k,i]));
  items.sort((a,b)=>(rank.get(a.dataset.key)??Number.MAX_SAFE_INTEGER)-(rank.get(b.dataset.key)??Number.MAX_SAFE_INTEGER));
  list.replaceChildren(...items);
  let dragged=null;
  list.addEventListener('dragstart',e=>{dragged=e.target.closest('li');if(dragged){dragged.classList.add('dragging');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragged.dataset.key);}});
  list.addEventListener('dragover',e=>{if(dragged)e.preventDefault();});
  list.addEventListener('drop',e=>{if(!dragged)return;e.preventDefault();const target=e.target.closest('li');if(target&&target!==dragged){const rect=target.getBoundingClientRect();list.insertBefore(dragged,e.clientY<rect.top+rect.height/2?target:target.nextSibling);}});
  list.addEventListener('dragend',()=>{dragged?.classList.remove('dragging');dragged=null;});
  list.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const li=b.closest('li');if(b.classList.contains('up')&&li.previousElementSibling)list.insertBefore(li,li.previousElementSibling);if(b.classList.contains('down')&&li.nextElementSibling)list.insertBefore(li.nextElementSibling,li);});
  section.querySelector('.save').onclick=async()=>{const keys=[...list.children].map(x=>x.dataset.key);status.textContent='저장 중…';try{const response=await fetch('/noa-category-order.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({group:section.dataset.group,keys})});const result=await response.json();if(!response.ok||result.ok!==true)throw Error('저장 실패 '+response.status);const check=await fetch('/noa-category-order.php',{credentials:'same-origin',cache:'no-store'});if(!check.ok)throw Error('저장 결과 확인 실패');const confirmed=await check.json();if(JSON.stringify(confirmed[section.dataset.group])!==JSON.stringify(keys))throw Error('저장 순서가 일치하지 않습니다. 다시 불러와 확인하세요.');savedOrder=confirmed;status.textContent='순서 저장 및 재조회 확인 완료';}catch(err){status.textContent=err.message;}};
 }
}
start().catch(e=>status.textContent=e.message);
</script></body></html>
