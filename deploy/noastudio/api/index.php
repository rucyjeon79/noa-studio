<?php
require __DIR__ . '/bootstrap.php';

if (!noa_origin_allowed() && isset($_SERVER['HTTP_ORIGIN'])) {
    noa_json(403, array('ok' => false, 'status' => 'error', 'error' => 'origin'));
}
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}
if (!noa_boot_gnuboard()) {
    noa_json(503, array('ok' => false, 'status' => 'error', 'error' => 'gnuboard'));
}

$op = isset($_GET['op']) ? $_GET['op'] : '';
if ($op === 'genres') {
    $rows = array();
    $result = sql_query("SELECT genre_id, kind, COUNT(*) AS n FROM noa_songs GROUP BY genre_id, kind");
    while ($row = sql_fetch_array($result)) {
        $rows[] = array(
            'genreId' => $row['genre_id'],
            'kind' => $row['kind'],
            'count' => (int) $row['n'],
        );
    }
    noa_json(200, array('ok' => true, 'genres' => $rows));
}

if ($op === 'songs') {
    $genre = isset($_GET['genre']) ? $_GET['genre'] : '';
    if (!preg_match('/^[a-z0-9-]{1,64}$/', $genre)) {
        noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'genre'));
    }
    $rows = array();
    $result = sql_query("SELECT song_key, kind, ep, title, confirmed, rev, JSON_UNQUOTE(JSON_EXTRACT(pkg, '$.youtubeUrl')) AS youtubeUrl, JSON_UNQUOTE(JSON_EXTRACT(pkg, '$.thumbUrl')) AS thumbUrl FROM noa_songs WHERE genre_id = '" . noa_esc($genre) . "' ORDER BY ep, title");
    while ($row = sql_fetch_array($result)) {
        $rows[] = array(
            'key' => $row['song_key'],
            'kind' => $row['kind'],
            'ep' => $row['ep'],
            'title' => $row['title'],
            'confirmed' => (int) $row['confirmed'] === 1,
            'rev' => (int) $row['rev'],
            'youtubeUrl' => $row['youtubeUrl'] === 'null' ? '' : (string) $row['youtubeUrl'],
            'thumbUrl' => $row['thumbUrl'] === 'null' ? '' : (string) $row['thumbUrl'],
        );
    }
    noa_json(200, array('ok' => true, 'songs' => $rows));
}

if ($op === 'song' && $_SERVER['REQUEST_METHOD'] === 'GET') {
    $key = isset($_GET['key']) ? $_GET['key'] : '';
    if (!is_string($key) || $key === '' || strlen($key) > 191 || preg_match('/[\\x00-\\x1f\'"\\\\\\/]/', $key)) {
        noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'key'));
    }
    $row = noa_one("SELECT song_key, title, confirmed, rev, pkg FROM noa_songs WHERE song_key = '" . noa_esc($key) . "' LIMIT 1");
    if (!$row) {
        noa_json(404, array('ok' => false, 'status' => 'error', 'error' => 'missing'));
    }
    $pkg = json_decode($row['pkg'], true);
    if (!is_array($pkg)) {
        $pkg = array();
    }
    if (!noa_admin()) {
        $public = array('summary', 'confirmedTitle', 'lyricsBlock', 'youtubeTitle', 'youtubeDescription', 'fanLetter', 'thumbUrl', 'youtubeUrl', 'sunoUrl');
        $pkg = array_intersect_key($pkg, array_flip($public));
    }
    noa_json(200, array(
        'ok' => true,
        'key' => $row['song_key'],
        'title' => $row['title'],
        'confirmed' => (int) $row['confirmed'] === 1,
        'rev' => (int) $row['rev'],
        'pkg' => $pkg,
    ));
}

