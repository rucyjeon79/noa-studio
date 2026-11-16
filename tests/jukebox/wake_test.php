<?php
declare(strict_types=1);
define('_GNUBOARD_', true);
require __DIR__.'/../../deploy/noa-app/jukebox/wake-core.php';

/**
 * N80 wake-only GitHub policy regression test:
 * no legacy upload, retry, or credential path may dispatch GitHub Actions.
 * Keep the durable media FIFO untouched for a verified N80 executor.
 */
function check($actual,$expected):void {
    if ($actual !== $expected) {
        throw new RuntimeException('retired wake assertion failed: '.json_encode([$actual,$expected]));
    }
}
$dir = sys_get_temp_dir().'/noa-retired-wake-'.bin2hex(random_bytes(8));
$calls = 0;
$send = static function($token) use (&$calls) { $calls++; return 204; };
putenv('NOA_GITHUB_DISPATCH_TOKEN='.str_repeat('x',40));
try {
    check(nw_dispatch(str_repeat('x',40)),0);
    check(nw_request($dir,$send,100),'github_worker_retired');
    check(nw_request($dir,$send,101,'noa-ai-worker.yml'),'github_worker_retired');
    check(nw_request($dir,$send,102,'unapproved.yml'),'invalid_workflow');
    nw_after_enqueue();
    check($calls,0);
    check(file_exists($dir),false);
    echo "wake: GitHub business dispatch retired, no credentials read, no spool writes\n";
} finally {
    putenv('NOA_GITHUB_DISPATCH_TOKEN');
}
