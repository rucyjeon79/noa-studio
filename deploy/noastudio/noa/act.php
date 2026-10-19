<?php
declare(strict_types=1);
require __DIR__ . '/boot.php';
require __DIR__ . '/lib.php';
$genre = (string) ($_GET['g'] ?? '');
$act = (int) ($_GET['a'] ?? 0);
$files = noa_genre_ok($genre) ? noa_act_files($genre) : [];
$path = $files[$act] ?? '';
$row = $path !== '' ? noa_read_json($path) : null;
if ($row === null) {
    header('Location: index.php');
    exit;
}
$pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : [];
$yt = trim((string) ($pkg['youtubeUrl'] ?? ''));
$ytId = noa_yt_id($yt);
$notice = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!noa_can_edit() || !noa_token_ok((string) ($_POST['token'] ?? ''))) {
        $notice = '수정 권한이 없습니다.';
    } else {
        $fields = [];
        foreach (noa_fields() as $name) {
            if (isset($_POST[$name])) {
                $fields[$name] = (string) $_POST[$name];
            }
        }
        if (noa_write_fields($path, $fields, null)) {
            $row = noa_read_json($path) ?? $row;
            $pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : [];
            $yt = trim((string) ($pkg['youtubeUrl'] ?? ''));
            $ytId = noa_yt_id($yt);
            $notice = '파일에 저장했습니다.';
        } else {
            $notice = '파일에 쓰지 못했습니다.';
        }
    }
}
?><!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Act.<?= (int) $act ?></title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <div>
    <h1>Act.<?= (int) $act ?></h1>
    <nav class="sub">
      <a href="genre.php?g=<?= rawurlencode($genre) ?>"><?= noa_h(noa_genres()[$genre]) ?></a>
    </nav>
  </div>
</header>
<main>
  <?php if ($notice !== ''): ?><p class="note"><?= noa_h($notice) ?></p><?php endif; ?>
  <p><?= noa_h(noa_title($row)) ?></p>
  <?php if ($ytId !== ''): ?>
    <div class="player"><iframe src="https://www.youtube.com/embed/<?= noa_h($ytId) ?>" allowfullscreen></iframe></div>
  <?php endif; ?>
  <?php if (trim((string) ($pkg['tracklist'] ?? '')) !== ''): ?>
    <p class="meta"><?= noa_h((string) $pkg['tracklist']) ?></p>
  <?php endif; ?>
  <?php if (noa_can_edit()): ?>
    <form class="editor" method="post">
      <input type="hidden" name="token" value="<?= noa_h(noa_token()) ?>">
      <?php foreach (['youtubeTitle', 'youtubeUrl', 'mvUrl', 'sunoUrl', 'tracklist', 'youtubeDescription', 'thumbUrl'] as $name): ?>
        <label><?= noa_h($name) ?>
          <?php $value = (string) ($pkg[$name] ?? ''); ?>
          <?php if (strlen($value) > 80 || $name === 'tracklist' || $name === 'youtubeDescription'): ?>
            <textarea name="<?= noa_h($name) ?>" rows="6"><?= noa_h($value) ?></textarea>
          <?php else: ?>
            <input name="<?= noa_h($name) ?>" value="<?= noa_h($value) ?>">
          <?php endif; ?>
        </label>
      <?php endforeach; ?>
      <button type="submit">파일에 저장</button>
    </form>
  <?php endif; ?>
</main>
</body>
</html>