if ($op === 'song' && $_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!noa_admin()) {
        noa_json(403, array('ok' => false, 'status' => 'error', 'error' => 'forbidden'));
    }
    $raw = json_decode(file_get_contents('php://input'), true);
    if (!is_array($raw)) {
        noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'json'));
    }
    $key = isset($raw['key']) ? $raw['key'] : '';
    $base = isset($raw['baseRev']) ? $raw['baseRev'] : null;
    $saved = isset($raw['savedKeys']) && is_array($raw['savedKeys']) ? $raw['savedKeys'] : array();
    $fields = isset($raw['fields']) && is_array($raw['fields']) ? $raw['fields'] : array();
    if (!is_string($key) || $key === '' || strlen($key) > 191 || preg_match('/[\\x00-\\x1f\'"\\\\\\/]/', $key) || (!is_int($base) && !(is_string($base) && ctype_digit($base)))) {
        noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'payload'));
    }
    $base = (int) $base;
    $patch = array();
    foreach ($saved as $name) {
        if (!is_string($name) || !preg_match('/^[A-Za-z][A-Za-z0-9_]{0,40}$/', $name)) {
            noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'field'));
        }
        if (!array_key_exists($name, $fields)) {
            noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'missing-field', 'rejectedKeys' => array($name)));
        }
        if ($fields[$name] === null) {
            noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'null-field', 'rejectedKeys' => array($name)));
        }
        $patch[$name] = $fields[$name];
    }
    if (!$patch) {
        noa_json(400, array('ok' => false, 'status' => 'error', 'error' => 'empty'));
    }
    sql_query('START TRANSACTION');
    $row = noa_one("SELECT rev, pkg, title FROM noa_songs WHERE song_key = '" . noa_esc($key) . "' LIMIT 1 FOR UPDATE");
    if (!$row) {
        sql_query('ROLLBACK');
        noa_json(404, array('ok' => false, 'status' => 'error', 'error' => 'missing'));
    }
    if ((int) $row['rev'] !== $base) {
        sql_query("INSERT INTO noa_save_history (target_key, base_rev, new_rev, changed_keys, result, actor) VALUES ('" . noa_esc($key) . "', " . $base . ", NULL, '" . noa_esc(json_encode(array_keys($patch))) . "', 'conflict', 'admin')");
        sql_query('COMMIT');
        noa_json(409, array('ok' => false, 'status' => 'conflict', 'rev' => (int) $row['rev'], 'rejectedKeys' => array_keys($patch)));
    }
    $current = json_decode($row['pkg'], true);
    if (!is_array($current)) {
        $current = array();
    }
    $changed = false;
    foreach ($patch as $name => $value) {
        if (!array_key_exists($name, $current) || $current[$name] !== $value) {
            $changed = true;
        }
        $current[$name] = $value;
    }
    if (!$changed) {
        sql_query('ROLLBACK');
        noa_json(200, array('ok' => true, 'status' => 'unchanged', 'rev' => $base, 'key' => $key));
    }
    $title = $row['title'];
    if (isset($patch['confirmedTitle']) && is_string($patch['confirmedTitle']) && trim($patch['confirmedTitle']) !== '') {
        $title = trim($patch['confirmedTitle']);
    }
    $next = $base + 1;
    $pkgJson = json_encode($current, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    sql_query("UPDATE noa_songs SET pkg = '" . noa_esc($pkgJson) . "', title = '" . noa_esc($title) . "', rev = " . $next . " WHERE song_key = '" . noa_esc($key) . "' AND rev = " . $base);
    $check = noa_one("SELECT rev, pkg FROM noa_songs WHERE song_key = '" . noa_esc($key) . "' LIMIT 1");
    $savedPkg = $check ? json_decode($check['pkg'], true) : null;
    $verified = is_array($savedPkg);
    foreach ($patch as $name => $value) {
        if (!$verified || !array_key_exists($name, $savedPkg) || $savedPkg[$name] !== $value) {
            $verified = false;
        }
    }
    if (!$check || (int) $check['rev'] !== $next || !$verified) {
        sql_query('ROLLBACK');
        noa_json(500, array('ok' => false, 'status' => 'error', 'error' => 'reread'));
    }
    sql_query("INSERT INTO noa_save_history (target_key, base_rev, new_rev, changed_keys, result, actor) VALUES ('" . noa_esc($key) . "', " . $base . ", " . $next . ", '" . noa_esc(json_encode(array_keys($patch))) . "', 'written', 'admin')");
    sql_query('COMMIT');
    noa_json(200, array('ok' => true, 'status' => 'written', 'rev' => $next, 'key' => $key, 'savedKeys' => array_keys($patch)));
}

noa_json(404, array('ok' => false, 'status' => 'error', 'error' => 'op'));
