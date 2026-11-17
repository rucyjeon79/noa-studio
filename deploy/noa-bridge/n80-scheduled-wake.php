<?php
declare(strict_types=1);
// Retired by the owner on 2026-11-17. Never bootstrap, authenticate, dispatch or write.
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
http_response_code(410);
echo json_encode(['ok'=>false,'error'=>'scheduled_wake_retired','state'=>'retired','executionAllowed'=>false,'tasksExecuted'=>0],JSON_THROW_ON_ERROR);
