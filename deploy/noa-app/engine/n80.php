<?php
declare(strict_types=1);
/**
 * N80 ENGINE unified facade. All legacy modules remain available; this is a
 * single read-only integration entrypoint, not a new worker or API endpoint.
 */
require_once __DIR__.'/identity.php';
require_once __DIR__.'/integration-audit.php';
require_once __DIR__.'/durable-store.php';
require_once __DIR__.'/lease-inbox.php';
require_once __DIR__.'/executor.php';
function n80_engine_snapshot(string $root): array {
    return [
        'identity'=>n80_engine_identity(),
        'audit'=>noa_engine_integration_audit($root),
        'dispatchEnabled'=>false,
        'compatibility'=>'legacy_modules_preserved',
    ];
}
