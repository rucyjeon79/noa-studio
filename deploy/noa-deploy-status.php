<?php
declare(strict_types=1);
/**
 * NOA STUDIO host-first deployment control: read-only admin status.
 * This endpoint NEVER accepts upload, commands, arbitrary paths or remote URLs.
 */
require_once __DIR__.'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: private, no-store');
header('X-Content-Type-Options: nosniff');
if (empty($is_admin) || $is_admin !== 'super') {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'forbidden']);
    exit;
}
$root = realpath(__DIR__);
$stateFile = dirname($root).'/noa-deploy-private/current-release.json';
$state = null;
if (is_file($stateFile) && is_readable($stateFile)) {
    $raw = file_get_contents($stateFile, false, null, 0, 65536);
    $decoded = $raw === false ? null : json_decode($raw, true);
    if (is_array($decoded)) {
        $state = [
            'release' => is_string($decoded['release'] ?? null) ? substr($decoded['release'], 0, 80) : null,
            'host_id' => is_string($decoded['host_id'] ?? null) ? substr($decoded['host_id'], 0, 40) : null,
            'environment' => is_string($decoded['environment'] ?? null) ? substr($decoded['environment'], 0, 20) : null,
            'applied_at' => is_string($decoded['applied_at'] ?? null) ? substr($decoded['applied_at'], 0, 40) : null,
            'status' => in_array($decoded['status'] ?? '', ['verified','rollback','pending'], true) ? $decoded['status'] : 'unknown',
            'file_count' => is_array($decoded['files'] ?? null) ? count($decoded['files']) : null,
            'checked_routes' => is_array($decoded['checked_routes'] ?? null) ? array_slice(array_values(array_filter($decoded['checked_routes'], 'is_string')), 0, 20) : [],
        ];
    }
}
echo json_encode([
    'ok'=>true,
    'deployment_model'=>'dothome_primary',
    'server_release'=>$state,
    'deployment_available'=>false,
    'note'=>'Read-only status; protected host-side deployment agent not yet installed.',
], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
