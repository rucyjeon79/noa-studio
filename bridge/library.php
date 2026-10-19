<?php
/**
 * NOA Bridge library index (admin-only, read-only).
 * Deploy under /html/noa-bridge/library.php, alongside index.php.
 */
declare(strict_types=1);
require_once dirname(__DIR__) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
function noa_library_reply(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
if (empty($is_member) || empty($is_admin)) {
    noa_library_reply(403, ['ok'=>false,'error'=>'admin_required']);
}
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    noa_library_reply(405, ['ok'=>false,'error'=>'method_not_allowed']);
}
$kind = $_GET['kind'] ?? '';
$after = $_GET['after'] ?? '';
if (!is_string($kind) || ($kind !== '' && !in_array($kind, ['single','playlist','story','meta','prefs'], true))) {
    noa_library_reply(400, ['ok'=>false,'error'=>'invalid_kind']);
}
if (!is_string($after) || ($after !== '' && !preg_match('/^[a-z0-9][a-z0-9:_-]{0,190}$/', $after))) {
    noa_library_reply(400, ['ok'=>false,'error'=>'invalid_cursor']);
}
$dsn = getenv('NOA_MYSQL_DSN');
$user = getenv('NOA_MYSQL_USER');
$pass = getenv('NOA_MYSQL_PASSWORD');
if (!$dsn || !$user || $pass === false) {
    noa_library_reply(503, ['ok'=>false,'error'=>'bridge_not_configured']);
}
try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES=>false
    ]);
    $sql = 'SELECT doc_key,kind,revision,updated_at FROM noa_documents WHERE doc_key > :cursor';
    if ($kind !== '') $sql .= ' AND kind = :kind';
    $sql .= ' ORDER BY doc_key ASC LIMIT 51';
    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':cursor', $after, PDO::PARAM_STR);
    if ($kind !== '') $stmt->bindValue(':kind', $kind, PDO::PARAM_STR);
    $stmt->execute();
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasMore = count($rows) > 50;
    if ($hasMore) array_pop($rows);
    $items = array_map(static fn(array $r): array => [
        'key'=>$r['doc_key'],
        'kind'=>$r['kind'],
        'revision'=>(int)$r['revision'],
        'updatedAt'=>$r['updated_at']
    ], $rows);
    $last = count($items) ? $items[count($items)-1]['key'] : null;
    noa_library_reply(200, ['ok'=>true,'items'=>$items,'hasMore'=>$hasMore,'nextCursor'=>$hasMore ? $last : null]);
} catch (Throwable $e) {
    error_log('[noa-library] ' . get_class($e));
    noa_library_reply(500, ['ok'=>false,'error'=>'storage_error']);
}
