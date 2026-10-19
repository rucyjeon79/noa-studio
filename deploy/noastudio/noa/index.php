<?php
declare(strict_types=1);
require __DIR__ . '/boot.php';
require __DIR__ . '/lib.php';
$member = noa_member();
$name = trim((string) ($member['mb_nick'] ?? $member['mb_id'] ?? ''));
$edit = noa_can_edit();
?><!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NOA STUDIO</title>
  <link rel="stylesheet" href="studio.css">
</head>
<body>
<header>
  <h1>NOA <span>STUDIO</span></h1>
  <p class="who">
    <?php if ($name !== ''): ?>
      <?= noa_h($name) ?> · <a href="/bbs/logout.php">로그아웃</a>
    <?php else: ?>
      <a href="/bbs/login.php?url=/">그누보드 로그인</a>
    <?php endif; ?>
    · <a href="/adm/">관리자</a>
  </p>
</header>
<div id="shell">
  <nav id="genres"></nav>
  <main id="list"></main>
</div>
<aside id="result" hidden></aside>
<footer id="box">
  <button type="button" id="play">재생</button>
  <span id="now">곡을 고르면 여기서 재생합니다.</span>
  <audio id="audio" preload="none"></audio>
</footer>
<script>
window.NOA = { edit: <?= $edit ? 'true' : 'false' ?>, token: <?= json_encode(noa_token(), JSON_UNESCAPED_UNICODE) ?> };
</script>
<script src="studio.js"></script>
</body>
</html>
