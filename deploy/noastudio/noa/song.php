<?php
declare(strict_types=1);
require __DIR__ . '/boot.php';
require __DIR__ . '/lib.php';
$genre = (string) ($_GET['g'] ?? '');
$key = (string) ($_GET['k'] ?? '');
$path = noa_genre_ok($genre) ? noa_song_path($genre, $key) : '';
$row = $path !== '' ? noa_read_json($path) : null;
if ($row === null) {
    header('Location: index.php');
    exit;
}
$pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : [];
$yt = trim((string) ($pkg['youtubeUrl'] ?? ''));
$ytId = noa_yt_id($yt);
$thumb = trim((string) ($pkg['thumbUrl'] ?? ''));
$notice = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    if (!noa_can_edit() || !noa_token_ok((string) ($_POST['token'] ?? ''))) {
        $notice = '수정 권한이 없습니다. 그누보드 최고관리자로 로그인하세요.';
    } else {
        $fields = [];
        foreach (noa_fields() as $name) {
            if (isset($_POST[$name])) {
                $fields[$name] = (string) $_POST[$name];
            }
        }
        $confirmed = isset($_POST['confirmed']);
        if (noa_write_fields($path, $fields, $confirmed)) {
            $row = noa_read_json($path) ?? $row;
            $pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : [];
            $yt = trim((string) ($pkg['youtubeUrl'] ?? ''));
            $ytId = noa_yt_id($yt);
            $thumb = trim((string) ($pkg['thumbUrl'] ?? ''));
            $notice = '파일에 저장했습니다.';
        } else {
            $notice = '파일에 쓰지 못했습니다. noa/data 쓰기 권한을 확인하세요.';
        }
    }
}
?><!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?= noa_h(noa_title($row)) ?></title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
<header>
  <div>
    <h1><?= noa_h(noa_title($row)) ?></h1>
    <nav class="sub">
      <a href="index.php">장르</a>
      <a href="genre.php?g=<?= rawurlencode($genre) ?>"><?= noa_h(noa_genres()[$genre]) ?></a>
    </nav>
  </div>
</header>
<main>
  <?php if ($notice !== ''): ?><p class="note"><?= noa_h($notice) ?></p><?php endif; ?>
  <?php if ($ytId !== ''): ?>
    <div class="player">
      <iframe src="https://www.youtube.com/embed/<?= noa_h($ytId) ?>" allow="autoplay; encrypted-media" allowfullscreen></iframe>
    </div>
  <?php elseif ($thumb !== ''): ?>
    <div class="player"><img src="<?= noa_h($thumb) ?>" alt=""></div>
  <?php endif; ?>
  <?php if (trim((string) ($pkg['sunoUrl'] ?? '')) !== ''): ?>
    <p><a href="<?= noa_h((string) $pkg['sunoUrl']) ?>" target="_blank" rel="noreferrer">수노 음원</a></p>
  <?php endif; ?>
  <?php if (trim((string) ($pkg['lyricsBlock'] ?? '')) !== ''): ?>
    <p class="meta"><?= noa_h((string) $pkg['lyricsBlock']) ?></p>
  <?php endif; ?>
  <?php if (noa_can_edit()): ?>
    <form class="editor" method="post">
      <input type="hidden" name="token" value="<?= noa_h(noa_token()) ?>">
      <label>확정 <input type="checkbox" name="confirmed" <?= !empty($row['confirmed']) ? 'checked' : '' ?>></label>
      <?php foreach (noa_fields() as $name): ?>
        <label><?= noa_h($name) ?>
          <?php $value = (string) ($pkg[$name] ?? ''); ?>
          <?php if (strlen($value) > 80 || str_contains($name, 'lyrics') || str_contains($name, 'Description') || str_contains($name, 'Prompt') || $name === 'summary' || $name === 'tracklist'): ?>
            <textarea name="<?= noa_h($name) ?>" rows="6"><?= noa_h($value) ?></textarea>
          <?php else: ?>
            <input name="<?= noa_h($name) ?>" value="<?= noa_h($value) ?>">
          <?php endif; ?>
        </label>
      <?php endforeach; ?>
      <button type="submit">파일에 저장</button>
    </form>
  <?php else: ?>
    <p class="who">결과 수정은 그누보드 관리자 로그인 후에만 됩니다.</p>
  <?php endif; ?>
</main>
</body>
</html>
