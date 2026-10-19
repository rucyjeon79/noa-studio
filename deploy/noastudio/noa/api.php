<?php
declare(strict_types=1);
require __DIR__ . '/boot.php';
require __DIR__ . '/lib.php';

header('Content-Type: application/json; charset=utf-8');

function noa_json($body, int $code = 200): void
{
    http_response_code($code);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$op = (string) ($_GET['op'] ?? $_POST['op'] ?? 'catalog');
if ($op === 'catalog') {
    noa_json(['ok' => true, 'edit' => noa_can_edit(), 'groups' => noa_catalog()]);
}
if ($op === 'song') {
    $genre = (string) ($_GET['g'] ?? '');
    $key = (string) ($_GET['k'] ?? '');
    $detail = noa_detail($genre, $key);
    if ($detail === null) {
        noa_json(['ok' => false, 'error' => '없는 곡 파일'], 404);
    }
    noa_json(['ok' => true, 'edit' => noa_can_edit(), 'song' => $detail]);
}

if (!noa_can_edit() || !noa_token_ok((string) ($_POST['token'] ?? ''))) {
    noa_json(['ok' => false, 'error' => '수정 권한이 없습니다.'], 403);
}

$genre = (string) ($_POST['g'] ?? '');
$key = (string) ($_POST['k'] ?? '');
if (!noa_genre_ok($genre) || !noa_safe_key($key)) {
    noa_json(['ok' => false, 'error' => '잘못된 곡'], 400);
}
$path = noa_find_path($genre, $key);
if ($path === '' || !is_file($path)) {
    noa_json(['ok' => false, 'error' => '파일이 없습니다.'], 404);
}

if ($op === 'save') {
    $fields = [];
    foreach (noa_fields() as $name) {
        if (array_key_exists($name, $_POST)) {
            $fields[$name] = (string) $_POST[$name];
        }
    }
    $confirmed = ($_POST['confirmed'] ?? '') === '1';
    if (!noa_write_fields($path, $fields, str_starts_with($key, 'act-') ? null : $confirmed)) {
        noa_json(['ok' => false, 'error' => '파일에 쓰지 못했습니다. studio-live 권한을 확인하세요.'], 500);
    }
    noa_json(['ok' => true, 'song' => noa_detail($genre, $key)]);
}

if ($op === 'delete') {
    if (!unlink($path)) {
        noa_json(['ok' => false, 'error' => '삭제하지 못했습니다.'], 500);
    }
    noa_json(['ok' => true]);
}

if ($op === 'move') {
    $to = (string) ($_POST['to'] ?? '');
    if (!noa_genre_ok($to) || $to === $genre) {
        noa_json(['ok' => false, 'error' => '옮길 장르가 없습니다.'], 400);
    }
    $destDir = noa_data() . '/곡/' . $to;
    $name = basename($path);
    if (preg_match('/^\d{2}\.json$/', $name) && is_dir($destDir . '/ep')) {
        $dest = $destDir . '/ep/' . $name;
    } elseif (is_dir($destDir . '/기본')) {
        $dest = $destDir . '/기본/' . $name;
    } else {
        $dest = $destDir . '/' . $name;
    }
    if (is_file($dest)) {
        noa_json(['ok' => false, 'error' => '그 장르에 같은 파일이 있습니다.'], 409);
    }
    if (!rename($path, $dest)) {
        noa_json(['ok' => false, 'error' => '옮기지 못했습니다.'], 500);
    }
    $row = noa_read_json($dest);
    if (is_array($row)) {
        $row['genreId'] = $to;
        file_put_contents($dest, json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n");
    }
    $newKey = ltrim(substr($dest, strlen($destDir) + 1), '/');
    noa_json(['ok' => true, 'g' => $to, 'k' => $newKey]);
}

noa_json(['ok' => false, 'error' => '없는 요청'], 404);
