<?php
declare(strict_types=1);

function noa_base(): string
{
    return __DIR__;
}

function noa_data(): string
{
    return noa_base() . '/studio-live';
}

function noa_boot(): void
{
}

function noa_h(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function noa_member(): array
{
    $member = $GLOBALS['member'] ?? null;
    return is_array($member) ? $member : [];
}

function noa_can_edit(): bool
{
    $admin = $GLOBALS['is_admin'] ?? '';
    if ($admin === 'super' || $admin === 'group' || $admin === 'board') {
        return true;
    }
    $member = noa_member();
    return (int) ($member['mb_level'] ?? 0) >= 9;
}

function noa_token(): string
{
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_start();
    }
    if (empty($_SESSION['noa_token'])) {
        $_SESSION['noa_token'] = bin2hex(random_bytes(16));
    }
    return (string) $_SESSION['noa_token'];
}

function noa_token_ok(?string $token): bool
{
    $saved = noa_token();
    return is_string($token) && $token !== '' && hash_equals($saved, $token);
}

function noa_genres(): array
{
    return [
        'kpop-original' => 'K-POP Original Song',
        'jpop-original' => 'J-POP Original Song',
        'pop-original' => 'POP Original Song',
        'thai-original' => 'Thai Original Song',
        'joseon-ballad' => '조선 발라드',
        'panpop' => 'PANPOP',
        'echoes-of-joseon' => 'Echoes of Joseon',
        'latin-afrobeats-edm' => 'Latin Afrobeats EDM',
        'edm-kpop-club' => 'EDM K-POP Club',
        'dreamy-deep-house' => 'Dreamy Deep House',
        'fantasy-ambient-edm' => 'Fantasy Ambient EDM',
        'groovy-airy-pop' => 'Groovy Airy Pop',
        'narrative-piano-indie' => 'Narrative Piano Indie',
        'your-story' => '당신의 이야기',
        'cover-reborn' => '재탄생 커버',
    ];
}

function noa_genre_ok(string $genre): bool
{
    return isset(noa_genres()[$genre]) && is_dir(noa_data() . '/곡/' . $genre);
}

function noa_read_json(string $path): ?array
{
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $row = json_decode($raw, true);
    return is_array($row) ? $row : null;
}

function noa_song_files(string $genre): array
{
    $base = noa_data() . '/곡/' . $genre;
    $out = [];
    if (!is_dir($base)) {
        return $out;
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if (!$file->isFile() || strtolower($file->getExtension()) !== 'json') {
            continue;
        }
        $name = $file->getFilename();
        if (str_starts_with($name, 'act-')) {
            continue;
        }
        $rel = substr($file->getPathname(), strlen($base) + 1);
        $out[$rel] = $file->getPathname();
    }
    ksort($out, SORT_NATURAL);
    return $out;
}

function noa_act_files(string $genre): array
{
    $base = noa_data() . '/곡/' . $genre;
    $out = [];
    foreach (glob($base . '/act-*.json') ?: [] as $path) {
        if (preg_match('/act-(\d+)\.json$/', $path, $m)) {
            $out[(int) $m[1]] = $path;
        }
    }
    ksort($out);
    return $out;
}

function noa_song_path(string $genre, string $key): string
{
    $files = noa_song_files($genre);
    if (isset($files[$key])) {
        return $files[$key];
    }
    $ep = preg_replace('/\D/', '', $key) ?? '';
    if ($ep !== '') {
        $ep = str_pad($ep, 2, '0', STR_PAD_LEFT);
        foreach ($files as $rel => $path) {
            if (preg_match('/(^|\/)' . preg_quote($ep, '/') . '\.json$/', $rel)) {
                return $path;
            }
        }
    }
    return '';
}

function noa_title(array $row): string
{
    $pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : [];
    $title = trim((string) ($pkg['confirmedTitle'] ?? ''));
    if ($title === '') {
        $title = trim((string) ($row['title'] ?? ''));
    }
    if ($title === '') {
        $title = trim((string) ($pkg['youtubeTitle'] ?? ''));
    }
    return $title !== '' ? $title : '제목 없음';
}

function noa_yt_id(string $url): string
{
    if (preg_match('~(?:youtu\.be/|youtube\.com/(?:watch\?v=|embed/|shorts/))([A-Za-z0-9_-]{11})~', $url, $m)) {
        return $m[1];
    }
    return '';
}

function noa_fields(): array
{
    return [
        'confirmedTitle', 'summary', 'lyricsBlock', 'sunoStyle', 'geminiPrompt',
        'youtubeTitle', 'youtubeDescription', 'fanLetter', 'communityPost', 'tracklist',
        'youtubeUrl', 'mvUrl', 'sunoUrl', 'audioLevel', 'audioAnalysis', 'thumbUrl',
        'ytPremium', 'mvPremium',
    ];
}

