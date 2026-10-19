<?php
/**
 * NOA STUDIO 2.0 — read-only hosting compatibility probe.
 * Upload as /html/noa-system-check.php. Does not connect to or modify the DB.
 * Requires a GnuBoard super administrator session. Delete after inspection.
 */
declare(strict_types=1);
header('Content-Type: text/html; charset=UTF-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');
$common = __DIR__ . '/common.php';
if (!is_file($common)) {
    http_response_code(503);
    exit('NOA check unavailable: GnuBoard common.php missing.');
}
require_once $common;
if (empty($is_admin) || $is_admin !== 'super') {
    http_response_code(403);
    exit('Forbidden');
}
function noa_yes(bool $value): string { return $value ? 'OK' : 'CHECK'; }
$checks = [
    'PHP version (8.2+)' => version_compare(PHP_VERSION, '8.2', '>='),
    'PDO extension' => extension_loaded('pdo'),
    'PDO MySQL driver' => extension_loaded('pdo_mysql'),
    'JSON extension' => extension_loaded('json'),
    'OpenSSL extension' => extension_loaded('openssl'),
    'Session available' => session_status() === PHP_SESSION_ACTIVE,
    'GnuBoard super admin' => $is_admin === 'super',
    'Web root writable' => is_writable(__DIR__),
];
?><!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>NOA STUDIO 2.0 · 서버 호환성 점검</title>
<style>body{margin:0;background:#0b0b0e;color:#eee;font:16px system-ui,sans-serif}
main{max-width:740px;margin:8vh auto;padding:24px}h1{color:#e6c47a}
p{color:#aaa;line-height:1.6}table{border-collapse:collapse;width:100%;margin-top:28px}
td{padding:15px;border-bottom:1px solid #38332a}td:last-child{text-align:right;color:#e6c47a}
small{color:#999}</style></head><body><main>
<h1>NOA STUDIO 2.0</h1><p>닷홈 서버 호환성 점검 · 읽기 전용 · DB 변경 없음</p>
<table><tbody><?php foreach ($checks as $name => $ok): ?>
<tr><td><?= htmlspecialchars($name, ENT_QUOTES, 'UTF-8') ?></td>
<td><?= noa_yes($ok) ?></td></tr><?php endforeach; ?></tbody></table>
<p><small>이 화면은 서버에 로그인된 그누보드 최고관리자에게만 표시됩니다.
점검 후 이 파일을 삭제하세요. 비밀키·DB 정보는 출력하지 않습니다.</small></p>
</main></body></html>
