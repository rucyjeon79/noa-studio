<?php
declare(strict_types=1);
require __DIR__ . '/boot.php';
require __DIR__ . '/lib.php';
$genre = (string) ($_GET['g'] ?? '');
if (!noa_genre_ok($genre)) {
    header('Location: index.php');
    exit;
}
$label = noa_genres()[$genre];
?><!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= noa_h($label) ?></title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <div>
    <h1><?= noa_h($label) ?></h1>
    <nav class="sub"><a href="index.php">장르</a></nav>
  </div>
</header>
<main class="list">
  <?php foreach (noa_act_files($genre) as $n => $path): ?>
    <?php $row = noa_read_json($path) ?? []; ?>
    <a class="row" href="act.php?g=<?= rawurlencode($genre) ?>&a=<?= (int) $n ?>">
      <span>Act.<?= (int) $n ?> · <?= noa_h(noa_title($row)) ?></span>
      <span class="badge">플레이리스트</span>
    </a>
  <?php endforeach; ?>
  <?php foreach (noa_song_files($genre) as $rel => $path): ?>
    <?php $row = noa_read_json($path) ?? []; $pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : []; ?>
    <a class="row" href="song.php?g=<?= rawurlencode($genre) ?>&k=<?= rawurlencode($rel) ?>">
      <span><?= noa_h(noa_title($row)) ?></span>
      <span class="badge"><?= !empty($row['confirmed']) ? '확정' : (trim((string) ($pkg['youtubeUrl'] ?? '')) !== '' ? '영상' : '') ?></span>
    </a>
  <?php endforeach; ?>
</main>
</body>
</html>