function noa_write_fields(string $path, array $fields, ?bool $confirmed): bool
{
    $row = noa_read_json($path);
    if ($row === null) {
        return false;
    }
    if (!is_array($row['pkg'] ?? null)) {
        $row['pkg'] = [];
    }
    foreach (noa_fields() as $key) {
        if (!array_key_exists($key, $fields)) {
            continue;
        }
        if ($key === 'ytPremium' || $key === 'mvPremium') {
            $row['pkg'][$key] = $fields[$key] === true || $fields[$key] === 1 || $fields[$key] === '1';
            continue;
        }
        $row['pkg'][$key] = trim((string) $fields[$key]);
    }
    if ($confirmed !== null) {
        $row['confirmed'] = $confirmed;
    }
    $json = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false) {
        return false;
    }
    $tmp = $path . '.tmp';
    if (file_put_contents($tmp, $json . "\n", LOCK_EX) === false) {
        return false;
    }
    return rename($tmp, $path);
}

function noa_brief(string $genre, string $key, string $path): array
{
    $row = noa_read_json($path) ?? [];
    $pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : [];
    $ep = '';
    if (preg_match('/(?:^|\/)(\d{1,2})\.json$/', $key, $m)) {
        $ep = str_pad($m[1], 2, '0', STR_PAD_LEFT);
    }
    return [
        'key' => $key,
        'ep' => $ep,
        'title' => noa_title($row),
        'confirmed' => !empty($row['confirmed']),
        'youtubeUrl' => trim((string) ($pkg['youtubeUrl'] ?? '')),
        'mvUrl' => trim((string) ($pkg['mvUrl'] ?? '')),
        'sunoUrl' => trim((string) ($pkg['sunoUrl'] ?? '')),
        'thumbUrl' => trim((string) ($pkg['thumbUrl'] ?? '')),
        'ytPremium' => ($pkg['ytPremium'] ?? true) !== false,
        'kind' => 'song',
    ];
}

function noa_catalog(): array
{
    $groups = [
        '원곡' => ['kpop-original', 'jpop-original', 'pop-original', 'thai-original'],
        '컬렉션' => ['joseon-ballad', 'panpop', 'echoes-of-joseon', 'latin-afrobeats-edm', 'edm-kpop-club', 'dreamy-deep-house', 'fantasy-ambient-edm', 'groovy-airy-pop', 'narrative-piano-indie'],
        '사연·커버' => ['your-story', 'cover-reborn'],
    ];
    $labels = noa_genres();
    $out = [];
    foreach ($groups as $group => $ids) {
        $genres = [];
        foreach ($ids as $id) {
            if (!noa_genre_ok($id)) {
                continue;
            }
            $songs = [];
            foreach (noa_song_files($id) as $rel => $path) {
                $songs[] = noa_brief($id, $rel, $path);
            }
            $acts = [];
            foreach (noa_act_files($id) as $n => $path) {
                $item = noa_brief($id, 'act-' . $n . '.json', $path);
                $item['act'] = $n;
                $item['kind'] = 'act';
                $acts[] = $item;
            }
            $genres[] = ['id' => $id, 'label' => $labels[$id], 'songs' => $songs, 'acts' => $acts];
        }
        if ($genres) {
            $out[] = ['group' => $group, 'genres' => $genres];
        }
    }
    return $out;
}

function noa_find_path(string $genre, string $key): string
{
    if (!noa_genre_ok($genre)) {
        return '';
    }
    if (preg_match('/^act-(\d+)\.json$/', $key, $m)) {
        return noa_act_files($genre)[(int) $m[1]] ?? '';
    }
    return noa_song_path($genre, $key);
}

function noa_original(string $ep): array
{
    $ep = str_pad(preg_replace('/\D/', '', $ep) ?? '', 2, '0', STR_PAD_LEFT);
    if ($ep === '00') {
        return [];
    }
    $dir = noa_data() . '/원곡정보/kpop-original';
    if (!is_dir($dir)) {
        return [];
    }
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        if (!$file->isFile() || !preg_match('/(?:^|\/)' . $ep . '\.json$/', $file->getPathname())) {
            continue;
        }
        $row = noa_read_json($file->getPathname());
        if (!is_array($row)) {
            return [];
        }
        $pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : $row;
        return [
            'title' => trim((string) ($pkg['title'] ?? $row['title'] ?? '')),
            'vocal' => trim((string) ($pkg['vocal'] ?? $row['vocal'] ?? '')),
            'lyrics' => trim((string) ($pkg['lyrics'] ?? $row['lyrics'] ?? '')),
        ];
    }
    return [];
}

function noa_detail(string $genre, string $key): ?array
{
    $path = noa_find_path($genre, $key);
    $row = $path !== '' ? noa_read_json($path) : null;
    if ($row === null) {
        return null;
    }
    $pkg = is_array($row['pkg'] ?? null) ? $row['pkg'] : [];
    $fields = [];
    foreach (noa_fields() as $name) {
        $value = $pkg[$name] ?? '';
        $fields[$name] = is_bool($value) ? ($value ? '1' : '') : (string) $value;
    }
    $brief = noa_brief($genre, $key, $path);
    return [
        'genre' => $genre,
        'key' => $key,
        'title' => noa_title($row),
        'confirmed' => !empty($row['confirmed']),
        'kind' => str_starts_with($key, 'act-') ? 'act' : 'song',
        'fields' => $fields,
        'original' => $brief['ep'] !== '' ? noa_original($brief['ep']) : [],
        'ytId' => noa_yt_id($fields['youtubeUrl']),
    ];
}

function noa_safe_key(string $key): bool
{
    return $key !== '' && !str_contains($key, '..') && !str_contains($key, '\\') && !str_starts_with($key, '/') && str_ends_with($key, '.json');
}
