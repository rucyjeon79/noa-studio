<?php
if (!defined('_GNUBOARD_') || empty($access['admin'])) { http_response_code(403); exit; }
require_once __DIR__.'/noa-app/engine/explorer.php';
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>곡별 AI 제작 | AI LAB</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-record-form.css">
<?php n80_explorer_assets(); ?>
<?php foreach (['noa-brand','noa-ui','noa-browse','noa-record-form','noa-browse-edit'] as $asset): ?>
<script defer src="/<?=$asset?>.js?v=<?=hash_file('sha256',__DIR__.'/'.$asset.'.js')?>"></script>
<?php endforeach; ?></head><body class="noa-page"><main><p>N80 AI LAB</p><?php n80_lab_nav($access,'song'); ?><h1>곡별 AI 제작</h1>
<?php n80_explorer_picker('lab-song','lab-pick','제작할 곡'); ?>
<div class="noa-record-editor" id="lab-record"></div></main>
<script>
document.addEventListener('DOMContentLoaded',()=>{
 const params=new URLSearchParams(location.search),pick=document.getElementById('lab-pick');
 const editor=NoaBrowseEdit.mount({host:document.getElementById('lab-record'),standalone:true,labGeneration:true});
 const selector={};
 for(const key of ['type','source','key','genre','act','id'])if(params.has(key))selector[key]=params.get(key);
 if(['song','act','playlist'].includes(selector.type))editor.openRecord(selector);
 N80Explorer.picker(document.getElementById('lab-song-picker'));
 pick.onchange=()=>{if(pick.value)editor.openRecord({type:'song',source:'music',key:pick.value});};
});
</script></body></html>
