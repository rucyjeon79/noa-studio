<?php
/**
 * Read-only deployment smoke check for NOA STUDIO 2.0.
 * Run with: php deploy/check.php /path/to/html
 * No database writes, file mutations, or remote requests.
 */
declare(strict_types=1);
$root = $argv[1] ?? '';
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if ($root === '' || !is_dir($root)) { fwrite(STDERR, "Usage: php check.php /path/to/html\n"); exit(2); }
$checks = [
    'PHP >= 8.2' => PHP_VERSION_ID >= 80200,
    'GnuBoard common.php' => is_file($root . '/common.php'),
    'GnuBoard bbs/login.php' => is_file($root . '/bbs/login.php'),
    'GnuBoard bbs/logout.php' => is_file($root . '/bbs/logout.php'),
    'NOA 2.0 entrypoint' => is_file($root . '/noa2.php'),
    'PDO MySQL extension' => extension_loaded('pdo_mysql'),
];
foreach ($checks as $label => $ok) {
    echo ($ok ? '[OK] ' : '[FAIL] ') . $label . PHP_EOL;
}
exit(in_array(false, $checks, true) ? 1 : 0);
