<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/storage.php';
if(empty($is_member)||($is_admin??'')!=='super'){http_response_code(403);exit('관리자 전용');}
if(empty($_SESSION['noa_category_order_csrf']))$_SESSION['noa_category_order_csrf']=bin2hex(random_bytes(32));
$rows=['story'=>[],'cover'=>[]];
try{
 $db=noa_bridge_pdo();
 foreach($db->query("SELECT doc_key,kind,payload FROM noa_documents WHERE kind IN ('single','story')") as $r){
  $p=json_decode($r['payload'],true);if(!is_array($p))continue;
  $genre=$p['genreId']??'';$group=$genre==='your-story'?'story':($genre==='cover-reborn'?'cover':null);
  if(!$group)continue;
  $title=$p['body']['confirmedTitle']??$p['title']??$r['doc_key'];
  $rows[$group][]=['key'=>(string)$r['doc_key'],'title'=>(string)$title];
 }
}catch(Throwable $e){error_log('[category-order-admin] '.get_class($e));http_response_code(503);exit('목록을 불러오지 못했습니다.');}
function esc(string $s):string{return htmlspecialchars($s,ENT_QUOTES|ENT_SUBSTITUTE,'UTF-8');}
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>카테고리 순서 관리 | NOA</title><link rel="stylesheet" href="/noa-ui.css"><style>
main{max-width:760px;margin:auto;padding:20px}.order-list{list-style:none;padding:0;margin:10px 0 20px}.order-list li{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--noa-line)}.order-list li span{flex:1;min-width:0;overflow-wrap:anywhere}.order-list button{min-width:44px;min-height:44px}.order-list li[draggable=true]{cursor:grab}.order-list li.dragging{opacity:.45}section{margin:24px 0}#status{min-height:24px}
</style></head><body class="noa-page"><main><a href="/noa-library.php">← 관리자</a><h1>사연곡·커버곡 순서 관리</h1><p>끌어서 이동하거나 ↑ ↓ 버튼으로 순서를 조정한 뒤 저장하세요.</p>
<?php foreach(['story'=>'당신의 이야기, 우리의 음악','cover'=>'AInoa의 유명곡 커버'] as $group=>$label):?>
<section data-group="<?=esc($group)?>"><h2><?=esc($label)?></h2><ol class="order-list"><?php foreach($rows[$group] as $item):?><li draggable="true" data-key="<?=esc($item['key'])?>"><span><?=esc($item['title'])?></span><button type="button" class="up" aria-label="위로 이동">↑</button><button type="button" class="down" aria-label="아래로 이동">↓</button></li><?php endforeach;?></ol><button type="button" class="save">순서 저장</button></section>
<?php endforeach;?><p id="status" role="status"></p></main><script>
const token=<?=json_encode($_SESSION['noa_category_order_csrf'],JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT)?>;
const status=document.querySelector('#status');
async function start(){
 const r=await fetch('/noa-category-order.php',{credentials:'same-origin'});if(!r.ok)throw Error('순서 불러오기 실패');
 const saved=await r.json();
 for(const section of document.querySelectorAll('section[data-group]')){
  const list=section.querySelector('ol'),order=saved[section.dataset.group]||[],items=[...list.children];
  const rank=new Map(order.map((k,i)=>[k,i]));
  items.sort((a,b)=>(rank.get(a.dataset.key)??Number.MAX_SAFE_INTEGER)-(rank.get(b.dataset.key)??Number.MAX_SAFE_INTEGER));
  list.replaceChildren(...items);
  let dragged=null;
  list.addEventListener('dragstart',e=>{dragged=e.target.closest('li');if(dragged)dragged.classList.add('dragging');});
  list.addEventListener('dragover',e=>{if(!dragged)return;e.preventDefault();const target=e.target.closest('li');if(target&&target!==dragged){const rect=target.getBoundingClientRect();list.insertBefore(dragged,e.clientY<rect.top+rect.height/2?target:target.nextSibling);}});
  list.addEventListener('dragend',()=>{dragged?.classList.remove('dragging');dragged=null;});
  list.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const li=b.closest('li');if(b.classList.contains('up')&&li.previousElementSibling)list.insertBefore(li,li.previousElementSibling);if(b.classList.contains('down')&&li.nextElementSibling)list.insertBefore(li.nextElementSibling,li);});
  section.querySelector('.save').onclick=async()=>{const keys=[...list.children].map(x=>x.dataset.key);status.textContent='저장 중…';try{const response=await fetch('/noa-category-order.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify({group:section.dataset.group,keys})});if(!response.ok)throw Error('저장 실패 '+response.status);status.textContent='순서가 저장되었습니다.';}catch(err){status.textContent=err.message;}};
 }
}
start().catch(e=>status.textContent=e.message);
</script></body></html>
