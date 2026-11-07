<?php
// Included only after the AI LAB member gate. No catalog, job or provider queries.
if(!defined('_GNUBOARD_'))exit;
require_once __DIR__.'/workspaces.php';
?>
<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI LAB | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css"><script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script><script src="/noa-lab-router.js?v=<?=hash_file('sha256',dirname(__DIR__,2).'/noa-lab-router.js')?>" defer></script></head><body class="noa-page"><main data-n80-hub="ai_lab"><h1>AI LAB</h1><p class="noa-muted">곡별 AI 생성은 곡정보창에서, 여러 곡 묶음 처리와 영상 제작은 이곳에서 진행하세요.</p><nav class="creator-actions" style="display:flex;flex-wrap:wrap;gap:8px" aria-label="작업실 이동"><?php if(!empty($access['creator'])):?><a class="noa-button" href="/noa-channel-workspace.php">CREATOR LAB</a><?php endif;?><?php if(!empty($access['admin'])):?><a class="noa-button" href="/noa-library.php">홈페이지 설정</a><?php endif;?></nav><?php n80_workspace_render('ai_lab',$access); ?></main></body></html>
