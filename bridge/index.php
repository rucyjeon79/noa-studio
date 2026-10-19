<?php
declare(strict_types=1);
// Install only after review under /hosting/noastudio/html/noa-bridge/index.php.
// Requires GnuBoard common.php and the additive schema migration.
require_once dirname(__DIR__) . '/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
function respond(int $status, array $body): never {
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
function fail(int $status, string $code): never { respond($status, ['ok' => false, 'error' => $code]); }
if (empty($is_member) || empty($is_admin)) {
    fail(403, 'admin_required');
}
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($method, ['GET', 'PUT'], true)) fail(405, 'method_not_allowed');
// Same-origin only until an authenticated cross-origin handshake is implemented.
if ($method === 'PUT') {
    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($contentType !== 'application/json') fail(415, 'json_required');
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    // Fixed trusted origin: never derive the expected origin from an attacker-controlled Host header.
    $expected = 'https://noastudio.ai.kr';
    if (!$origin || !hash_equals($expected, $origin)) fail(403, 'origin_required');
    if (isset($_SERVER['HTTP_SEC_FETCH_SITE']) && $_SERVER['HTTP_SEC_FETCH_SITE'] !== 'same-origin') fail(403, 'cross_site_forbidden');
    if (($_SERVER['CONTENT_LENGTH'] ?? 0) > 1048576) fail(413, 'too_large');
    if (empty($_SERVER['HTTP_X_NOA_BRIDGE_REQUEST']) || $_SERVER['HTTP_X_NOA_BRIDGE_REQUEST'] !== '1') fail(403, 'bridge_header_required');
}
$healthCheck = $method === 'GET' && ($_GET['health'] ?? null) === '1';
$key = (string) ($_GET['key'] ?? '');
if (!$healthCheck && !preg_match('/^[a-z0-9][a-z0-9:_-]{0,190}$/', $key)) fail(400, 'invalid_key');
// Configure via environment or an untracked server-only config, never browser JS.
require_once __DIR__ . '/storage.php';
try {
    $pdo = noa_bridge_pdo();
    if ($healthCheck) {
        // Read-only: confirm required tables exist and the connection can read them.
        $tables = ['noa_documents', 'noa_document_history', 'noa_request_log'];
        foreach ($tables as $table) {
            $pdo->query('SELECT 1 FROM ' . $table . ' LIMIT 0');
        }
        respond(200, ['ok' => true, 'status' => 'ready', 'schema' => '001']);
    }
    if ($method === 'GET') {
        $historicalRevision = $_GET['revision'] ?? null;
        if ($historicalRevision !== null) {
            if (!is_string($historicalRevision) || !preg_match('/^[1-9][0-9]{0,15}$/', $historicalRevision)) fail(400, 'invalid_revision');
            $stmt = $pdo->prepare('SELECT d.kind,h.payload,h.revision FROM noa_document_history h JOIN noa_documents d ON d.doc_key=h.doc_key WHERE h.doc_key=? AND h.revision=?');
            $stmt->execute([$key, $historicalRevision]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row) fail(404, 'revision_not_found');
            respond(200, ['ok'=>true,'key'=>$key,'kind'=>$row['kind'],'payload'=>json_decode($row['payload'], true),'revision'=>(int)$row['revision'],'historical'=>true]);
        }
        $stmt = $pdo->prepare('SELECT kind,payload,revision FROM noa_documents WHERE doc_key=?');
        $stmt->execute([$key]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) fail(404, 'not_found');
        respond(200, ['ok'=>true,'key'=>$key,'kind'=>$row['kind'],'payload'=>json_decode($row['payload'], true),'revision'=>(int)$row['revision']]);
    }
    $raw = file_get_contents('php://input', false, null, 0, 1048577);
    if ($raw === false || strlen($raw) > 1048576) fail(413, 'too_large');
    $data = json_decode($raw, true);
    if (!is_array($data) || array_is_list($data)) fail(400, 'invalid_json');
    $kind = $data['kind'] ?? null;
    $expected = $data['expectedRevision'] ?? null;
    $requestId = $data['requestId'] ?? null;
    if (!in_array($kind, ['single','playlist','story','meta','prefs'], true)
        || !is_int($expected) || $expected < 0
        || !is_string($requestId) || !preg_match('/^[a-f0-9-]{36}$/i', $requestId)
        || !array_key_exists('payload', $data) || !is_array($data['payload']) || array_is_list($data['payload'])) fail(400, 'invalid_write');
    $payload = json_encode($data['payload'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    $hash = hash('sha256', $key . "\n" . $kind . "\n" . $expected . "\n" . $payload);
    $pdo->beginTransaction();
    $q = $pdo->prepare('SELECT doc_key,request_hash,revision FROM noa_request_log WHERE request_id=? FOR UPDATE');
    $q->execute([$requestId]);
    $retry = $q->fetch(PDO::FETCH_ASSOC);
    if ($retry) {
        $pdo->commit();
        if (!hash_equals($retry['request_hash'], $hash) || $retry['doc_key'] !== $key) fail(409, 'idempotency_reuse');
        respond(200, ['ok'=>true,'revision'=>(int)$retry['revision'],'replayed'=>true]);
    }
    // Create a lockable row for first writes. Rollback removes it on conflicts.
    $q = $pdo->prepare("INSERT IGNORE INTO noa_documents(doc_key,kind,payload,revision,updated_by) VALUES(?,?,'{}',0,?)");
    $q->execute([$key,$kind,(string)$member['mb_id']]);
    $q = $pdo->prepare('SELECT kind,revision FROM noa_documents WHERE doc_key=? FOR UPDATE');
    $q->execute([$key]);
    $current = $q->fetch(PDO::FETCH_ASSOC);
    if (!$current || (int)$current['revision'] !== $expected || $current['kind'] !== $kind) {
        $pdo->rollBack();
        fail(409, 'revision_conflict');
    }
    $next = $expected + 1;
    $q = $pdo->prepare('UPDATE noa_documents SET payload=?,revision=?,updated_by=? WHERE doc_key=?');
    $q->execute([$payload,$next,(string)$member['mb_id'],$key]);
    $q = $pdo->prepare('INSERT INTO noa_document_history(doc_key,revision,payload,changed_by) VALUES(?,?,?,?)');
    $q->execute([$key,$next,$payload,(string)$member['mb_id']]);
    $q = $pdo->prepare('INSERT INTO noa_request_log(request_id,doc_key,request_hash,revision) VALUES(?,?,?,?)');
    $q->execute([$requestId,$key,$hash,$next]);
    $pdo->commit();
    respond(200, ['ok'=>true,'revision'=>$next,'replayed'=>false]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('[noa-bridge] request failed: ' . get_class($e));
    fail(500, 'storage_error');
}
