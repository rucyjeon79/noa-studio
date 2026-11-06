<?php
declare(strict_types=1);
// Deliberately independent of common.php: no sessions, database or personalized data.
require __DIR__.'/noa-app/home-assets.php';
header('X-Content-Type-Options: nosniff');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$files = nha_files(is_string($_GET['files'] ?? null) ? $_GET['files'] : '');
if (!in_array($method, ['GET','HEAD'], true) || !$files) {
    http_response_code(400); header('Cache-Control: no-store'); exit;
}
$kind = pathinfo($files[0], PATHINFO_EXTENSION);
$body = ''; $hashes = [];
foreach ($files as $file) {
    if (!is_file(__DIR__.'/'.$file) || !is_readable(__DIR__.'/'.$file)) { http_response_code(404); header('Cache-Control: no-store'); exit; }
    $part = file_get_contents(__DIR__.'/'.$file);
    if ($part === false) { http_response_code(503); header('Cache-Control: no-store'); exit; }
    $hashes[] = $file.':'.hash('sha256', $part);
    // A newline protects trailing line comments; semicolons isolate classic scripts.
    $body .= ($kind === 'js' ? ";\n" : "\n").'/* '.$file.' */'."\n".$part."\n";
}
$version = hash('sha256', implode("\n", $hashes));
header('Content-Type: '.($kind === 'js' ? 'application/javascript' : 'text/css').'; charset=utf-8');
header('Vary: Accept-Encoding');
$current = is_string($_GET['v'] ?? null) && hash_equals($version, $_GET['v']);
header('Cache-Control: '.($current ? 'public, max-age=31536000, immutable' : 'no-store'));
$gzip = false;
foreach (explode(',', $_SERVER['HTTP_ACCEPT_ENCODING'] ?? '') as $encoding) {
    if (preg_match('/^\s*gzip\s*(?:;\s*q\s*=\s*([0-9.]+))?\s*$/i', $encoding, $match) && (!isset($match[1]) || (float)$match[1] > 0)) $gzip = true;
}
$gzip = $gzip && function_exists('gzencode') && !ini_get('zlib.output_compression');
$etag = '"'.$version.($gzip ? '-gzip' : '-identity').'"'; header('ETag: '.$etag);
if ($current && ($_SERVER['HTTP_IF_NONE_MATCH'] ?? '') === $etag) { http_response_code(304); exit; }
if ($gzip) { $body = gzencode($body, 6); header('Content-Encoding: gzip'); }
if (!ini_get('zlib.output_compression')) header('Content-Length: '.strlen($body));
if ($method !== 'HEAD') echo $body;
