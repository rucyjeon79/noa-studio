<?php
// Rendered with a single-use credential by the deployment job.
if ($_SERVER['REQUEST_METHOD'] !== 'POST' ||
    !hash_equals('__TOKEN_HASH__', hash('sha256', $_SERVER['HTTP_X_BUSAN_POPUP'] ?? ''))) {
    http_response_code(404);
    exit;
}
ini_set('display_errors', '0');
require dirname(__DIR__) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
$table = $g5['new_win_table'];
$row = sql_fetch("SELECT * FROM `$table` WHERE nw_id = 1");
$notice = '/bbs/board.php?bo_table=notice&amp;wr_id=42';
$asset = '/data/editor/2611/busan-election-65acd106ec2b.webp';
if (!$row || !preg_match('/<img\b[^>]*\balt="([^"]+)"/iu', $row['nw_content'], $match)) {
    refuse('existing candidate description missing');
}
$alt = htmlspecialchars(html_entity_decode($match[1], ENT_QUOTES, 'UTF-8'), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$body = '<a href="' . $notice . '" style="display:block;background:#151515;color:#fff;text-align:center;text-decoration:none;">'
    . '<img src="' . $asset . '" width="1024" height="1536" alt="' . $alt . '"'
    . ' style="display:block;width:100%;height:auto;max-height:calc(100vh - 148px);max-height:calc(100dvh - 148px);object-fit:contain;">'
    . '<span style="display:block;padding:6px 8px;font-size:15px;line-height:22px;font-weight:700;">선거 공지 보기 →</span></a>';
function refuse($message) {
    http_response_code(409);
    echo json_encode(['error' => $message]);
    exit;
}
if (!$row || $row['nw_end_time'] !== '2026-11-11 18:00:00' || (int)$row['nw_disable_hours'] !== 24 ||
    (int)$row['nw_width'] !== 340 || $row['nw_device'] !== 'both') {
    refuse('popup settings changed');
}
if (!is_file(G5_PATH . $asset) || hash_file('sha256', G5_PATH . $asset) !== '65acd106ec2b564cd0257cf6ea1ff49ae3e958510ae30315cdcb984f3e285a82') {
    refuse('poster hash mismatch');
}
if ($row['nw_content'] !== $body) {
    $oldHtml = html_entity_decode($row['nw_content'], ENT_QUOTES, 'UTF-8');
    if (!str_contains($oldHtml, 'bo_table=notice&wr_id=42') ||
        !str_contains($oldHtml, '39aca078f5f1df2d159bd89ebb91d543_DzX0CfKy') ||
        (int)$row['nw_height'] !== 590) {
        refuse('original popup no longer matches');
    }
    $old = sql_real_escape_string($row['nw_content']);
    $new = sql_real_escape_string($body);
    if (!sql_query("UPDATE `$table` SET nw_content='$new', nw_height=544
        WHERE nw_id=1 AND BINARY nw_content=BINARY '$old' AND nw_height=590
        AND nw_width=340 AND nw_disable_hours=24 AND nw_device='both'
        AND nw_end_time='2026-11-11 18:00:00'", false)) {
        refuse('popup edit failed');
    }
}
$saved = sql_fetch("SELECT nw_content, nw_height FROM `$table` WHERE nw_id=1");
if ($saved['nw_content'] !== $body || (int)$saved['nw_height'] !== 544) {
    refuse('popup changed concurrently');
}
echo json_encode(['ok' => true]);
