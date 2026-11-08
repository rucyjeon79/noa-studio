<?php
declare(strict_types=1);
if (!defined('_GNUBOARD_')) { http_response_code(403); exit; }
require_once dirname(__DIR__).'/noa-app/jukebox/media-location.php';

function nsc_allowed(string $url, bool $page): bool {
    $parts = parse_url($url);
    $hosts = ['suno.com','www.suno.com','suno.ai','www.suno.ai'];
    if (!$page) $hosts = array_merge($hosts, ['cdn1.suno.ai','cdn2.suno.ai','cdn.suno.ai']);
    return $parts && ($parts['scheme'] ?? '') === 'https'
        && in_array(strtolower($parts['host'] ?? ''), $hosts, true)
        && !isset($parts['user']) && !isset($parts['pass']) && !isset($parts['port'])
        && !preg_match('/[\x00-\x20\x7f\\\\]/', $url);
}

function nsc_fetch(string $url, bool $page, int $limit, float $deadline): array {
    for ($hop = 0; $hop < 5; $hop++) {
        $ms = (int)(($deadline - microtime(true)) * 1000);
        if (!nsc_allowed($url, $page) || $ms < 1) break;
        $body = '';
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_CONNECTTIMEOUT_MS => min(2500, $ms), CURLOPT_TIMEOUT_MS => $ms,
            CURLOPT_ENCODING => '', CURLOPT_USERAGENT => 'NOA-STUDIO-Public-Metadata/1.0',
            CURLOPT_WRITEFUNCTION => static function ($handle, string $chunk) use (&$body, $limit): int {
                if (strlen($body) + strlen($chunk) > $limit) return 0;
                $body .= $chunk;
                return strlen($chunk);
            },
        ]);
        $ok = curl_exec($curl);
        $status = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        $redirect = curl_getinfo($curl, CURLINFO_REDIRECT_URL);
        curl_close($curl);
        if ($ok === false) break;
        if ($status === 200) return [$url, $body];
        if (!in_array($status, [301,302,303,307,308], true) || !$redirect) break;
        $url = $redirect;
    }
    throw new RuntimeException('public_source_unavailable');
}

function nsc_metadata(string $url, string $html): array {
    $dom = new DOMDocument();
    if (!$dom->loadHTML($html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING)) throw new RuntimeException('invalid_page');
    $xpath = new DOMXPath($dom);
    $canonical = trim($xpath->evaluate('string(//link[@rel="canonical"]/@href)'));
    $image = trim($xpath->evaluate('string(//meta[@property="og:image" or @name="og:image"]/@content)'));
    $songPath = '~^/song/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})/?$~iD';
    foreach ([$url, $canonical] as $candidate) {
        if (nsc_allowed($candidate, true) && preg_match($songPath, parse_url($candidate, PHP_URL_PATH) ?: '', $match)
            && nsc_allowed($image, false)) return [$match[1], $image];
    }
    throw new RuntimeException('song_card_missing');
}

function nsc_webp(string $raw): string {
    $size = @getimagesizefromstring($raw);
    if (!$size || min($size[0], $size[1]) < 32 || $size[0] * $size[1] > 6000000
        || !in_array($size['mime'], ['image/jpeg','image/png','image/webp'], true)) throw new RuntimeException('invalid_image');
    $image = @imagecreatefromstring($raw);
    if (!$image) throw new RuntimeException('invalid_image');
    if ($size['mime'] === 'image/webp') return $raw;
    ob_start();
    try {
        if (!imagewebp($image, null, 92)) throw new RuntimeException('conversion_failed');
        $bytes = ob_get_contents();
    } finally { ob_end_clean(); }
    if (!$bytes || (@getimagesizefromstring($bytes)['mime'] ?? '') !== 'image/webp') throw new RuntimeException('conversion_failed');
    return $bytes;
}

function nsc_preview(?array $asset, string $key, string $source): string {
    if (!$source || !$asset || nj_asset_source($asset, 'cover') !== $source || !nj_verified($asset, 'cover')) return '';
    return nj_url($key, 'cover').'&v='.substr($asset['cover_sha256'], 0, 16);
}

