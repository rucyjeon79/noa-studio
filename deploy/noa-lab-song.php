<?php
if (!defined('_GNUBOARD_') || empty($access['admin'])) { http_response_code(403); exit; }
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>곡별 AI 제작 | AI LAB</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-record-form.css">
<?php foreach (['noa-brand','noa-ui','noa-browse','noa-record-form','noa-browse-edit'] as $asset): ?>
<script defer src="/<?=$asset?>.js?v=<?=hash_file('sha256',__DIR__.'/'.$asset.'.js')?>"></script>
<?php endforeach; ?></head><body class="noa-page"><main><p>N80 AI LAB</p><?php n80_lab_nav($access,'song'); ?><h1>곡별 AI 제작</h1>
<label>제작할 곡 <select id="lab-pick"><option value="">곡 선택</option></select></label>
<button class="noa-button" type="button" id="lab-pick-load">곡 목록 불러오기</button><p id="lab-pick-status" role="status"></p>
<div class="noa-record-editor" id="lab-record"></div></main>
<script>
document.addEventListener('DOMContentLoaded',()=>{
 const params=new URLSearchParams(location.search),pick=document.getElementById('lab-pick'),load=document.getElementById('lab-pick-load'),status=document.getElementById('lab-pick-status');
 const editor=NoaBrowseEdit.mount({host:document.getElementById('lab-record'),standalone:true,labGeneration:true});
 const selector={};
 for(const key of ['type','source','key','genre','act','id'])if(params.has(key))selector[key]=params.get(key);
 if(['song','act','playlist'].includes(selector.type))editor.openRecord(selector);
 load.onclick=async()=>{
  load.disabled=true;
  try{
   const response=await fetch('/noa-bridge/catalog.php?view=labChoices');
   if(!response.ok)throw Error();
   const {items}=await response.json();
   pick.replaceChildren(new Option('곡 선택',''),...items.map(t=>new Option([t.genre,t.title].join(' · '),t.key)));
   load.hidden=true;status.textContent=items.length?'':'등록된 곡이 없습니다.';pick.focus();
  }catch{status.textContent='곡 목록을 불러오지 못했어요. 다시 눌러 주세요.';}finally{load.disabled=false;}
 };
 pick.onchange=()=>{if(pick.value)editor.openRecord({type:'song',source:'music',key:pick.value});};
});
</script></body></html>
