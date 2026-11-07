<?php
declare(strict_types=1);
require_once __DIR__.'/common.php';
require_once __DIR__.'/noa-bridge/member-access.php';
require_once __DIR__.'/noa-channel-menu.php';

$access = nam_access((array)$member, (string)($is_admin ?? ''));
if (!$access['creator']) { http_response_code(403); exit; }
header('Cache-Control: private, no-store');
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
$escape = static fn($value) => htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
require_once __DIR__.'/noa-app/engine/workspaces.php';
?>
<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CREATOR LAB | NOA STUDIO</title><link rel="stylesheet" href="/noa-ui.css">
<link rel="stylesheet" href="/noa-creator.css?v=<?=filemtime(__DIR__.'/noa-creator.css')?>">
<script src="/noa-brand.js" defer></script><script src="/noa-ui.js" defer></script>
</head><body class="noa-page"><main id="noa-my-channel">
<h1 id="workspace-title">CREATOR LAB</h1>
<p class="noa-muted">곡과 음원, 채널을 관리하세요.</p>
<nav class="creator-actions" aria-label="작업실 이동"><a class="noa-button" href="/noa-channel.php?id=<?=hash('sha256',(string)$member['mb_id'])?>">내 채널 보기</a><a class="noa-button" href="/noa-ai-lab.php">AI LAB</a><?php if($access['admin']):?><a class="noa-button" href="/noa-library.php">홈페이지 설정</a><?php endif;?></nav>
<?php n80_workspace_render('creator_lab',$access); ?>
</main></body></html>