// Fetch outside the document transaction. A provider failure must still allow the URL to be saved.
function nsc_prepare(PDO $db, string $key, string $source): ?array {
    if (!$source || !nsc_allowed($source, true)) return null;
    try {
        if (nsc_preview(nj_find($db, $key), $key, $source)) return null;
        $until = microtime(true) + 12;
        [$final, $html] = nsc_fetch($source, true, 3 * 1024 * 1024, $until);
        [$id, $image] = nsc_metadata($final, $html);
        [, $bytes] = nsc_fetch($image, false, 6 * 1024 * 1024, $until);
        return ['source'=>$source, 'id'=>$id, 'bytes'=>nsc_webp($bytes)];
    } catch (Throwable $e) { error_log('[suno-cover] could not fetch public artwork'); return null; }
}

function nsc_file(?array $asset, string $key, string $bytes, array $doc=[]): array {
    $audio = !empty($asset['audio_path']) ? nj_file($asset['audio_path']) : null;
    $relative = $audio ? dirname($asset['audio_path']) : nml_directory($key,$doc);
    $dir = $audio ? dirname($audio) : nj_private().'/media/'.$relative;
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) throw new RuntimeException('directory_unavailable');
    $hash = hash('sha256', $bytes);
    // Keep the current stream readable through commit, including when a URL is replaced.
    $name = 'cover-'.$hash.'.webp';
    if (!empty($asset['cover_path']) && dirname($asset['cover_path']) === $relative && ($asset['cover_sha256'] ?? '') === $hash && nj_verified($asset, 'cover')) {
        return [$asset['cover_path'], $hash];
    }
    $path = $dir.'/'.$name;
    if (!is_file($path)) {
        $tmp = tempnam($dir, '.suno-');
        if (!$tmp) throw new RuntimeException('image_write_failed');
        try {
            if (file_put_contents($tmp, $bytes) !== strlen($bytes) || !rename($tmp, $path)) throw new RuntimeException('image_write_failed');
        } finally { if (is_file($tmp)) unlink($tmp); }
    }
    $stored = $relative.'/'.$name;
    if (!nj_verified(['cover_path'=>$stored,'cover_sha256'=>$hash,'cover_bytes'=>strlen($bytes)], 'cover')) throw new RuntimeException('image_readback_failed');
    return [$stored, $hash];
}

// Caller owns the song write transaction and its revision check. Only cover columns are updated.
function nsc_attach(PDO $db, string $key, array $doc, ?array $prepared): array {
    $source = noa_sound_suno($doc['body'] ?? []);
    if (!$prepared || $source !== $prepared['source']) return $doc;
    $db->exec('SAVEPOINT suno_cover');
    try {
        $q = $db->prepare('SELECT * FROM noa_jukebox_assets WHERE song_key=? FOR UPDATE');
        $q->execute([$key]);
        $old = $q->fetch(PDO::FETCH_ASSOC) ?: null;
        [$path, $hash] = nsc_file($old, $key, $prepared['bytes'], $doc);
        $evidence = json_decode($old['source_evidence'] ?? 'null', true, 512, JSON_THROW_ON_ERROR) ?? [];
        $evidence['coverSourceUrl'] = $source;
        $evidence['coverSunoId'] = $prepared['id'];
        $values = [$path, strlen($prepared['bytes']), $hash, json_encode($evidence, JSON_THROW_ON_ERROR)];
        if ($old) {
            $db->prepare('UPDATE noa_jukebox_assets SET cover_path=?,cover_bytes=?,cover_sha256=?,source_evidence=? WHERE song_key=?')->execute([...$values,$key]);
        } else {
            $db->prepare('INSERT INTO noa_jukebox_assets (song_key,source_url,suno_id,title,genre,ep,cover_path,cover_bytes,cover_sha256,source_evidence) VALUES (?,?,?,?,?,?,?,?,?,?)')
                ->execute([$key,$source,$prepared['id'],$doc['title'] ?? '',$doc['genreId'] ?? '',$doc['ep'] ?? '',...$values]);
        }
        $doc['body']['uploadedAsset'] = nj_find($db, $key);
        $doc['body']['cardImageLocation'] = $path;
    } catch (Throwable $e) {
        if (!$db->inTransaction()) throw $e;
        $db->exec('ROLLBACK TO SAVEPOINT suno_cover');
        error_log('[suno-cover] could not register artwork');
    }
    return $doc;
}
