<?php
if (!defined('_GNUBOARD_') || empty($access['member'])) { http_response_code(403); exit; }
$listening=$tool==='listen';
?><!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI LAB | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><link rel="stylesheet" href="/noa-ainoa.css"><link rel="stylesheet" href="/noa-listening.css">
<?php foreach (array_merge(['noa-brand','noa-ui','noa-ainoa'],$listening?['noa-listening-model','noa-listening']:[]) as $asset): ?>
<script defer src="/<?=$asset?>.js?v=<?=hash_file('sha256',__DIR__.'/'.$asset.'.js')?>"></script>
<?php endforeach; ?></head><body class="noa-page"><main><h1>AI LAB</h1>
<?php n80_lab_nav($access,$tool); ?>
<?php if($listening):?><section id="noa-listening" data-noa-lab-listening data-noa-listening="home" aria-label="AI 음악 추천"></section><?php else:?>
<h2>곡 이야기</h2><button class="noa-button" id="lab-chat-open" type="button">곡을 골라 대화하기</button>
<?php if($access['admin']):?><button class="noa-button" id="lab-admin-open" type="button">N80 AI 제작 대화</button><?php endif;?>
<p id="lab-chat-status" role="status"></p><script>
document.addEventListener('DOMContentLoaded',()=>{
 const params=new URLSearchParams(location.search);
 const record=params.has('key')?{key:params.get('key'),title:params.get('title')||'선택한 곡'}:null;
 const launch=mode=>window.NoaAInoa.openLab(mode,record).catch(()=>{document.getElementById('lab-chat-status').textContent='대화창 연결을 확인한 뒤 다시 눌러 주세요.';});
 document.getElementById('lab-chat-open').onclick=()=>launch('song');
 const admin=document.getElementById('lab-admin-open');if(admin)admin.onclick=()=>launch('admin');
 if(params.get('mode')==='song'||(admin&&params.get('mode')==='admin'))launch(params.get('mode'));
});
</script><?php endif;?></main></body></html>
